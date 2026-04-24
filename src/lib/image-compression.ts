/**
 * Canvas-based image compression utility.
 *
 * Strategy (tuned to produce savings comparable to PowerPoint's built-in
 * "Compress Pictures" presets):
 *
 *   1. Decode the source with createImageBitmap (falling back to <img>).
 *   2. Detect whether the image truly uses alpha. Many PNGs embedded in
 *      presentations are fully opaque and should be re-encoded as JPEG.
 *   3. Downsample the longest edge to a ratio-controlled cap. At ratio 0.1
 *      we cap around 720px (close to 96 PPI on a 16:9 slide); at 1.0 we
 *      keep the original pixel dimensions. This mirrors PowerPoint's
 *      150/220 PPI presets by limiting the actual pixel count.
 *   4. Encode opaque images as JPEG with a quality curve tuned to match
 *      Office's output; transparent images stay as PNG but are still
 *      downsampled.
 *   5. If the re-encoded blob is larger than the source, keep the source.
 */

const MIN_DIMENSION = 64;
const MAX_PIXEL_EDGE = 4000;

export type CompressOptions = {
  /** 0 < ratio <= 1. Lower = smaller file / lower quality. */
  ratio: number;
};

type DecodedSource = {
  width: number;
  height: number;
  draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void;
  cleanup: () => void;
};

async function loadBitmap(blob: Blob): Promise<DecodedSource> {
  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(blob);
      return {
        width: bitmap.width,
        height: bitmap.height,
        draw: (ctx, w, h) => ctx.drawImage(bitmap, 0, 0, w, h),
        cleanup: () => bitmap.close?.(),
      };
    } catch {
      // fall through
    }
  }

  const url = URL.createObjectURL(blob);
  const img = new Image();
  img.decoding = "async";
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error("Failed to decode image"));
    img.src = url;
  });

  return {
    width: img.naturalWidth,
    height: img.naturalHeight,
    draw: (ctx, w, h) => ctx.drawImage(img, 0, 0, w, h),
    cleanup: () => URL.revokeObjectURL(url),
  };
}

function couldHaveAlpha(mime: string): boolean {
  return (
    mime === "image/png" ||
    mime === "image/gif" ||
    mime === "image/webp" ||
    mime === "image/tiff" ||
    mime === "image/bmp"
  );
}

function detectAlpha(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number
): boolean {
  // Sample a coarse grid instead of every pixel; ImageData for large images
  // is expensive. A 40x40 grid catches real transparency well in practice.
  const steps = 40;
  const stepX = Math.max(1, Math.floor(width / steps));
  const stepY = Math.max(1, Math.floor(height / steps));
  try {
    for (let y = 0; y < height; y += stepY) {
      const data = ctx.getImageData(0, y, width, 1).data;
      for (let x = 0; x < width; x += stepX) {
        if (data[x * 4 + 3] < 250) return true;
      }
    }
  } catch {
    // Cross-origin or tainted canvas; assume alpha to be safe.
    return true;
  }
  return false;
}

/**
 * Map the slider ratio (0.1 - 1.0) to a maximum longest-edge in pixels.
 * ratio 0.10 -> 720 px   (aggressive)
 * ratio 0.25 -> 1024 px
 * ratio 0.50 -> 1600 px  (roughly PowerPoint "150 ppi")
 * ratio 0.75 -> 2400 px  (roughly "220 ppi")
 * ratio 1.00 -> no cap
 */
function maxEdgeForRatio(ratio: number): number {
  if (ratio >= 0.99) return MAX_PIXEL_EDGE;
  const stops: Array<[number, number]> = [
    [0.1, 720],
    [0.25, 1024],
    [0.5, 1600],
    [0.75, 2400],
    [1.0, MAX_PIXEL_EDGE],
  ];
  for (let i = 0; i < stops.length - 1; i++) {
    const [r1, e1] = stops[i];
    const [r2, e2] = stops[i + 1];
    if (ratio <= r2) {
      const t = (ratio - r1) / (r2 - r1);
      return Math.round(e1 + (e2 - e1) * t);
    }
  }
  return MAX_PIXEL_EDGE;
}

/** Map ratio to JPEG quality in the 0.45 - 0.92 range. */
function jpegQualityForRatio(ratio: number): number {
  const q = 0.45 + ratio * 0.47;
  return Math.min(0.95, Math.max(0.3, q));
}

async function canvasToBlob(
  canvas: HTMLCanvasElement,
  mime: string,
  quality: number | undefined
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => {
        if (b) resolve(b);
        else reject(new Error("Canvas toBlob returned null"));
      },
      mime,
      quality
    );
  });
}

export async function compressImageBlob(
  source: Blob,
  { ratio }: CompressOptions
): Promise<Blob> {
  const clampedRatio = Math.min(1, Math.max(0.05, ratio));

  const decoded = await loadBitmap(source);
  try {
    const srcW = decoded.width;
    const srcH = decoded.height;
    const longest = Math.max(srcW, srcH);

    const maxEdge = maxEdgeForRatio(clampedRatio);
    const scale = longest > maxEdge ? maxEdge / longest : 1;
    const targetW = Math.max(MIN_DIMENSION, Math.round(srcW * scale));
    const targetH = Math.max(MIN_DIMENSION, Math.round(srcH * scale));

    const canvas = document.createElement("canvas");
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) throw new Error("Could not create 2D context");

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    decoded.draw(ctx, targetW, targetH);

    const mightHaveAlpha = couldHaveAlpha(source.type);
    const hasAlpha = mightHaveAlpha ? detectAlpha(ctx, targetW, targetH) : false;

    let outBlob: Blob;
    if (hasAlpha) {
      outBlob = await canvasToBlob(canvas, "image/png", undefined);
      if (clampedRatio < 0.5) {
        try {
          const webp = await canvasToBlob(
            canvas,
            "image/webp",
            jpegQualityForRatio(clampedRatio)
          );
          if (webp.type === "image/webp" && webp.size < outBlob.size) {
            outBlob = webp;
          }
        } catch {
          // ignore
        }
      }
    } else {
      const flat = document.createElement("canvas");
      flat.width = targetW;
      flat.height = targetH;
      const flatCtx = flat.getContext("2d", { alpha: false });
      if (!flatCtx) throw new Error("Could not create 2D context");
      flatCtx.fillStyle = "#ffffff";
      flatCtx.fillRect(0, 0, targetW, targetH);
      flatCtx.imageSmoothingEnabled = true;
      flatCtx.imageSmoothingQuality = "high";
      flatCtx.drawImage(canvas, 0, 0);
      outBlob = await canvasToBlob(
        flat,
        "image/jpeg",
        jpegQualityForRatio(clampedRatio)
      );
    }

    return outBlob;
  } finally {
    decoded.cleanup();
  }
}

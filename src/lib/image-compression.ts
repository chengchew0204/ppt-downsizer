/**
 * Canvas-based image compression utility.
 *
 * Strategy (tuned to produce savings comparable to PowerPoint's built-in
 * "Compress Pictures" presets):
 *
 *   1. Decode the source with createImageBitmap (falling back to <img>).
 *   2. Detect whether the image truly uses alpha.
 *   3. Downsample the output dimensions. The target edge is determined by
 *      BOTH a ratio-controlled pixel cap AND a ratio-controlled scale
 *      factor, so even images that are already below the cap still shrink
 *      when the user picks a low ratio.
 *   4. For opaque images, encode as JPEG. For images with real alpha,
 *      encode as WebP (lossy, supports alpha) whenever it beats PNG.
 *   5. Always compare against the source blob. If the re-encoded result
 *      is still larger, fall back to the source and mark the image as
 *      "already optimal" so the UI can communicate that clearly.
 */

const MIN_DIMENSION = 48;
const MAX_PIXEL_EDGE = 4000;

export type CompressOptions = {
  /** 0 < ratio <= 1. Lower = smaller file / lower quality. */
  ratio: number;
};

/** Status of the compression result. */
export type CompressStatus =
  | "compressed"
  | "already-optimal"
  | "unchanged-max-quality";

export type CompressResult = {
  blob: Blob;
  /** Whether we actually produced a smaller file than the source. */
  status: CompressStatus;
  /** Size of the best candidate we produced, even if it wasn't adopted. */
  attemptedSize: number;
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
 * This is the absolute cap; images larger than this get downsampled.
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

/**
 * Additional scale factor applied on top of the edge cap. This keeps the
 * slider meaningful for images that are already below the cap - at ratio
 * 0.1 we still shrink small images to ~55% of their original dimensions.
 */
function extraScaleForRatio(ratio: number): number {
  // Curve: 0.10 -> 0.55, 0.25 -> 0.70, 0.50 -> 0.85, 0.75 -> 0.95, 1.0 -> 1.0
  if (ratio >= 1) return 1;
  const stops: Array<[number, number]> = [
    [0.1, 0.55],
    [0.25, 0.7],
    [0.5, 0.85],
    [0.75, 0.95],
    [1.0, 1.0],
  ];
  for (let i = 0; i < stops.length - 1; i++) {
    const [r1, s1] = stops[i];
    const [r2, s2] = stops[i + 1];
    if (ratio <= r2) {
      const t = (ratio - r1) / (r2 - r1);
      return s1 + (s2 - s1) * t;
    }
  }
  return 1;
}

/** JPEG / WebP quality curve: 0.35 at ratio 0.1, ~0.92 at ratio 1.0. */
function qualityForRatio(ratio: number): number {
  const q = 0.35 + ratio * 0.6;
  return Math.min(0.95, Math.max(0.25, q));
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
        else reject(new Error(`Canvas toBlob(${mime}) returned null`));
      },
      mime,
      quality
    );
  });
}

export async function compressImageBlob(
  source: Blob,
  { ratio }: CompressOptions
): Promise<CompressResult> {
  const clampedRatio = Math.min(1, Math.max(0.05, ratio));
  const quality = qualityForRatio(clampedRatio);

  const decoded = await loadBitmap(source);
  try {
    const srcW = decoded.width;
    const srcH = decoded.height;
    const longest = Math.max(srcW, srcH);

    const edgeCap = maxEdgeForRatio(clampedRatio);
    const capScale = longest > edgeCap ? edgeCap / longest : 1;
    const totalScale = Math.min(1, capScale * extraScaleForRatio(clampedRatio));

    const targetW = Math.max(MIN_DIMENSION, Math.round(srcW * totalScale));
    const targetH = Math.max(MIN_DIMENSION, Math.round(srcH * totalScale));

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

    const candidates: Blob[] = [];

    if (hasAlpha) {
      try {
        candidates.push(await canvasToBlob(canvas, "image/webp", quality));
      } catch {
        // ignore WebP failures, fall back to PNG below
      }
      try {
        candidates.push(await canvasToBlob(canvas, "image/png", undefined));
      } catch {
        // ignore
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
      try {
        candidates.push(await canvasToBlob(flat, "image/jpeg", quality));
      } catch {
        // ignore
      }
      try {
        candidates.push(await canvasToBlob(flat, "image/webp", quality));
      } catch {
        // ignore
      }
    }

    // Only accept candidates the browser actually encoded in the requested
    // format. Safari may silently fall back to PNG for WebP, etc.
    const valid = candidates.filter(
      (c) =>
        c.type === "image/webp" ||
        c.type === "image/png" ||
        c.type === "image/jpeg"
    );
    if (valid.length === 0) {
      return {
        blob: source,
        status: "already-optimal",
        attemptedSize: source.size,
      };
    }

    valid.sort((a, b) => a.size - b.size);
    const best = valid[0];

    if (best.size < source.size) {
      return {
        blob: best,
        status: "compressed",
        attemptedSize: best.size,
      };
    }

    return {
      blob: source,
      status:
        clampedRatio >= 1 ? "unchanged-max-quality" : "already-optimal",
      attemptedSize: best.size,
    };
  } finally {
    decoded.cleanup();
  }
}

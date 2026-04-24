/**
 * Canvas-based image compression utility.
 *
 * Takes a source Blob (any raster image the browser can decode) and a quality
 * ratio in the range (0, 1]. Returns a new Blob compressed as JPEG (for
 * photographic images) or PNG (for images with transparency / tiny images).
 *
 * The ratio is also applied to the output dimensions so that very low ratios
 * meaningfully shrink the file. A ratio of 1.0 re-encodes at the original
 * dimensions with maximum quality.
 */

const MIN_DIMENSION = 32;

function needsAlpha(mime: string): boolean {
  return mime === "image/png" || mime === "image/gif" || mime === "image/webp";
}

async function loadBitmap(blob: Blob): Promise<{
  width: number;
  height: number;
  draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void;
  cleanup: () => void;
}> {
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
      // fall through to HTMLImageElement
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

export type CompressOptions = {
  /** 0 < ratio <= 1. Lower = smaller file / lower quality. */
  ratio: number;
  /** Preferred output mime. Defaults to preserve alpha when needed. */
  preferredMime?: string;
};

export async function compressImageBlob(
  source: Blob,
  { ratio, preferredMime }: CompressOptions
): Promise<Blob> {
  const clampedRatio = Math.min(1, Math.max(0.05, ratio));

  const decoded = await loadBitmap(source);
  try {
    const scale = Math.max(0.1, Math.min(1, 0.5 + clampedRatio * 0.5));
    const targetW = Math.max(MIN_DIMENSION, Math.round(decoded.width * scale));
    const targetH = Math.max(MIN_DIMENSION, Math.round(decoded.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) throw new Error("Could not create 2D context");

    const hasAlpha = preferredMime
      ? needsAlpha(preferredMime)
      : needsAlpha(source.type);

    if (!hasAlpha) {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, targetW, targetH);
    }

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    decoded.draw(ctx, targetW, targetH);

    const outMime = hasAlpha ? "image/png" : "image/jpeg";
    const quality = outMime === "image/jpeg" ? 0.4 + clampedRatio * 0.55 : 1;

    const blob: Blob = await new Promise((resolve, reject) => {
      canvas.toBlob(
        (b) => {
          if (b) resolve(b);
          else reject(new Error("Canvas toBlob returned null"));
        },
        outMime,
        quality
      );
    });

    return blob;
  } finally {
    decoded.cleanup();
  }
}

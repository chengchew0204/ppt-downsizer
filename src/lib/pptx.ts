import JSZip from "jszip";

export const MEDIA_PATH_PREFIX = "ppt/media/";

const IMAGE_EXTENSIONS = new Set([
  "jpg",
  "jpeg",
  "png",
  "gif",
  "bmp",
  "webp",
  "tif",
  "tiff",
]);

export type MediaImage = {
  id: string;
  path: string;
  name: string;
  ext: string;
  mime: string;
  originalSize: number;
  originalBlob: Blob;
  previewUrl: string;
};

function mimeFromExt(ext: string): string {
  switch (ext) {
    case "png":
      return "image/png";
    case "gif":
      return "image/gif";
    case "bmp":
      return "image/bmp";
    case "webp":
      return "image/webp";
    case "tif":
    case "tiff":
      return "image/tiff";
    case "jpg":
    case "jpeg":
    default:
      return "image/jpeg";
  }
}

export async function loadPptx(file: File): Promise<{
  zip: JSZip;
  images: MediaImage[];
}> {
  const zip = await JSZip.loadAsync(file);
  const images: MediaImage[] = [];

  const entries = Object.values(zip.files).filter(
    (entry) =>
      !entry.dir &&
      entry.name.startsWith(MEDIA_PATH_PREFIX) &&
      IMAGE_EXTENSIONS.has(
        (entry.name.split(".").pop() ?? "").toLowerCase()
      )
  );

  for (const entry of entries) {
    const ext = (entry.name.split(".").pop() ?? "").toLowerCase();
    const mime = mimeFromExt(ext);
    const rawBlob = await entry.async("blob");
    const blob = new Blob([rawBlob], { type: mime });
    const name = entry.name.slice(MEDIA_PATH_PREFIX.length);
    images.push({
      id: entry.name,
      path: entry.name,
      name,
      ext,
      mime,
      originalSize: blob.size,
      originalBlob: blob,
      previewUrl: URL.createObjectURL(blob),
    });
  }

  images.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
  return { zip, images };
}

export async function buildOptimizedPptx(
  zip: JSZip,
  replacements: Map<string, Blob>
): Promise<Blob> {
  const outZip = new JSZip();

  const entries = Object.values(zip.files);
  for (const entry of entries) {
    if (entry.dir) {
      outZip.folder(entry.name);
      continue;
    }

    const replacement = replacements.get(entry.name);
    if (replacement) {
      const buffer = await replacement.arrayBuffer();
      outZip.file(entry.name, buffer, { binary: true });
    } else {
      const data = await entry.async("uint8array");
      outZip.file(entry.name, data, { binary: true });
    }
  }

  return outZip.generateAsync({
    type: "blob",
    mimeType:
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  });
}

export function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

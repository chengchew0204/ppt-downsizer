import JSZip from "jszip";

export const MEDIA_PATH_PREFIX = "ppt/media/";
export const CONTENT_TYPES_PATH = "[Content_Types].xml";

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

function extFromBlobMime(mime: string): string {
  switch (mime) {
    case "image/jpeg":
      return "jpeg";
    case "image/png":
      return "png";
    case "image/gif":
      return "gif";
    case "image/bmp":
      return "bmp";
    case "image/webp":
      return "webp";
    case "image/tiff":
      return "tiff";
    default:
      return "";
  }
}

function contentTypeForExt(ext: string): string | null {
  switch (ext.toLowerCase()) {
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "png":
      return "image/png";
    case "gif":
      return "image/gif";
    case "bmp":
      return "image/bmp";
    case "tif":
    case "tiff":
      return "image/tiff";
    default:
      return null;
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

/**
 * For a given replacement, compute the path that entry should live under in
 * the rebuilt archive. If the compressed blob is a different image format
 * than the original file's extension, we rename the file to match so that
 * `[Content_Types].xml` resolves to the correct MIME. This is critical for
 * PowerPoint for the Web, which is strict about the declared content type.
 */
function renamedPathForReplacement(
  originalPath: string,
  replacement: Blob
): string {
  const newExt = extFromBlobMime(replacement.type);
  if (!newExt) return originalPath;
  const lastDot = originalPath.lastIndexOf(".");
  if (lastDot < 0) return originalPath;
  const currentExt = originalPath.slice(lastDot + 1).toLowerCase();
  const normalized = currentExt === "jpg" ? "jpeg" : currentExt;
  if (normalized === newExt) return originalPath;
  return `${originalPath.slice(0, lastDot)}.${newExt}`;
}

/** Build a mapping of old archive path -> new archive path for renamed files. */
function computeRenames(
  replacements: Map<string, Blob>,
  existingPaths: Set<string>
): Map<string, string> {
  const renames = new Map<string, string>();
  const claimed = new Set<string>();
  for (const [path, blob] of replacements.entries()) {
    const next = renamedPathForReplacement(path, blob);
    if (next === path) continue;
    // Avoid colliding with another archive entry (very rare in real .pptx
    // files, but we don't want to silently overwrite an unrelated file).
    if (existingPaths.has(next) && !replacements.has(next)) continue;
    if (claimed.has(next)) continue;
    claimed.add(next);
    renames.set(path, next);
  }
  return renames;
}

/**
 * Rewrite every path reference that lives in a .rels file. Relationship
 * Targets are relative to the .rels file's own directory, so we resolve
 * them to absolute archive paths before checking against the renames map.
 */
function rewriteRelsXml(
  relsPath: string,
  xml: string,
  renames: Map<string, string>
): string {
  if (renames.size === 0) return xml;

  const relsDir = relsPath.replace(/[^/]+$/, "").replace(/_rels\/$/, "");

  return xml.replace(/Target="([^"]+)"/g, (match, target: string) => {
    const isAbsolute = target.startsWith("/");
    const absolute = isAbsolute
      ? target.slice(1)
      : resolveRelative(relsDir, target);
    const rename = renames.get(absolute);
    if (!rename) return match;
    const newTarget = isAbsolute
      ? `/${rename}`
      : makeRelative(relsDir, rename);
    return `Target="${newTarget}"`;
  });
}

function resolveRelative(baseDir: string, target: string): string {
  const parts = (baseDir + target).split("/");
  const stack: string[] = [];
  for (const part of parts) {
    if (!part || part === ".") continue;
    if (part === "..") {
      stack.pop();
      continue;
    }
    stack.push(part);
  }
  return stack.join("/");
}

function makeRelative(baseDir: string, targetAbsolute: string): string {
  const baseParts = baseDir.split("/").filter(Boolean);
  const targetParts = targetAbsolute.split("/").filter(Boolean);
  let common = 0;
  while (
    common < baseParts.length &&
    common < targetParts.length &&
    baseParts[common] === targetParts[common]
  ) {
    common++;
  }
  const up = baseParts.length - common;
  const rel = [
    ...Array(up).fill(".."),
    ...targetParts.slice(common),
  ].join("/");
  return rel || ".";
}

/**
 * Ensure `[Content_Types].xml` declares a Default entry for every image
 * extension we're about to write into ppt/media/. Missing declarations
 * cause PowerPoint for the Web to silently fail to render the image.
 */
function ensureContentTypes(xml: string, extensions: Set<string>): string {
  let next = xml;
  const existingExts = new Set<string>();
  const defaultRegex = /<Default\b[^>]*Extension="([^"]+)"[^>]*\/>/g;
  let m: RegExpExecArray | null;
  while ((m = defaultRegex.exec(xml))) {
    existingExts.add(m[1].toLowerCase());
  }

  const additions: string[] = [];
  for (const ext of extensions) {
    const normalized = ext.toLowerCase();
    if (existingExts.has(normalized)) continue;
    // jpg and jpeg are treated as the same type by OOXML; if either is
    // already declared we skip adding the other.
    if (
      (normalized === "jpg" && existingExts.has("jpeg")) ||
      (normalized === "jpeg" && existingExts.has("jpg"))
    ) {
      continue;
    }
    const ct = contentTypeForExt(normalized);
    if (!ct) continue;
    additions.push(
      `<Default Extension="${normalized}" ContentType="${ct}"/>`
    );
  }

  if (additions.length === 0) return next;

  const closeIdx = next.indexOf("</Types>");
  if (closeIdx < 0) return next;
  next = next.slice(0, closeIdx) + additions.join("") + next.slice(closeIdx);
  return next;
}

export async function buildOptimizedPptx(
  zip: JSZip,
  replacements: Map<string, Blob>
): Promise<Blob> {
  const outZip = new JSZip();
  const existingPaths = new Set(
    Object.values(zip.files)
      .filter((e) => !e.dir)
      .map((e) => e.name)
  );
  const renames = computeRenames(replacements, existingPaths);

  const neededExtensions = new Set<string>();
  for (const path of [...replacements.keys()]) {
    const finalPath = renames.get(path) ?? path;
    const lastDot = finalPath.lastIndexOf(".");
    if (lastDot >= 0) {
      neededExtensions.add(finalPath.slice(lastDot + 1).toLowerCase());
    }
  }

  const entries = Object.values(zip.files);
  for (const entry of entries) {
    if (entry.dir) {
      outZip.folder(entry.name);
      continue;
    }

    if (entry.name === CONTENT_TYPES_PATH) {
      const xml = await entry.async("string");
      const rewritten = ensureContentTypes(xml, neededExtensions);
      outZip.file(entry.name, rewritten);
      continue;
    }

    if (entry.name.endsWith(".rels")) {
      const xml = await entry.async("string");
      const rewritten = rewriteRelsXml(entry.name, xml, renames);
      outZip.file(entry.name, rewritten);
      continue;
    }

    const replacement = replacements.get(entry.name);
    if (replacement) {
      const buffer = await replacement.arrayBuffer();
      const finalPath = renames.get(entry.name) ?? entry.name;
      outZip.file(finalPath, buffer, { binary: true });
      continue;
    }

    const data = await entry.async("uint8array");
    outZip.file(entry.name, data, { binary: true });
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

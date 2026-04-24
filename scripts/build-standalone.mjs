import { spawnSync } from "node:child_process";
import { copyFileSync, mkdirSync, rmSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const distDir = join(root, "standalone-dist");
const builtHtml = join(distDir, "standalone", "index.html");
const publicDir = join(root, "public");
const publicTarget = join(publicDir, "ppt-downsizer.html");

console.log("[standalone] Running vite build...");
const result = spawnSync(
  process.platform === "win32" ? "npx.cmd" : "npx",
  ["vite", "build"],
  { cwd: root, stdio: "inherit" }
);

if (result.status !== 0) {
  process.exit(result.status ?? 1);
}

if (!existsSync(builtHtml)) {
  console.error(`[standalone] Expected output not found at ${builtHtml}`);
  process.exit(1);
}

mkdirSync(publicDir, { recursive: true });
copyFileSync(builtHtml, publicTarget);
console.log(`[standalone] Wrote ${publicTarget}`);

try {
  rmSync(distDir, { recursive: true, force: true });
} catch {
  // ignore
}

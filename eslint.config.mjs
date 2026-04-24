import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // We intentionally use native <img> for blob-URL previews that don't
      // go through the Next.js image optimizer. The same components are
      // also reused by the standalone (non-Next) Vite build.
      "@next/next/no-img-element": "off",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "standalone-dist/**",
    "public/ppt-downsizer.html",
  ]),
]);

export default eslintConfig;

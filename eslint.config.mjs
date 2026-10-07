import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Prisma client hasil generate (bukan kode tulisan tangan).
    "src/generated/**",
    // Aplikasi desktop Tauri: hasil build Rust & dependensinya.
    "desktop/src-tauri/target/**",
    "desktop/src-tauri/gen/**",
    "desktop/node_modules/**",
    "desktop/rilis/**",
  ]),
]);

export default eslintConfig;

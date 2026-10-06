import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

/**
 * Unit test fungsi MURNI (skema, registri form, mesin status, segel, PNG,
 * CSRF, IP). Modul ber-`server-only` / ber-DB diuji lewat E2E, bukan di sini.
 */
export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  test: { environment: "node", include: ["src/**/*.test.ts"] },
});

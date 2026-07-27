import { defineConfig } from "prisma/config";

/**
 * Konfigurasi CLI Prisma untuk DB APLIKASI (reporthub) — read-write.
 * Dipakai `prisma generate`/`db push` dengan `--config prisma.app.config.ts`.
 * (Config default `prisma.config.ts` khusus SIMGOS yang read-only.)
 */
const appUrl = process.env.DATABASE_URL_APP;

export default defineConfig({
  schema: "prisma/app/schema.prisma",
  ...(appUrl ? { datasource: { url: appUrl } } : {}),
});

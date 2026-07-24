import { defineConfig } from "prisma/config";

/**
 * Konfigurasi CLI Prisma (Prisma 7).
 *
 * Fokus repo ini: SIMGOS **read-only**. Yang boleh dijalankan hanya:
 *   - `npm run db:simgos:generate` → prisma generate (tidak menyentuh DB)
 *   - `npm run db:simgos:pull`     → prisma db pull (introspect saja, read-only)
 *
 * TIDAK ADA perintah migrate/db push untuk SIMGOS — ini bagian penegakan
 * HIGH ALERT (lihat docs/03-database-prisma.md).
 *
 * `datasource.url` HANYA dipakai CLI saat `db pull`; runtime aplikasi memakai
 * driver adapter (src/server/db/simgos.client.ts), bukan URL ini. Datasource
 * hanya disertakan bila kredensial ada, supaya `generate`/`postinstall` tetap
 * berjalan meski `.env` belum diisi (mis. fresh clone / CI).
 */
const simgosUrl = process.env.DATABASE_URL_SIMGOS;

export default defineConfig({
  schema: "prisma/simgos/schema.prisma",
  ...(simgosUrl ? { datasource: { url: simgosUrl } } : {}),
});

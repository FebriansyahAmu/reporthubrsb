// ============================================================================
// Migrasi: Checklist Pemeliharaan Berkala PER BARANG (per ruangan).
//   inv_checklist_run (ruangan × frekuensi × periode)
//   inv_checklist_periksa (per unit barang: kondisi + catatan)
// Isi checklist diambil dari daftar barang di Master Barang (inv_barang).
// MENGGANTI model lama berbasis template butir tugas: tabel model lama di-DROP
// HANYA bila terdeteksi berskema lama (tanpa kolom `periode_key`).
// DB APLIKASI `reporthub` (RW). BUKAN SIMGOS. Idempoten & AMAN diulang —
// data checklist model baru TIDAK pernah dihapus.
// Jalankan:
//   dev (host): node scripts/db/migrate-inventaris-checklist.mjs
//   produksi (Docker): via service `migrate` — lihat migrate-inventaris-all.mjs
// Referensi manusiawi: scripts/db/inventaris-checklist.sql
// ============================================================================
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

// Root proyek = dua tingkat di atas file ini. Portabel (host & container).
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const require = createRequire(import.meta.url);
const mariadb = require("mariadb");

// Env: utamakan process.env (env_file Docker), fallback baca .env dari root.
function envUrl(name) {
  if (process.env[name]) return process.env[name];
  try {
    const txt = readFileSync(`${ROOT}/.env`, "utf8");
    for (const line of txt.split(/\r?\n/)) {
      const t = line.trim();
      if (!t || t.startsWith("#")) continue;
      const m = t.match(new RegExp(`^${name}\\s*=\\s*["']?([^"']+)["']?`));
      if (m) return m[1];
    }
  } catch { /* tak ada file .env (mis. di container) → andalkan process.env */ }
  return null;
}

const url = envUrl("DATABASE_URL_APP");
if (!url) throw new Error("DATABASE_URL_APP tidak ditemukan (process.env atau .env)");
const u = new URL(url);
const database = u.pathname.replace(/^\//, "");
if (database !== "reporthub") console.warn(`[peringatan] target DB = "${database}" (diharapkan "reporthub")`);

const conn = await mariadb.createConnection({
  host: u.hostname, port: u.port ? Number(u.port) : 3306,
  user: decodeURIComponent(u.username), password: decodeURIComponent(u.password),
  database, connectTimeout: 10000, multipleStatements: false,
});

try {
  console.log(`Target DB: ${database} @ ${u.hostname}\n— Checklist Pemeliharaan per barang…`);

  // Buang model lama (template butir tugas). Tabel khas model lama selalu
  // aman di-DROP; `inv_checklist_run`/`_periksa` hanya bila masih berskema
  // lama (run tanpa `periode_key`) — model baru TIDAK disentuh.
  const kolomRun = await conn.query(
    "SELECT COLUMN_NAME c FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=? AND TABLE_NAME='inv_checklist_run'",
    [database],
  );
  const runLama = kolomRun.length > 0 && !kolomRun.some((r) => r.c === "periode_key");
  const buang = ["inv_checklist_check", "inv_checklist_item", ...(runLama ? ["inv_checklist_periksa", "inv_checklist_run"] : []), "inv_checklist_template"];
  for (const t of buang) await conn.query(`DROP TABLE IF EXISTS ${t}`);
  console.log(runLama ? "  ✓ tabel checklist model lama dibuang" : "  · checklist model baru dipertahankan (tak ada yang di-DROP)");

  await conn.query(`CREATE TABLE IF NOT EXISTS inv_checklist_run (
    id VARCHAR(30) NOT NULL PRIMARY KEY,
    ruangan_id VARCHAR(30) NOT NULL,
    frekuensi VARCHAR(16) NOT NULL DEFAULT 'HARIAN',
    periode_key VARCHAR(16) NOT NULL,
    selesai_at DATETIME(3) NULL,
    selesai_by VARCHAR(191) NULL,
    catatan TEXT NULL,
    created_by VARCHAR(191) NULL,
    updated_by VARCHAR(191) NULL,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    UNIQUE KEY uq_inv_cl_run (ruangan_id, frekuensi, periode_key),
    KEY idx_inv_cl_run_ruangan (ruangan_id),
    KEY idx_inv_cl_run_periode (periode_key),
    CONSTRAINT fk_inv_cl_run_ruangan FOREIGN KEY (ruangan_id) REFERENCES inv_ruangan(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  console.log("  ✓ tabel inv_checklist_run");

  await conn.query(`CREATE TABLE IF NOT EXISTS inv_checklist_periksa (
    id VARCHAR(30) NOT NULL PRIMARY KEY,
    run_id VARCHAR(30) NOT NULL,
    barang_id VARCHAR(30) NOT NULL,
    kondisi_id VARCHAR(30) NULL,
    catatan TEXT NULL,
    checked_by VARCHAR(191) NULL,
    checked_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    UNIQUE KEY uq_inv_cl_periksa (run_id, barang_id),
    KEY idx_inv_cl_periksa_run (run_id),
    KEY idx_inv_cl_periksa_barang (barang_id),
    CONSTRAINT fk_inv_cl_periksa_run FOREIGN KEY (run_id) REFERENCES inv_checklist_run(id) ON DELETE CASCADE,
    CONSTRAINT fk_inv_cl_periksa_barang FOREIGN KEY (barang_id) REFERENCES inv_barang(id) ON DELETE CASCADE,
    CONSTRAINT fk_inv_cl_periksa_kondisi FOREIGN KEY (kondisi_id) REFERENCES inv_kondisi(id) ON DELETE SET NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  console.log("  ✓ tabel inv_checklist_periksa");

  const nr = Number((await conn.query("SELECT COUNT(*) n FROM inv_checklist_run"))[0].n);
  const np = Number((await conn.query("SELECT COUNT(*) n FROM inv_checklist_periksa"))[0].n);
  console.log(`\n— run: ${nr} · periksa: ${np}\nSelesai.`);
} finally {
  await conn.end();
}

// ============================================================================
// Migrasi ADITIF: tautan publik (QR) daftar barang per ruangan
//   inv_ruangan_publik (1 baris per ruangan; token kapabilitas ascii_bin)
// DB APLIKASI `reporthub` (RW). BUKAN SIMGOS. Idempoten & AMAN diulang.
// Jalankan:
//   dev (host): node scripts/db/migrate-inventaris-publik.mjs
//   produksi (Docker): via service `migrate` — lihat migrate-inventaris-all.mjs
// Referensi manusiawi: scripts/db/inventaris-publik.sql
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
  console.log(`Target DB: ${database} @ ${u.hostname}\n— Tautan publik ruangan…`);

  await conn.query(`CREATE TABLE IF NOT EXISTS inv_ruangan_publik (
    ruangan_id VARCHAR(30) NOT NULL PRIMARY KEY,
    token CHAR(32) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    aktif TINYINT(1) NOT NULL DEFAULT 1,
    dibuat_oleh VARCHAR(191) NULL,
    diubah_oleh VARCHAR(191) NULL,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    UNIQUE KEY uq_inv_ruangan_publik_token (token),
    CONSTRAINT fk_inv_ruangan_publik_ruangan FOREIGN KEY (ruangan_id) REFERENCES inv_ruangan(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  console.log("  ✓ tabel inv_ruangan_publik");

  // Pengaman: token WAJIB peka huruf besar/kecil (lihat inventaris-publik.sql).
  const [kol] = await conn.query(
    "SELECT COLLATION_NAME c FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=? AND TABLE_NAME='inv_ruangan_publik' AND COLUMN_NAME='token'",
    [database],
  );
  if (kol?.c !== "ascii_bin") throw new Error(`Collation kolom token = ${kol?.c} (harus ascii_bin)`);
  console.log("  ✓ kolom token ascii_bin (peka huruf besar/kecil)");

  const n = (await conn.query("SELECT COUNT(*) n FROM inv_ruangan_publik"))[0].n;
  console.log(`\n— tautan publik: ${Number(n)}\nSelesai.`);
} finally {
  await conn.end();
}

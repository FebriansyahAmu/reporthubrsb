// ============================================================================
// Migrasi modul REKAP KLAIM BPJS → DB APLIKASI `reporthub` (RW). BUKAN SIMGOS.
// Idempoten: CREATE TABLE IF NOT EXISTS (tanpa DROP → AMAN diulang).
// Portabel + env-first (process.env.DATABASE_URL_APP dulu, fallback file .env).
// Jalankan:
//   dev (host):        node scripts/db/migrate-rekap-klaim.mjs
//   produksi (Docker): docker compose run --rm migrate scripts/db/migrate-rekap-klaim.mjs
// DDL referensi manusiawi: scripts/db/rekap-klaim.sql
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

const DDL = [
  `CREATE TABLE IF NOT EXISTS klaim_klaim (
    id                 VARCHAR(30)  NOT NULL PRIMARY KEY,
    nomor_klaim        VARCHAR(60)  NULL,
    jenis_klaim        VARCHAR(16)  NOT NULL DEFAULT 'REGULER',
    jenis_layanan      VARCHAR(8)   NOT NULL DEFAULT 'RITL',
    kategori           VARCHAR(20)  NOT NULL DEFAULT 'INA_CBGS',
    bulan_pelayanan    TINYINT      NOT NULL,
    tahun_pelayanan    SMALLINT     NOT NULL,
    jumlah             BIGINT       NOT NULL DEFAULT 0,
    jumlah_diajukan    BIGINT       NULL,
    jumlah_kasus       INT          NULL,
    tgl_masuk_rekening DATE         NULL,
    status             VARCHAR(16)  NOT NULL DEFAULT 'SUBMITTED',
    ref_ba             VARCHAR(100) NULL,
    catatan            TEXT         NULL,
    created_by         VARCHAR(191) NULL,
    updated_by         VARCHAR(191) NULL,
    created_at         DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at         DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    KEY idx_klaim_tahun (tahun_pelayanan),
    KEY idx_klaim_periode (tahun_pelayanan, bulan_pelayanan),
    KEY idx_klaim_jenis (jenis_klaim),
    KEY idx_klaim_layanan (jenis_layanan),
    KEY idx_klaim_kategori (kategori),
    KEY idx_klaim_status (status)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  `CREATE TABLE IF NOT EXISTS klaim_potongan (
    id            VARCHAR(30)  NOT NULL PRIMARY KEY,
    klaim_id      VARCHAR(30)  NOT NULL,
    jenis         VARCHAR(24)  NOT NULL,
    jumlah        BIGINT       NOT NULL DEFAULT 0,
    cicilan_ke    INT          NULL,
    total_cicilan INT          NULL,
    ref_ba        VARCHAR(100) NULL,
    deskripsi     TEXT         NULL,
    tgl_terapkan  DATE         NULL,
    created_by    VARCHAR(191) NULL,
    created_at    DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at    DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    KEY idx_potongan_klaim (klaim_id),
    KEY idx_potongan_jenis (jenis),
    CONSTRAINT fk_klaim_potongan_klaim FOREIGN KEY (klaim_id) REFERENCES klaim_klaim(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
];

const conn = await mariadb.createConnection({
  host: u.hostname, port: u.port ? Number(u.port) : 3306,
  user: decodeURIComponent(u.username), password: decodeURIComponent(u.password),
  database, connectTimeout: 10000, multipleStatements: false,
});

try {
  console.log(`Target DB: ${database} @ ${u.hostname}\n— Membuat tabel klaim…`);
  for (const stmt of DDL) {
    const name = stmt.match(/klaim_[a-z_]+/)[0];
    await conn.query(stmt);
    console.log(`  ✓ ${name}`);
  }

  console.log("\n— Ringkasan baris:");
  for (const t of ["klaim_klaim", "klaim_potongan"]) {
    const n = (await conn.query(`SELECT COUNT(*) n FROM ${t}`))[0].n;
    console.log(`  ${t.padEnd(18)} ${Number(n)}`);
  }
  console.log("\nSelesai.");
} finally {
  await conn.end();
}

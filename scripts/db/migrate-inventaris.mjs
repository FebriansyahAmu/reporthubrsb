// ============================================================================
// Migrasi + seed modul INVENTARISASI BARANG untuk DB APLIKASI `reporthub` (RW).
// BUKAN SIMGOS. Idempoten: CREATE TABLE IF NOT EXISTS + INSERT IGNORE.
// Jalankan:
//   dev (host): node scripts/db/migrate-inventaris.mjs   (baca DATABASE_URL_APP dari .env)
//   produksi (Docker): via service `migrate` — lihat migrate-inventaris-all.mjs
// DDL referensi manusiawi: scripts/db/inventaris.sql
// ============================================================================
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import crypto from "node:crypto";

// Root proyek = dua tingkat di atas file ini (scripts/db/xxx.mjs). Portabel:
// jalan di host (dev, Windows/Linux) maupun di dalam container (scripts di-mount,
// node_modules standalone ada di /app).
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const require = createRequire(import.meta.url);
const mariadb = require("mariadb");

// Env: utamakan process.env (disuntik Docker Compose via env_file), fallback baca
// file .env dari root proyek (dev/host). Baris diawali '#' dilewati.
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
if (database !== "reporthub") {
  console.warn(`[peringatan] target DB = "${database}" (diharapkan "reporthub")`);
}
const rid = () => crypto.randomBytes(12).toString("hex").slice(0, 24); // <=30 char

const DDL = [
  `CREATE TABLE IF NOT EXISTS inv_satuan (
    id VARCHAR(30) NOT NULL PRIMARY KEY, nama VARCHAR(40) NOT NULL,
    urutan INT NOT NULL DEFAULT 0, aktif TINYINT(1) NOT NULL DEFAULT 1,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    UNIQUE KEY uq_inv_satuan_nama (nama)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  `CREATE TABLE IF NOT EXISTS inv_kondisi (
    id VARCHAR(30) NOT NULL PRIMARY KEY, nama VARCHAR(60) NOT NULL, kode VARCHAR(10) NOT NULL,
    tone VARCHAR(20) NOT NULL DEFAULT 'neutral', urutan INT NOT NULL DEFAULT 0, aktif TINYINT(1) NOT NULL DEFAULT 1,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    UNIQUE KEY uq_inv_kondisi_kode (kode)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  `CREATE TABLE IF NOT EXISTS inv_sumber_anggaran (
    id VARCHAR(30) NOT NULL PRIMARY KEY, nama VARCHAR(80) NOT NULL, singkatan VARCHAR(20) NOT NULL,
    urutan INT NOT NULL DEFAULT 0, aktif TINYINT(1) NOT NULL DEFAULT 1,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    UNIQUE KEY uq_inv_sumber_singkatan (singkatan)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  `CREATE TABLE IF NOT EXISTS inv_kategori (
    id VARCHAR(30) NOT NULL PRIMARY KEY, nama VARCHAR(80) NOT NULL, kode VARCHAR(20) NULL,
    urutan INT NOT NULL DEFAULT 0, aktif TINYINT(1) NOT NULL DEFAULT 1,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    UNIQUE KEY uq_inv_kategori_nama (nama)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  `CREATE TABLE IF NOT EXISTS inv_ruangan (
    id VARCHAR(30) NOT NULL PRIMARY KEY, kode_prefix VARCHAR(15) NOT NULL, nama VARCHAR(120) NOT NULL,
    pj_nama VARCHAR(120) NULL, pj_nip VARCHAR(30) NULL,
    urutan INT NOT NULL DEFAULT 0, aktif TINYINT(1) NOT NULL DEFAULT 1,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    UNIQUE KEY uq_inv_ruangan_prefix (kode_prefix)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  `CREATE TABLE IF NOT EXISTS inv_barang (
    id VARCHAR(30) NOT NULL PRIMARY KEY, kode_barang VARCHAR(40) NOT NULL, register INT NULL,
    nama VARCHAR(191) NOT NULL, merk VARCHAR(191) NULL, nomor_seri VARCHAR(100) NULL,
    kategori_id VARCHAR(30) NULL, sumber_anggaran_id VARCHAR(30) NULL, satuan_id VARCHAR(30) NULL,
    kondisi_id VARCHAR(30) NULL, ruangan_id VARCHAR(30) NOT NULL,
    tahun_perolehan SMALLINT NULL, tgl_perolehan DATE NULL, harga BIGINT NULL,
    status_aset VARCHAR(20) NOT NULL DEFAULT 'AKTIF', foto_url VARCHAR(500) NULL, keterangan TEXT NULL,
    created_by VARCHAR(30) NULL, updated_by VARCHAR(30) NULL,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    UNIQUE KEY uq_inv_barang_kode (kode_barang),
    KEY idx_inv_barang_ruangan (ruangan_id), KEY idx_inv_barang_kondisi (kondisi_id),
    KEY idx_inv_barang_kategori (kategori_id), KEY idx_inv_barang_status (status_aset),
    KEY idx_inv_barang_tahun (tahun_perolehan),
    CONSTRAINT fk_inv_barang_ruangan FOREIGN KEY (ruangan_id) REFERENCES inv_ruangan(id) ON DELETE RESTRICT,
    CONSTRAINT fk_inv_barang_kondisi FOREIGN KEY (kondisi_id) REFERENCES inv_kondisi(id) ON DELETE SET NULL,
    CONSTRAINT fk_inv_barang_kategori FOREIGN KEY (kategori_id) REFERENCES inv_kategori(id) ON DELETE SET NULL,
    CONSTRAINT fk_inv_barang_satuan FOREIGN KEY (satuan_id) REFERENCES inv_satuan(id) ON DELETE SET NULL,
    CONSTRAINT fk_inv_barang_sumber FOREIGN KEY (sumber_anggaran_id) REFERENCES inv_sumber_anggaran(id) ON DELETE SET NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  `CREATE TABLE IF NOT EXISTS inv_pemeliharaan (
    id VARCHAR(30) NOT NULL PRIMARY KEY, barang_id VARCHAR(30) NOT NULL, tanggal DATE NOT NULL,
    jenis VARCHAR(20) NOT NULL DEFAULT 'RUTIN', hasil VARCHAR(30) NULL, kondisi_sesudah_id VARCHAR(30) NULL,
    petugas VARCHAR(191) NULL, biaya BIGINT NULL, catatan TEXT NULL, jatuh_tempo_berikutnya DATE NULL,
    created_by VARCHAR(30) NULL,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    KEY idx_inv_pem_barang (barang_id), KEY idx_inv_pem_tanggal (tanggal),
    CONSTRAINT fk_inv_pem_barang FOREIGN KEY (barang_id) REFERENCES inv_barang(id) ON DELETE CASCADE,
    CONSTRAINT fk_inv_pem_kondisi FOREIGN KEY (kondisi_sesudah_id) REFERENCES inv_kondisi(id) ON DELETE SET NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  `CREATE TABLE IF NOT EXISTS inv_mutasi (
    id VARCHAR(30) NOT NULL PRIMARY KEY, barang_id VARCHAR(30) NOT NULL,
    dari_ruangan_id VARCHAR(30) NULL, ke_ruangan_id VARCHAR(30) NOT NULL, tanggal DATE NOT NULL,
    alasan VARCHAR(255) NULL, oleh VARCHAR(191) NULL, created_by VARCHAR(30) NULL,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    KEY idx_inv_mutasi_barang (barang_id),
    CONSTRAINT fk_inv_mutasi_barang FOREIGN KEY (barang_id) REFERENCES inv_barang(id) ON DELETE CASCADE,
    CONSTRAINT fk_inv_mutasi_dari FOREIGN KEY (dari_ruangan_id) REFERENCES inv_ruangan(id) ON DELETE SET NULL,
    CONSTRAINT fk_inv_mutasi_ke FOREIGN KEY (ke_ruangan_id) REFERENCES inv_ruangan(id) ON DELETE RESTRICT
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
];

// Seed default (idempoten via INSERT IGNORE pada unique key) -------------------
const SEED_SATUAN = ["Unit", "Buah", "Set", "Pasang", "Lembar", "Paket", "Botol", "Box", "Roll"];
const SEED_KONDISI = [
  ["Baik", "B", "success", 1],
  ["Rusak Ringan", "RR", "warning", 2],
  ["Rusak Berat", "RB", "danger", 3],
];
const SEED_SUMBER = [
  ["Dana Alokasi Umum", "DAU"], ["Dana Alokasi Khusus", "DAK"], ["Hibah", "Hibah"],
  ["APBD", "APBD"], ["APBN", "APBN"], ["BLUD", "BLUD"],
];
const SEED_KATEGORI = [
  ["Alat Kesehatan", "ALKES"], ["Alat Kedokteran", "ALKED"], ["Mebel & Furniture", "MEBEL"],
  ["Alat Kantor & RT", "AKRT"], ["Elektronik & Komputer", "ELEKTRONIK"], ["Kendaraan", "KENDARAAN"],
  ["Lainnya", "LAIN"],
];
const SEED_RUANGAN = [
  ["DIR", "Direktur", "dr. Roynald Maramis", "198310272019031003"],
  ["OBG", "Poliklinik Obsgin", "Nova Pitoy, A.Md.Keb", "197711052008012024"],
  ["ICU", "ICU (Intensive Care Unit)", null, null],
];

const conn = await mariadb.createConnection({
  host: u.hostname, port: u.port ? Number(u.port) : 3306,
  user: decodeURIComponent(u.username), password: decodeURIComponent(u.password),
  database, connectTimeout: 10000, multipleStatements: false,
});

try {
  console.log(`Target DB: ${database} @ ${u.hostname}\n— Membuat tabel…`);
  for (const stmt of DDL) {
    const name = stmt.match(/inv_[a-z_]+/)[0];
    await conn.query(stmt);
    console.log(`  ✓ ${name}`);
  }

  console.log("— Seed referensi default…");
  for (let i = 0; i < SEED_SATUAN.length; i++) {
    await conn.query(`INSERT IGNORE INTO inv_satuan (id, nama, urutan) VALUES (?,?,?)`, [rid(), SEED_SATUAN[i], i + 1]);
  }
  for (const [nama, kode, tone, urutan] of SEED_KONDISI) {
    await conn.query(`INSERT IGNORE INTO inv_kondisi (id, nama, kode, tone, urutan) VALUES (?,?,?,?,?)`, [rid(), nama, kode, tone, urutan]);
  }
  for (let i = 0; i < SEED_SUMBER.length; i++) {
    await conn.query(`INSERT IGNORE INTO inv_sumber_anggaran (id, nama, singkatan, urutan) VALUES (?,?,?,?)`, [rid(), SEED_SUMBER[i][0], SEED_SUMBER[i][1], i + 1]);
  }
  for (let i = 0; i < SEED_KATEGORI.length; i++) {
    await conn.query(`INSERT IGNORE INTO inv_kategori (id, nama, kode, urutan) VALUES (?,?,?,?)`, [rid(), SEED_KATEGORI[i][0], SEED_KATEGORI[i][1], i + 1]);
  }
  for (let i = 0; i < SEED_RUANGAN.length; i++) {
    const [prefix, nama, pjNama, pjNip] = SEED_RUANGAN[i];
    await conn.query(`INSERT IGNORE INTO inv_ruangan (id, kode_prefix, nama, pj_nama, pj_nip, urutan) VALUES (?,?,?,?,?,?)`, [rid(), prefix, nama, pjNama, pjNip, i + 1]);
  }

  const tbls = ["inv_satuan", "inv_kondisi", "inv_sumber_anggaran", "inv_kategori", "inv_ruangan", "inv_barang", "inv_pemeliharaan", "inv_mutasi"];
  console.log("\n— Ringkasan baris:");
  for (const t of tbls) {
    const n = (await conn.query(`SELECT COUNT(*) n FROM ${t}`))[0].n;
    console.log(`  ${t.padEnd(20)} ${Number(n)}`);
  }
  console.log("\nSelesai.");
} finally {
  await conn.end();
}

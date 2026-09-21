// ============================================================================
// Migrasi ADITIF: Katalog Item (inv_item) + kolom inv_barang.item_id.
// DB APLIKASI `reporthub` (RW). BUKAN SIMGOS. Idempoten (cek information_schema).
// Jalankan via PowerShell (Bash sandbox tak menjangkau LAN DB):
//   & "C:\Program Files\nodejs\node.exe" scripts/db/migrate-inventaris-katalog.mjs
// Referensi manusiawi: scripts/db/inventaris-katalog.sql
// ============================================================================
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";

const PROJECT = "d:/.code/Reporthubrsb/reporthubrsb";
const require = createRequire(`${PROJECT}/package.json`);
const mariadb = require("mariadb");

function envUrl(name) {
  const txt = readFileSync(`${PROJECT}/.env`, "utf8");
  for (const line of txt.split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const m = t.match(new RegExp(`^${name}\\s*=\\s*["']?([^"']+)["']?`));
    if (m) return m[1];
  }
  return null;
}

const url = envUrl("DATABASE_URL_APP");
if (!url) throw new Error("DATABASE_URL_APP tidak ditemukan di .env");
const u = new URL(url);
const database = u.pathname.replace(/^\//, "");
if (database !== "reporthub") console.warn(`[peringatan] target DB = "${database}" (diharapkan "reporthub")`);

const conn = await mariadb.createConnection({
  host: u.hostname, port: u.port ? Number(u.port) : 3306,
  user: decodeURIComponent(u.username), password: decodeURIComponent(u.password),
  database, connectTimeout: 10000, multipleStatements: false,
});

async function columnExists(table, col) {
  const r = await conn.query(
    "SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=? AND TABLE_NAME=? AND COLUMN_NAME=? LIMIT 1",
    [database, table, col],
  );
  return r.length > 0;
}
async function indexExists(table, idx) {
  const r = await conn.query(
    "SELECT 1 FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=? AND TABLE_NAME=? AND INDEX_NAME=? LIMIT 1",
    [database, table, idx],
  );
  return r.length > 0;
}
async function fkExists(table, name) {
  const r = await conn.query(
    "SELECT 1 FROM information_schema.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA=? AND TABLE_NAME=? AND CONSTRAINT_NAME=? AND CONSTRAINT_TYPE='FOREIGN KEY' LIMIT 1",
    [database, table, name],
  );
  return r.length > 0;
}

try {
  console.log(`Target DB: ${database} @ ${u.hostname}\n— Katalog Item…`);

  await conn.query(`CREATE TABLE IF NOT EXISTS inv_item (
    id VARCHAR(30) NOT NULL PRIMARY KEY,
    nama VARCHAR(191) NOT NULL,
    nama_key VARCHAR(191) NOT NULL,
    kategori_id VARCHAR(30) NULL,
    satuan_id VARCHAR(30) NULL,
    spesifikasi TEXT NULL,
    aktif TINYINT(1) NOT NULL DEFAULT 1,
    created_by VARCHAR(30) NULL,
    updated_by VARCHAR(30) NULL,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    UNIQUE KEY uq_inv_item_key (nama_key),
    KEY idx_inv_item_kategori (kategori_id),
    KEY idx_inv_item_satuan (satuan_id),
    CONSTRAINT fk_inv_item_kategori FOREIGN KEY (kategori_id) REFERENCES inv_kategori(id) ON DELETE SET NULL,
    CONSTRAINT fk_inv_item_satuan FOREIGN KEY (satuan_id) REFERENCES inv_satuan(id) ON DELETE SET NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  console.log("  ✓ tabel inv_item");

  if (!(await columnExists("inv_barang", "item_id"))) {
    await conn.query("ALTER TABLE inv_barang ADD COLUMN item_id VARCHAR(30) NULL AFTER nama");
    console.log("  ✓ kolom inv_barang.item_id");
  } else console.log("  · kolom inv_barang.item_id sudah ada");

  if (!(await indexExists("inv_barang", "idx_inv_barang_item"))) {
    await conn.query("ALTER TABLE inv_barang ADD INDEX idx_inv_barang_item (item_id)");
    console.log("  ✓ index idx_inv_barang_item");
  } else console.log("  · index idx_inv_barang_item sudah ada");

  if (!(await fkExists("inv_barang", "fk_inv_barang_item"))) {
    await conn.query("ALTER TABLE inv_barang ADD CONSTRAINT fk_inv_barang_item FOREIGN KEY (item_id) REFERENCES inv_item(id) ON DELETE SET NULL");
    console.log("  ✓ FK fk_inv_barang_item");
  } else console.log("  · FK fk_inv_barang_item sudah ada");

  const n = (await conn.query("SELECT COUNT(*) n FROM inv_item"))[0].n;
  console.log(`\n— inv_item baris: ${Number(n)}\nSelesai.`);
} finally {
  await conn.end();
}

// ============================================================================
// Migrasi ADITIF: petugas ruangan (akun ↔ ruangan) untuk Checklist Pemeliharaan
//   inv_ruangan_petugas (PK ruangan_id+user_id; FK ke inv_ruangan & users)
// DB APLIKASI `reporthub` (RW). BUKAN SIMGOS. Idempoten & AMAN diulang.
// Jalankan:
//   dev (host): node scripts/db/migrate-inventaris-petugas.mjs
//   produksi (Docker): via service `migrate` — lihat migrate-inventaris-all.mjs
// Referensi manusiawi: scripts/db/inventaris-petugas.sql
//
// Kolasi & tipe kolom kunci DISALIN dari kolom yang dirujuk (information_schema):
// inv_ruangan.id dan users.id berbeda kolasi, dan FK hanya bisa dibuat bila
// kolasinya sama persis.
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

/** Tipe, charset & kolasi kolom rujukan — divalidasi ketat sebelum masuk DDL. */
async function kolomRujukan(tabel, kolom) {
  const [r] = await conn.query(
    `SELECT COLUMN_TYPE t, CHARACTER_SET_NAME cs, COLLATION_NAME co
       FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=? AND TABLE_NAME=? AND COLUMN_NAME=?`,
    [database, tabel, kolom],
  );
  if (!r) throw new Error(`Kolom ${tabel}.${kolom} tidak ditemukan — jalankan migrasi dasar dulu`);
  if (!/^varchar\(\d{1,3}\)$/i.test(r.t)) throw new Error(`Tipe ${tabel}.${kolom} tak terduga: ${r.t}`);
  if (!/^[a-z0-9]+$/i.test(r.cs) || !/^[a-z0-9_]+$/i.test(r.co)) {
    throw new Error(`Charset/kolasi ${tabel}.${kolom} tak terduga: ${r.cs}/${r.co}`);
  }
  return { tipe: r.t, cs: r.cs, co: r.co };
}

try {
  console.log(`Target DB: ${database} @ ${u.hostname}\n— Petugas ruangan…`);

  const ru = await kolomRujukan("inv_ruangan", "id");
  const us = await kolomRujukan("users", "id");
  console.log(`  · inv_ruangan.id = ${ru.tipe} ${ru.co}`);
  console.log(`  · users.id       = ${us.tipe} ${us.co}`);

  await conn.query(`CREATE TABLE IF NOT EXISTS inv_ruangan_petugas (
    ruangan_id ${ru.tipe} CHARACTER SET ${ru.cs} COLLATE ${ru.co} NOT NULL,
    user_id ${us.tipe} CHARACTER SET ${us.cs} COLLATE ${us.co} NOT NULL,
    dibuat_oleh VARCHAR(191) NULL,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (ruangan_id, user_id),
    KEY idx_inv_ruangan_petugas_user (user_id),
    CONSTRAINT fk_inv_ruangan_petugas_ruangan FOREIGN KEY (ruangan_id) REFERENCES inv_ruangan(id) ON DELETE CASCADE,
    CONSTRAINT fk_inv_ruangan_petugas_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  console.log("  ✓ tabel inv_ruangan_petugas");

  // Pengaman: kedua FK harus benar-benar ada (tabel lama tanpa FK = gagal keras).
  const fk = await conn.query(
    `SELECT CONSTRAINT_NAME n FROM information_schema.REFERENTIAL_CONSTRAINTS
      WHERE CONSTRAINT_SCHEMA=? AND TABLE_NAME='inv_ruangan_petugas'`,
    [database],
  );
  const ada = new Set(fk.map((r) => r.n));
  for (const n of ["fk_inv_ruangan_petugas_ruangan", "fk_inv_ruangan_petugas_user"]) {
    if (!ada.has(n)) throw new Error(`FK ${n} tidak ada pada inv_ruangan_petugas`);
  }
  console.log("  ✓ FK ke inv_ruangan & users (ON DELETE CASCADE)");

  const n = (await conn.query("SELECT COUNT(*) n FROM inv_ruangan_petugas"))[0].n;
  console.log(`\n— pemetaan petugas: ${Number(n)}\nSelesai.`);
} finally {
  await conn.end();
}

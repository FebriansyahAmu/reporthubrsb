// ============================================================================
// Migrasi FORM RM TERPADU (isian v2) → DB APLIKASI `reporthub` (RW). BUKAN SIMGOS.
// Idempoten: hanya CREATE TABLE IF NOT EXISTS (tanpa DROP → AMAN diulang).
// DDL dibaca dari scripts/db/form-rm.sql (SUMBER TUNGGAL, tak diduplikasi).
// Portabel + env-first (process.env.DATABASE_URL_APP dulu, fallback file .env).
// Jalankan:
//   dev (host):        node scripts/db/migrate-form-rm.mjs
//   produksi (Docker): docker compose run --rm migrate scripts/db/migrate-form-rm.mjs
// ============================================================================
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "../..");
const require = createRequire(import.meta.url);
const mariadb = require("mariadb");

/** Tabel yang WAJIB ada setelah migrasi (urutan = urutan FK). */
const TABLES = ["form_rm_isian", "form_rm_ttd", "form_rm_revisi", "form_rm_identitas_sementara"];

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

/** Pecah file SQL jadi statement: buang komentar `--`, pisah di `;` akhir baris. */
function statements(sql) {
  return sql
    .split(/\r?\n/)
    .map((l) => l.replace(/--.*$/, "").trimEnd())
    .join("\n")
    .split(/;\s*(?:\n|$)/)
    .map((s) => s.trim())
    .filter(Boolean);
}

const url = envUrl("DATABASE_URL_APP");
if (!url) throw new Error("DATABASE_URL_APP tidak ditemukan (process.env atau .env)");
const u = new URL(url);
const database = u.pathname.replace(/^\//, "");
if (database !== "reporthub") console.warn(`[peringatan] target DB = "${database}" (diharapkan "reporthub")`);

const ddl = statements(readFileSync(resolve(HERE, "form-rm.sql"), "utf8"));
// Pagar pengaman: file ini hanya boleh berisi CREATE TABLE IF NOT EXISTS.
for (const s of ddl) {
  if (!/^CREATE TABLE IF NOT EXISTS\s/i.test(s)) throw new Error(`Statement tak diizinkan di migrasi idempoten:\n${s.slice(0, 120)}`);
}

const conn = await mariadb.createConnection({
  host: u.hostname, port: u.port ? Number(u.port) : 3306,
  user: decodeURIComponent(u.username), password: decodeURIComponent(u.password),
  database, connectTimeout: 10000, multipleStatements: false,
});

try {
  console.log(`Target DB: ${database} @ ${u.hostname}\n— Membuat tabel Form RM (isian v2)…`);
  for (const stmt of ddl) {
    const name = stmt.match(/EXISTS\s+`?([a-z_]+)`?/i)[1];
    await conn.query(stmt);
    console.log(`  ✓ ${name}`);
  }

  console.log("\n— Ringkasan baris:");
  for (const t of TABLES) {
    const n = (await conn.query(`SELECT COUNT(*) n FROM ${t}`))[0].n;
    console.log(`  ${t.padEnd(28)} ${Number(n)}`);
  }
  console.log("\nSelesai.");
} finally {
  await conn.end();
}

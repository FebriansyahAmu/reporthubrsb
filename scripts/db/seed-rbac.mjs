// ============================================================================
// Migrasi + seed RBAC untuk DB APLIKASI `reporthub` (READ-WRITE). BUKAN SIMGOS.
// Idempoten & aman diulang: CREATE TABLE IF NOT EXISTS, ADD COLUMN kondisional,
// INSERT ... ON DUPLICATE KEY. Menjalankan:
//   1) buat tabel roles / role_permissions / audit_log
//   2) tambah kolom RBAC + profil di users (bila belum ada)
//   3) seed 3 peran sistem + grant awal operator/viewer
//   4) backfill users.role_id dari enum lama; must_change_password=0 utk user lama
//   5) role_id NOT NULL + FK (setelah backfill)
//
// Jalankan via PowerShell (Bash sandbox tak menjangkau LAN DB):
//   & "C:\Program Files\nodejs\node.exe" scripts/db/seed-rbac.mjs
// ============================================================================
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import crypto from "node:crypto";

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
if (database !== "reporthub") {
  // Penjaga ekstra: pastikan target = DB aplikasi, bukan tak sengaja SIMGOS.
  console.warn(`[peringatan] target DB = "${database}" (diharapkan "reporthub")`);
}

const rid = (p) => `${p}_${crypto.randomBytes(10).toString("hex")}`; // id acak <=30 char

// --- Katalog grant awal (samakan dgn src/server/rbac/modules.ts) ---
const GRANTS = {
  operator: [
    "kunjungan:view",
    "monitoring.antrean-bpjs:view", "monitoring.antrean-bpjs:update",
    "monitoring.pelayanan:view",
    "berkas-klaim:view", "berkas-klaim:create", "berkas-klaim:update", "berkas-klaim:print",
    "form-rm:view", "form-rm:create", "form-rm:update", "form-rm:print",
    "laporan:view", "laporan:print",
  ],
  viewer: [
    "kunjungan:view",
    "monitoring.antrean-bpjs:view",
    "monitoring.pelayanan:view",
    "laporan:view",
  ],
};

const conn = await mariadb.createConnection({
  host: u.hostname, port: u.port ? Number(u.port) : 3306,
  user: decodeURIComponent(u.username), password: decodeURIComponent(u.password),
  database, connectTimeout: 10000, multipleStatements: false,
});

async function columnExists(table, column) {
  const r = await conn.query(
    "SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=? AND TABLE_NAME=? AND COLUMN_NAME=? LIMIT 1",
    [database, table, column],
  );
  return r.length > 0;
}
async function constraintExists(name) {
  const r = await conn.query(
    "SELECT 1 FROM information_schema.TABLE_CONSTRAINTS WHERE TABLE_SCHEMA=? AND CONSTRAINT_NAME=? LIMIT 1",
    [database, name],
  );
  return r.length > 0;
}
async function addColumnIfMissing(table, column, ddl) {
  if (await columnExists(table, column)) { console.log(`  · ${table}.${column} sudah ada`); return; }
  await conn.query(`ALTER TABLE ${table} ADD COLUMN ${ddl}`);
  console.log(`  + ${table}.${column} ditambahkan`);
}

try {
  console.log(`DB = ${database}\n`);

  // 1) Tabel
  console.log("== 1. Tabel RBAC ==");
  await conn.query(`CREATE TABLE IF NOT EXISTS roles (
    id VARCHAR(30) NOT NULL PRIMARY KEY,
    \`key\` VARCHAR(40) NOT NULL,
    name VARCHAR(80) NOT NULL,
    description VARCHAR(255) NULL,
    is_system TINYINT(1) NOT NULL DEFAULT 0,
    is_superadmin TINYINT(1) NOT NULL DEFAULT 0,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    UNIQUE KEY uq_roles_key (\`key\`)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
  await conn.query(`CREATE TABLE IF NOT EXISTS role_permissions (
    id VARCHAR(30) NOT NULL PRIMARY KEY,
    role_id VARCHAR(30) NOT NULL,
    module_key VARCHAR(60) NOT NULL,
    action VARCHAR(20) NOT NULL DEFAULT 'view',
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    UNIQUE KEY uq_role_module_action (role_id, module_key, action),
    KEY idx_rp_role (role_id),
    CONSTRAINT fk_rp_role FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
  await conn.query(`CREATE TABLE IF NOT EXISTS audit_log (
    id VARCHAR(30) NOT NULL PRIMARY KEY,
    actor_id VARCHAR(30) NULL,
    actor_name VARCHAR(191) NULL,
    action VARCHAR(60) NOT NULL,
    target_id VARCHAR(30) NULL,
    metadata JSON NULL,
    ip VARCHAR(64) NULL,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    KEY idx_audit_actor (actor_id),
    KEY idx_audit_action (action)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
  console.log("  ok\n");

  // 2) Kolom users
  console.log("== 2. Kolom users ==");
  await addColumnIfMissing("users", "role_id", "role_id VARCHAR(30) NULL AFTER password_hash");
  await addColumnIfMissing("users", "nik", "nik VARCHAR(16) NULL");
  await addColumnIfMissing("users", "nip", "nip VARCHAR(30) NULL");
  await addColumnIfMissing("users", "gelar_depan", "gelar_depan VARCHAR(30) NULL");
  await addColumnIfMissing("users", "gelar_belakang", "gelar_belakang VARCHAR(40) NULL");
  await addColumnIfMissing("users", "tanggal_lahir", "tanggal_lahir DATE NULL");
  await addColumnIfMissing("users", "agama", "agama VARCHAR(30) NULL");
  await addColumnIfMissing("users", "phone", "phone VARCHAR(20) NULL");
  await addColumnIfMissing("users", "must_change_password", "must_change_password TINYINT(1) NOT NULL DEFAULT 1");
  await addColumnIfMissing("users", "created_by", "created_by VARCHAR(30) NULL");
  await addColumnIfMissing("users", "updated_by", "updated_by VARCHAR(30) NULL");
  // Unique NIK (abaikan bila sudah ada)
  try { await conn.query("ALTER TABLE users ADD UNIQUE KEY uq_users_nik (nik)"); console.log("  + unique(nik)"); }
  catch (e) { if (!/Duplicate key name/i.test(e.message)) throw e; console.log("  · unique(nik) sudah ada"); }
  console.log("");

  // 3) Seed peran + grant
  console.log("== 3. Seed peran & grant ==");
  const roles = [
    { id: "role_admin",    key: "admin",    name: "Administrator", sys: 1, sa: 1, desc: "Akses penuh seluruh sistem (superadmin)." },
    { id: "role_operator", key: "operator", name: "Operator",      sys: 1, sa: 0, desc: "Operasional harian." },
    { id: "role_viewer",   key: "viewer",   name: "Viewer",        sys: 1, sa: 0, desc: "Hanya lihat." },
  ];
  const roleIdByKey = {};
  for (const r of roles) {
    await conn.query(
      `INSERT INTO roles (id, \`key\`, name, description, is_system, is_superadmin)
       VALUES (?,?,?,?,?,?)
       ON DUPLICATE KEY UPDATE name=VALUES(name), description=VALUES(description),
         is_system=VALUES(is_system), is_superadmin=VALUES(is_superadmin), updated_at=CURRENT_TIMESTAMP(3)`,
      [r.id, r.key, r.name, r.desc, r.sys, r.sa],
    );
    const row = await conn.query("SELECT id FROM roles WHERE `key`=?", [r.key]);
    roleIdByKey[r.key] = row[0].id;
    console.log(`  · peran ${r.key} (${roleIdByKey[r.key]})${r.sa ? " [superadmin]" : ""}`);
  }
  for (const [roleKey, list] of Object.entries(GRANTS)) {
    const roleId = roleIdByKey[roleKey];
    for (const ma of list) {
      const [moduleKey, action] = ma.split(":");
      await conn.query(
        `INSERT INTO role_permissions (id, role_id, module_key, action) VALUES (?,?,?,?)
         ON DUPLICATE KEY UPDATE action=VALUES(action)`,
        [rid("rp"), roleId, moduleKey, action],
      );
    }
    console.log(`  · grant ${roleKey}: ${list.length} izin`);
  }
  console.log("");

  // 4) Backfill role_id dari enum lama (bila kolom enum masih ada)
  console.log("== 4. Backfill role_id ==");
  if (await columnExists("users", "role")) {
    const map = [["ADMIN", "role_admin"], ["OPERATOR", "role_operator"], ["VIEWER", "role_viewer"]];
    for (const [enumVal, roleId] of map) {
      const r = await conn.query(
        "UPDATE users SET role_id=? WHERE role=? AND (role_id IS NULL OR role_id='')",
        [roleIdByKey[enumVal === "ADMIN" ? "admin" : enumVal === "OPERATOR" ? "operator" : "viewer"], enumVal],
      );
      if (Number(r.affectedRows) > 0) console.log(`  · ${enumVal} → ${roleId}: ${Number(r.affectedRows)} user`);
    }
  } else {
    console.log("  · kolom enum `role` tidak ada — lewati");
  }
  // Aman-kan sisa NULL → viewer (mestinya tak ada)
  const leftover = await conn.query(
    "UPDATE users SET role_id=? WHERE role_id IS NULL OR role_id=''", [roleIdByKey.viewer]);
  if (Number(leftover.affectedRows) > 0) console.log(`  · sisa NULL → viewer: ${Number(leftover.affectedRows)}`);
  // User lama tak dipaksa ganti sandi
  await conn.query("UPDATE users SET must_change_password=0 WHERE created_at < NOW()");
  console.log("  · must_change_password=0 utk user lama\n");

  // 5) role_id NOT NULL + FK
  console.log("== 5. Kunci role_id (NOT NULL + FK) ==");
  const anyNull = await conn.query("SELECT COUNT(*) AS n FROM users WHERE role_id IS NULL OR role_id=''");
  if (Number(anyNull[0].n) === 0) {
    await conn.query("ALTER TABLE users MODIFY role_id VARCHAR(30) NOT NULL");
    if (!(await constraintExists("fk_users_role"))) {
      await conn.query("ALTER TABLE users ADD CONSTRAINT fk_users_role FOREIGN KEY (role_id) REFERENCES roles(id)");
      console.log("  + FK fk_users_role");
    } else console.log("  · FK fk_users_role sudah ada");
    console.log("  · role_id NOT NULL");
  } else {
    console.log(`  ! masih ada ${Number(anyNull[0].n)} role_id NULL — lewati NOT NULL/FK`);
  }

  console.log("\nSELESAI. Verifikasi cepat:");
  const check = await conn.query(
    "SELECT u.username, u.role_id, r.`key` AS role_key, u.must_change_password " +
    "FROM users u LEFT JOIN roles r ON r.id=u.role_id");
  for (const c of check) console.log(`  - ${c.username}: ${c.role_key} (mcp=${c.must_change_password})`);
} finally {
  await conn.end();
}

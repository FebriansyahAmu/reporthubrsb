// Bangun installer bertanda tangan + siapkan paket rilis untuk server ReportHub.
//
//   npm run rilis -- [--catatan "Perbaikan ..."] [--pasang-ke <STORAGE_DIR>]
//
// Kunci tanda tangan dibaca dari env TAURI_SIGNING_PRIVATE_KEY (+ _PASSWORD), atau
// dari %USERPROFILE%\.tauri\audittrail-rsboltim.key(.password). Kunci privat TIDAK
// pernah ditulis ke repo maupun ke folder rilis. Alamat server bawaan installer
// diambil dari env REPORTHUB_URL (opsional; tanpa itu wajib berkas reporthub.json).
//
// Hasil: desktop/rilis/<versi>/{rilis.json, <installer>.exe}. Salin isinya ke folder
// `storage/desktop/` server ReportHub (atau pakai --pasang-ke untuk menyalin langsung).
import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DESKTOP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const conf = JSON.parse(readFileSync(path.join(DESKTOP, "src-tauri", "tauri.conf.json"), "utf8"));
const versi = conf.version;
if (!/^\d{1,4}\.\d{1,4}\.\d{1,4}$/.test(versi)) throw new Error(`version di tauri.conf.json tidak sah: ${versi}`);

const arg = (nama) => {
  const i = process.argv.indexOf(nama);
  return i > 0 ? process.argv[i + 1] : undefined;
};
const catatan = (arg("--catatan") ?? "").slice(0, 2000);
const pasangKe = arg("--pasang-ke");

// Kunci tanda tangan: env lebih dulu, lalu lokasi bawaan di profil pengguna.
const env = { ...process.env };
if (!env.TAURI_SIGNING_PRIVATE_KEY) {
  const kunci = path.join(homedir(), ".tauri", "audittrail-rsboltim.key");
  if (!existsSync(kunci)) throw new Error(`Kunci tanda tangan tidak ditemukan (${kunci}). Lihat docs/desktop-tauri.md.`);
  env.TAURI_SIGNING_PRIVATE_KEY = readFileSync(kunci, "utf8");
  const sandi = `${kunci}.password`;
  if (!env.TAURI_SIGNING_PRIVATE_KEY_PASSWORD && existsSync(sandi)) env.TAURI_SIGNING_PRIVATE_KEY_PASSWORD = readFileSync(sandi, "utf8").trim();
}
if (env.REPORTHUB_URL) console.log(`Alamat server bawaan: ${env.REPORTHUB_URL}`);
else console.log("REPORTHUB_URL kosong → installer butuh berkas reporthub.json di folder aplikasi.");

console.log(`Membangun AuditTrail RS BOLTIM ${versi} …`);
// Perintah tetap tanpa argumen dari luar (npx di Windows = berkas .cmd → butuh shell).
const build = spawnSync("npx tauri build", { cwd: DESKTOP, env, stdio: "inherit", shell: true });
if (build.status !== 0) process.exit(build.status ?? 1);

const nsis = path.join(DESKTOP, "src-tauri", "target", "release", "bundle", "nsis");
const exe = readdirSync(nsis).find((f) => f.endsWith(`_${versi}_x64-setup.exe`));
if (!exe || !existsSync(path.join(nsis, `${exe}.sig`))) throw new Error(`Installer/tanda tangan ${versi} tidak ditemukan di ${nsis}`);

// Nama berkas tanpa spasi (aman di URL & sesuai pola validasi server).
const berkas = `audittrail-rsboltim_${versi}_x64-setup.exe`;
const keluar = path.join(DESKTOP, "rilis", versi);
mkdirSync(keluar, { recursive: true });
copyFileSync(path.join(nsis, exe), path.join(keluar, berkas));
const manifest = {
  versi,
  ...(catatan ? { catatan } : {}),
  terbit: new Date().toISOString(),
  platform: {
    "windows-x86_64": { berkas, tandaTangan: readFileSync(path.join(nsis, `${exe}.sig`), "utf8").trim() },
  },
};
writeFileSync(path.join(keluar, "rilis.json"), `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`\nPaket rilis siap: ${keluar}`);

if (pasangKe) {
  const tujuan = path.join(path.resolve(pasangKe), "desktop");
  mkdirSync(tujuan, { recursive: true });
  copyFileSync(path.join(keluar, berkas), path.join(tujuan, berkas));
  // Manifest terakhir & atomik: klien tak pernah melihat manifest yang menunjuk installer yang belum tersalin.
  const sementara = path.join(tujuan, `rilis.json.${process.pid}.tmp`);
  copyFileSync(path.join(keluar, "rilis.json"), sementara);
  renameSync(sementara, path.join(tujuan, "rilis.json"));
  console.log(`Disalin ke ${tujuan} — aplikasi terpasang akan menawarkan pembaruan saat dibuka.`);
} else {
  console.log("Salin installer LALU rilis.json ke folder storage/desktop/ di server ReportHub.");
}

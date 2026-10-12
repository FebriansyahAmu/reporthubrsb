// Bangun installer bertanda tangan + siapkan paket rilis untuk server ReportHub.
//
//   npm run rilis -- [--catatan "Perbaikan ..."] [--pasang-ke <STORAGE_DIR>] [--cek]
//   (--cek: periksa kunci tanda tangan, alamat server, & pin sertifikat saja, tanpa membangun)
//
// Server HTTPS ber-sertifikat self-signed: isi REPORTHUB_CERT_SHA256 (sidik SHA-256
// sertifikat server, pisah koma bila >1) di .env — ditanam ke exe sebagai pin.
//
// Kunci tanda tangan dibaca dari env TAURI_SIGNING_PRIVATE_KEY (+ _PASSWORD), atau
// dari %USERPROFILE%\.tauri\audittrail-rsboltim.key(.password). Kunci privat TIDAK
// pernah ditulis ke repo maupun ke folder rilis. Alamat server bawaan installer =
// REPORTHUB_URL: env sesi (mis. `$env:REPORTHUB_URL = …`) bila diisi, selain itu dari
// `.env` proyek. Hanya kunci itu yang diambil dari `.env` — rahasia server lain tidak
// pernah masuk ke proses build. Kosong → installer wajib berkas reporthub.json.
//
// Hasil: desktop/rilis/<versi>/{rilis.json, <installer>.exe}. Salin isinya ke folder
// `storage/desktop/` server ReportHub (atau pakai --pasang-ke untuk menyalin langsung).
import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import net from "node:net";
import { homedir } from "node:os";
import tls from "node:tls";
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
/** Nilai satu kunci dari `.env` proyek (tanpa memuat kunci lain). */
function dariDotEnv(kunci) {
  const berkas = path.join(DESKTOP, "..", ".env");
  if (!existsSync(berkas)) return undefined;
  for (const baris of readFileSync(berkas, "utf8").split(/\r?\n/)) {
    const m = new RegExp(`^\\s*${kunci}\\s*=\\s*(.*?)\\s*$`).exec(baris);
    if (m) return m[1].replace(/^(["'])(.*)\1$/, "$2");
  }
  return undefined;
}
const nilai = (kunci) => (process.env[kunci] ?? dariDotEnv(kunci) ?? "").trim();

/** Aturan yang sama dengan `konfigurasi::urai_alamat` (Rust): origin http(s) murni. */
function originMurni(teks) {
  let u;
  try {
    u = new URL(teks);
  } catch {
    return null;
  }
  const sah = (u.protocol === "http:" || u.protocol === "https:") && u.hostname && !u.username && !u.password && u.pathname === "/" && !u.search && !u.hash && !teks.includes("?") && !teks.includes("#");
  return sah ? u.origin : null;
}

const alamat = nilai("REPORTHUB_URL");
if (alamat) {
  const origin = originMurni(alamat);
  if (!origin) throw new Error(`REPORTHUB_URL tidak sah: "${alamat}" — harus origin saja, mis. http://10.0.0.5:3000 (tanpa path).`);
  env.REPORTHUB_URL = origin;
  console.log(`Alamat server bawaan: ${origin}${process.env.REPORTHUB_URL ? " (env sesi)" : " (.env)"}`);
  // Pembaruan otomatis mengunduh paket dari URL yang dibuat server dari origin publiknya.
  const publik = originMurni(nilai("PUBLIC_APP_ORIGIN") || nilai("SIGN_PUBLIC_ORIGIN"));
  if (publik && publik !== origin) {
    console.warn(`PERINGATAN: REPORTHUB_URL (${origin}) ≠ origin publik server (${publik}). Samakan di .env server produksi,\n  kalau tidak aplikasi terpasang gagal mengunduh pembaruan.`);
  }
} else {
  delete env.REPORTHUB_URL;
  console.log("REPORTHUB_URL kosong → installer butuh berkas reporthub.json di folder aplikasi.");
}
// --- Pin sertifikat HTTPS (server self-signed) — sidik SHA-256 sertifikat server.
/** Sidik SHA-256 sertifikat yang sedang disajikan server (tanpa memercayainya — hanya dibaca). */
function sidikServer(origin) {
  const u = new URL(origin);
  return new Promise((selesai) => {
    const s = tls.connect({ host: u.hostname, port: Number(u.port) || 443, servername: net.isIP(u.hostname) ? undefined : u.hostname, rejectUnauthorized: false, timeout: 10_000 }, () => {
      const c = s.getPeerCertificate();
      selesai({ sidik: c?.fingerprint256?.replace(/:/g, "").toLowerCase() ?? null, dipercaya: s.authorized, subjek: c?.subject?.CN, berlaku: c?.valid_to });
      s.end();
    });
    s.on("error", (e) => selesai({ galat: e.message }));
    s.on("timeout", () => { s.destroy(); selesai({ galat: "batas waktu" }); });
  });
}
const pinMentah = nilai("REPORTHUB_CERT_SHA256");
const pin = pinMentah.split(",").map((p) => p.replace(/[:\s]/g, "").toLowerCase()).filter(Boolean);
if (pin.some((p) => !/^[0-9a-f]{64}$/.test(p))) throw new Error("REPORTHUB_CERT_SHA256 tidak sah — daftar sidik SHA-256 (64 digit hex) dipisah koma.");
if (pin.length) {
  if (!env.REPORTHUB_URL?.startsWith("https://")) throw new Error("REPORTHUB_CERT_SHA256 hanya untuk REPORTHUB_URL https://");
  env.REPORTHUB_CERT_SHA256 = pin.join(",");
  console.log(`Pin sertifikat: ${pin.length} sidik SHA-256`);
} else {
  delete env.REPORTHUB_CERT_SHA256;
}
if (env.REPORTHUB_URL?.startsWith("https://") && (process.argv.includes("--cek") || process.argv.includes("--sidik"))) {
  const s = await sidikServer(env.REPORTHUB_URL);
  if (s.galat) console.warn(`PERINGATAN: sertifikat server tak terbaca (${s.galat}).`);
  else {
    console.log(`Sertifikat server: CN=${s.subjek}, berlaku s.d. ${s.berlaku}, dipercaya Windows/Node: ${s.dipercaya ? "ya" : "TIDAK"}\n  SHA-256: ${s.sidik}`);
    if (!s.dipercaya && !pin.length) console.warn("PERINGATAN: sertifikat tak dipercaya & REPORTHUB_CERT_SHA256 kosong → aplikasi tidak bisa membuka server.\n  Verifikasi sidik di atas di server, lalu isi REPORTHUB_CERT_SHA256 di .env.");
    if (pin.length && !pin.includes(s.sidik)) console.warn("PERINGATAN: sertifikat server SAAT INI tidak cocok dengan REPORTHUB_CERT_SHA256 → aplikasi akan menolaknya.");
    if (pin.length && pin.includes(s.sidik)) console.log("Sertifikat server cocok dengan pin.");
  }
}
if (process.argv.includes("--cek") || process.argv.includes("--sidik")) {
  console.log("Pemeriksaan selesai: kunci tanda tangan & alamat server siap; tidak membangun.");
  process.exit(0);
}

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

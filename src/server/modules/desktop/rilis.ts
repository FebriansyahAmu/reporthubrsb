import "server-only";
import { asalPublik } from "@/server/lib/public-origin";
import { bacaBerkas } from "@/server/lib/storage";
import { BERKAS_RE, jawabanPembaruan, manifestSchema, type ManifestRilis, type ParamPembaruan } from "./rilis.skema";

/**
 * Rilis aplikasi desktop (Tauri) yang disajikan server ReportHub sendiri
 * (PRD Form RM Terpadu §12): manifest `STORAGE_DIR/desktop/rilis.json` +
 * installer bertanda tangan di folder yang sama, ditulis oleh
 * `desktop/scripts/rilis.mjs`. Endpoint-nya publik (updater tak membawa cookie),
 * jadi masukan divalidasi ketat dan hanya berkas yang tercantum di manifest yang
 * bisa diunduh. Integritas paket dijamin tanda tangan minisign yang diverifikasi
 * aplikasi dengan kunci publik bawaannya — bukan oleh server.
 */

const FOLDER_RILIS = "desktop";
const BERKAS_MANIFEST = `${FOLDER_RILIS}/rilis.json`;

/** Manifest rilis tersimpan; null bila belum ada atau tidak sah (dicatat, tak pernah dilempar ke klien). */
export async function bacaManifest(): Promise<ManifestRilis | null> {
  const bytes = await bacaBerkas(BERKAS_MANIFEST);
  if (!bytes) return null;
  try {
    const hasil = manifestSchema.safeParse(JSON.parse(Buffer.from(bytes).toString("utf8")));
    if (hasil.success) return hasil.data;
    console.error("[desktop] rilis.json tidak sesuai skema — diabaikan");
  } catch {
    console.error("[desktop] rilis.json bukan JSON — diabaikan");
  }
  return null;
}

export async function cekPembaruan(p: ParamPembaruan) {
  const m = await bacaManifest();
  if (!m) return null;
  // URL unduhan dari konfigurasi, bukan header Host (cegah host-header injection).
  const asal = asalPublik();
  if (!asal) {
    console.error("[desktop] PUBLIC_APP_ORIGIN/SIGN_PUBLIC_ORIGIN kosong — URL unduhan pembaruan tak bisa dibuat");
    return null;
  }
  return jawabanPembaruan(m, p, asal);
}

/** Installer Windows x64 terbaru (alias unduhan `terbaru`), atau null. */
export async function berkasTerbaru(): Promise<string | null> {
  return (await bacaManifest())?.platform["windows-x86_64"]?.berkas ?? null;
}

/** Versi installer Windows x64 terbaru untuk tombol unduh di halaman masuk, atau null. */
export async function rilisWindowsTerbaru(): Promise<{ versi: string; terbit: string } | null> {
  const m = await bacaManifest();
  return m?.platform["windows-x86_64"] ? { versi: m.versi, terbit: m.terbit } : null;
}

/** Ada rilis yang bisa diunduh (menampilkan menu "Unduh aplikasi desktop"). */
export async function adaRilisDesktop(): Promise<boolean> {
  return (await berkasTerbaru()) !== null;
}

/** Hanya berkas yang tercantum di manifest rilis saat ini yang boleh diunduh. */
export async function bacaInstaller(berkas: string): Promise<Uint8Array | null> {
  if (!BERKAS_RE.test(berkas)) return null;
  const m = await bacaManifest();
  if (!m || !Object.values(m.platform).some((p) => p?.berkas === berkas)) return null;
  return bacaBerkas(`${FOLDER_RILIS}/${berkas}`);
}

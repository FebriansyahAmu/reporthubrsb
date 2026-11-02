import "server-only";
import { NotFoundError, ValidationError } from "@/server/lib/errors";
import { infoGambar, type MimeGambar } from "@/server/lib/info-gambar";
import { bacaBerkas, daftarBerkas, hapusBerkas, hapusFolderJikaKosong, sha256, simpanBerkas } from "@/server/lib/storage";
import { AVATAR } from "./bckh.constants";

/**
 * Foto profil BCKH — berkas di folder penyimpanan aplikasi (`STORAGE_DIR`), BUKAN
 * kolom DB (tabel bckh_* tidak diubah) dan bukan `public`; dilayani lewat route
 * berizin. Satu folder per pengguna:
 *
 *   bckh/avatar/<userId>/<versi>.<ext>
 *
 * `versi` = 16 heks pertama SHA-256 isi (URL `?v=` → cache permanen). Berkas
 * terbaru (mtime) = foto aktif; berkas lama dihapus setelah foto baru tertulis.
 * Tanpa berkas → identicon.
 */

const AKAR = "bckh/avatar";
const NAMA_RE = /^([0-9a-f]{16})\.(jpg|png|webp)$/;
const EKSTENSI: Record<MimeGambar, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

/** Satu segmen path yang aman (id akun cuid); selain itu dianggap tidak ada. */
function folder(userId: string): string {
  if (!/^[A-Za-z0-9_-]{1,191}$/.test(userId)) throw new NotFoundError("Pengguna tidak ditemukan");
  return `${AKAR}/${userId}`;
}

const galat = (pesan: string) => new ValidationError({ formErrors: [], fieldErrors: { avatar: [pesan] } });

async function berkasAktif(userId: string): Promise<{ nama: string; versi: string } | null> {
  let aktif: { nama: string; versi: string; diubahMs: number } | null = null;
  for (const f of await daftarBerkas(folder(userId))) {
    const m = NAMA_RE.exec(f.nama);
    if (m && (!aktif || f.diubahMs > aktif.diubahMs)) aktif = { nama: f.nama, versi: m[1], diubahMs: f.diubahMs };
  }
  return aktif;
}

/** Versi foto aktif; null = belum ada (atau penyimpanan tak terbaca — profil tetap tampil dengan identicon). */
export async function versiAvatar(userId: string): Promise<string | null> {
  try {
    return (await berkasAktif(userId))?.versi ?? null;
  } catch (e) {
    console.error("[bckh.avatar] gagal membaca folder foto", e);
    return null;
  }
}

/** Pasang/ganti foto profil SENDIRI. Gambar diperiksa dari isinya (jenis, ukuran, dimensi). */
export async function simpanAvatar(userId: string, bytes: Uint8Array): Promise<{ avatar: string }> {
  if (bytes.byteLength === 0) throw galat("Foto kosong.");
  if (bytes.byteLength > AVATAR.maksByte) throw galat(`Foto melebihi ${AVATAR.maksByte / 1024} KB.`);
  const info = infoGambar(bytes);
  if (!info) throw galat("Foto harus berupa gambar JPG, PNG, atau WebP.");
  if (info.lebar < 1 || info.tinggi < 1 || info.lebar > AVATAR.maksSisi || info.tinggi > AVATAR.maksSisi) {
    throw galat(`Dimensi foto maksimal ${AVATAR.maksSisi} × ${AVATAR.maksSisi} piksel.`);
  }

  const dir = folder(userId);
  const versi = sha256(bytes).slice(0, 16);
  const nama = `${versi}.${EKSTENSI[info.mime]}`;
  // Ditulis ulang walau sudah ada → mtime terbaru = foto aktif (pasang ulang foto lama).
  await simpanBerkas(`${dir}/${nama}`, bytes);

  // Hapus foto yang LEBIH LAMA saja: dua unggahan bersamaan tak saling menghapus.
  const daftar = await daftarBerkas(dir);
  const baru = daftar.find((f) => f.nama === nama);
  await Promise.all(
    daftar
      .filter((f) => f.nama !== nama && NAMA_RE.test(f.nama) && (!baru || f.diubahMs <= baru.diubahMs))
      .map((f) => hapusBerkas(`${dir}/${f.nama}`)),
  );
  return { avatar: versi };
}

/** Lepas foto profil SENDIRI (idempoten) → kembali ke identicon. */
export async function hapusAvatar(userId: string): Promise<{ avatar: null }> {
  const dir = folder(userId);
  for (const f of await daftarBerkas(dir)) if (NAMA_RE.test(f.nama)) await hapusBerkas(`${dir}/${f.nama}`);
  await hapusFolderJikaKosong(dir);
  return { avatar: null };
}

export async function bacaAvatar(userId: string): Promise<{ bytes: Uint8Array; mime: MimeGambar; versi: string }> {
  const aktif = await berkasAktif(userId);
  const bytes = aktif ? await bacaBerkas(`${folder(userId)}/${aktif.nama}`) : null;
  if (!aktif || !bytes) throw new NotFoundError("Belum ada foto profil.");
  const info = infoGambar(bytes);
  if (!info) throw new Error(`Berkas foto profil rusak: ${aktif.nama}`);
  return { bytes, mime: info.mime, versi: aktif.versi };
}

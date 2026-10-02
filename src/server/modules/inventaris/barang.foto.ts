import "server-only";
import { getAppDb } from "@/server/db/app.client";
import type { SessionUser } from "@/server/auth/session";
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from "@/server/lib/errors";
import { adaBerkas, bacaBerkas, hapusBerkas, hapusFolderJikaKosong, sha256, simpanBerkas } from "@/server/lib/storage";
import { FOTO_BARANG } from "./barang.schema";

/**
 * Foto unit aset. Berkas disimpan di folder penyimpanan aplikasi (`STORAGE_DIR`;
 * di produksi folder `./storage` di samping docker-compose.yml) — BUKAN di DB
 * atau `public` — dan hanya dilayani lewat route berizin. Satu folder per kode
 * barang (kode permanen) agar mudah dicari manual:
 *
 *   inventaris/foto/<KODE>/<versi>.<ext>          foto (≤ 2560 px)
 *   inventaris/foto/<KODE>/<versi>.thumb.<ext>    miniatur daftar
 *
 * `versi` = 16 heks pertama SHA-256 isi foto. Kolom `inv_barang.foto_url`
 * (sudah ada sejak Sesi 1) menyimpan path relatif foto.
 */

const AKAR = "inventaris/foto";
const KUNCI_RE = /^inventaris\/foto\/([A-Z0-9_-][A-Z0-9._-]{0,79})\/([0-9a-f]{16})\.(jpg|png|webp)$/;

export type MimeFoto = "image/jpeg" | "image/png" | "image/webp";
const EKSTENSI: Record<MimeFoto, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

const ascii = (b: Uint8Array, dari: number, sampai: number) => String.fromCharCode(...b.subarray(dari, sampai));

/** Jenis gambar dari magic bytes (bukan dari nama/Content-Type kiriman klien). */
export function deteksiMimeFoto(b: Uint8Array): MimeFoto | null {
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b.length >= 8 && ascii(b, 0, 8) === "\x89PNG\r\n\x1a\n") return "image/png";
  if (b.length >= 12 && ascii(b, 0, 4) === "RIFF" && ascii(b, 8, 12) === "WEBP") return "image/webp";
  return null;
}

/**
 * Nama folder dari kode barang — tepat satu segmen path yang aman: huruf besar,
 * selain A-Z 0-9 . - jadi "_" (mis. "02.06/ICU-1" → "02.06_ICU-1"), tak diawali
 * titik (menolak "." / ".." / folder tersembunyi).
 */
export function folderKode(kode: string): string {
  const f = kode.trim().toUpperCase().replace(/[^A-Z0-9.-]/g, "_").replace(/^\./, "_").slice(0, 80);
  return f || "_";
}

/** Versi foto untuk URL `?v=` — null bila tak berfoto / path di luar pola. */
export function versiFoto(kunci: string | null | undefined): string | null {
  const m = kunci ? KUNCI_RE.exec(kunci) : null;
  return m ? m[2] : null;
}

const pathThumb = (kunci: string, ext: string) => kunci.replace(/\.(jpg|png|webp)$/, `.thumb.${ext}`);
const SEMUA_EXT = Object.values(EKSTENSI);

const galat = (pesan: string) => new ValidationError({ formErrors: [], fieldErrors: { foto: [pesan] } });
const mb = (n: number) => `${Math.round(n / 1024 / 1024)} MB`;

function periksa(bytes: Uint8Array, maks: number, label: string): MimeFoto {
  if (bytes.byteLength === 0) throw galat(`${label} kosong.`);
  if (bytes.byteLength > maks) throw galat(`${label} melebihi ${maks >= 1024 * 1024 ? mb(maks) : `${maks / 1024} KB`}.`);
  const mime = deteksiMimeFoto(bytes);
  if (!mime) throw galat(`${label} harus berupa gambar JPG, PNG, atau WebP.`);
  return mime;
}

/**
 * Hapus berkas foto (+ miniatur) bila tak lagi dirujuk unit mana pun, lalu
 * folder kodenya bila kosong. Kegagalan hanya dicatat — data DB sudah benar,
 * berkas yatim tidak merusak apa pun.
 */
export async function bersihkanFotoYatim(kunci: string | null | undefined): Promise<void> {
  if (!kunci || !KUNCI_RE.test(kunci)) return;
  try {
    const masih = await getAppDb().invBarang.count({ where: { fotoUrl: kunci } });
    if (masih > 0) return;
    await Promise.all([hapusBerkas(kunci), ...SEMUA_EXT.map((ext) => hapusBerkas(pathThumb(kunci, ext)))]);
    await hapusFolderJikaKosong(kunci.slice(0, kunci.lastIndexOf("/")));
  } catch (e) {
    console.error("[inventaris.foto] gagal membersihkan berkas", kunci, e);
  }
}

/**
 * Pasang/ganti foto unit. `bolehGanti=false` (pengguna hanya berizin tambah)
 * hanya boleh memasang foto PERTAMA. Penulisan bersyarat pada `foto_url` lama
 * → dua unggahan bersamaan tidak saling menimpa diam-diam.
 */
export async function simpanFotoBarang(
  id: string,
  foto: Uint8Array,
  thumb: Uint8Array | null,
  user: SessionUser,
  opts: { bolehGanti: boolean },
): Promise<{ foto: string }> {
  const mime = periksa(foto, FOTO_BARANG.ukuranMaks, "Foto");
  const mimeThumb = thumb ? periksa(thumb, FOTO_BARANG.thumbMaks, "Miniatur foto") : null;

  const db = getAppDb();
  const row = await db.invBarang.findUnique({ where: { id }, select: { fotoUrl: true, kodeBarang: true } });
  if (!row) throw new NotFoundError("Barang tidak ditemukan.");
  if (row.fotoUrl && !opts.bolehGanti) throw new ForbiddenError("Mengganti foto memerlukan izin ubah barang.");

  const versi = sha256(foto).slice(0, 16);
  const kunci = `${AKAR}/${folderKode(row.kodeBarang)}/${versi}.${EKSTENSI[mime]}`;
  if (!(await adaBerkas(kunci))) await simpanBerkas(kunci, foto);
  if (thumb && mimeThumb) await simpanBerkas(pathThumb(kunci, EKSTENSI[mimeThumb]), thumb);
  if (row.fotoUrl === kunci) return { foto: versi }; // foto yang sama diunggah ulang

  const { count } = await db.invBarang.updateMany({
    where: { id, fotoUrl: row.fotoUrl },
    data: { fotoUrl: kunci, updatedBy: user.name },
  });
  if (count === 0) {
    await bersihkanFotoYatim(kunci);
    throw new ConflictError("Foto barang baru saja diubah pengguna lain. Muat ulang lalu coba lagi.");
  }
  await bersihkanFotoYatim(row.fotoUrl);
  return { foto: versi };
}

/** Lepas foto unit (idempoten). */
export async function hapusFotoBarang(id: string, user: SessionUser): Promise<{ foto: null }> {
  const db = getAppDb();
  const row = await db.invBarang.findUnique({ where: { id }, select: { fotoUrl: true } });
  if (!row) throw new NotFoundError("Barang tidak ditemukan.");
  if (!row.fotoUrl) return { foto: null };
  const { count } = await db.invBarang.updateMany({
    where: { id, fotoUrl: row.fotoUrl },
    data: { fotoUrl: null, updatedBy: user.name },
  });
  if (count === 0) throw new ConflictError("Foto barang baru saja diubah pengguna lain. Muat ulang lalu coba lagi.");
  await bersihkanFotoYatim(row.fotoUrl);
  return { foto: null };
}

/** Baca foto (asli / miniatur — miniatur jatuh ke foto bila tak ada). */
export async function bacaFotoBarang(
  id: string,
  ukuran: "asli" | "thumb",
): Promise<{ bytes: Uint8Array; mime: MimeFoto; versi: string; nama: string }> {
  const row = await getAppDb().invBarang.findUnique({ where: { id }, select: { fotoUrl: true, kodeBarang: true } });
  if (!row) throw new NotFoundError("Barang tidak ditemukan.");
  const versi = versiFoto(row.fotoUrl);
  if (!versi || !row.fotoUrl) throw new NotFoundError("Barang belum memiliki foto.");
  let bytes: Uint8Array | null = null;
  if (ukuran === "thumb") {
    for (const ext of SEMUA_EXT) if ((bytes = await bacaBerkas(pathThumb(row.fotoUrl, ext)))) break;
  }
  bytes ??= await bacaBerkas(row.fotoUrl);
  if (!bytes) throw new NotFoundError("Berkas foto tidak ditemukan di penyimpanan.");
  const mime = deteksiMimeFoto(bytes);
  if (!mime) throw new Error(`Berkas foto rusak: ${row.fotoUrl}`);
  return { bytes, mime, versi, nama: `Foto_${folderKode(row.kodeBarang)}.${EKSTENSI[mime]}` };
}

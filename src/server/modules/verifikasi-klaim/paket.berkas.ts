import "server-only";
import { degrees, PDFDocument, type PDFImage } from "pdf-lib";
import { ValidationError } from "@/server/lib/errors";
import { BATAS, type MimeLampiran } from "./verifikasi.constants";

/**
 * Berkas sisipan Paket Klaim: deteksi jenis dari TANDA TANGAN BERKAS (magic
 * bytes — ekstensi & MIME kiriman browser diabaikan), sanitasi nama, validasi
 * isi (PDF terbaca & tidak terenkripsi, gambar ter-decode), dan penempelan ke
 * PDF gabungan (gambar → satu halaman A4, orientasi EXIF kamera HP dihormati).
 */

const galat = (pesan: string) => new ValidationError({ formErrors: [], fieldErrors: { berkas: [pesan] } });

const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const awalan = (b: Uint8Array, sig: readonly number[]) => sig.every((x, i) => b[i] === x);

/** Jenis berkas dari magic bytes; `null` = tidak didukung. PDF boleh diawali sampah ≤ 1 KB (spesifikasi). */
export function deteksiMime(b: Uint8Array): MimeLampiran | null {
  if (awalan(b, PNG)) return "image/png";
  if (awalan(b, [0xff, 0xd8, 0xff])) return "image/jpeg";
  const kepala = Buffer.from(b.subarray(0, 1024)).toString("latin1");
  return kepala.includes("%PDF-") ? "application/pdf" : null;
}

export const EKSTENSI: Record<MimeLampiran, string> = {
  "application/pdf": "pdf",
  "image/png": "png",
  "image/jpeg": "jpg",
};

/** Nama tampilan aman: tanpa path, karakter kendali & karakter terlarang; dipotong. */
export function sanitasiNama(nama: string, mime: MimeLampiran): string {
  const dasar = nama.split(/[\\/]/).pop() ?? "";
  const bersih = dasar
    .normalize("NFC")
    .replace(/[\u0000-\u001f\u007f<>:"|?*]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^\.+/, "");
  const ext = `.${EKSTENSI[mime]}`;
  const inti = (bersih.toLowerCase().endsWith(ext) ? bersih.slice(0, -ext.length) : bersih.replace(/\.[a-z0-9]{1,5}$/i, "")).trim();
  return `${(inti || "sisipan").slice(0, BATAS.NAMA_BERKAS_MAKS - ext.length)}${ext}`;
}

/** Muat PDF sisipan: tolak PDF rusak / terenkripsi (halaman terenkripsi tak bisa disalin utuh). */
async function muatPdf(bytes: Uint8Array): Promise<PDFDocument> {
  try {
    return await PDFDocument.load(bytes, { updateMetadata: false });
  } catch (e) {
    if (e instanceof Error && /encrypt/i.test(`${e.name} ${e.message}`)) {
      throw galat("PDF terenkripsi / berkata sandi tidak didukung — cetak ulang ke PDF tanpa kata sandi");
    }
    throw galat("Berkas PDF rusak atau tidak dapat dibaca");
  }
}

async function tanamGambar(doc: PDFDocument, bytes: Uint8Array, mime: MimeLampiran): Promise<PDFImage> {
  try {
    return mime === "image/png" ? await doc.embedPng(bytes) : await doc.embedJpg(bytes);
  } catch {
    throw galat("Berkas gambar rusak atau formatnya tidak didukung");
  }
}

/** Periksa sisipan sebelum disimpan: jenis dari magic bytes, isi terbaca, jumlah halaman. */
export async function periksaLampiran(bytes: Uint8Array): Promise<{ mime: MimeLampiran; halaman: number }> {
  if (bytes.length === 0) throw galat("Berkas kosong");
  if (bytes.length > BATAS.LAMPIRAN_UKURAN_MAKS) {
    throw galat(`Ukuran berkas melebihi ${BATAS.LAMPIRAN_UKURAN_MAKS / 1024 / 1024} MB`);
  }
  const mime = deteksiMime(bytes);
  if (!mime) throw galat("Jenis berkas tidak didukung — hanya PDF, JPG, atau PNG");
  if (mime === "application/pdf") {
    const halaman = (await muatPdf(bytes)).getPageCount();
    if (halaman === 0) throw galat("PDF tidak memiliki halaman");
    if (halaman > BATAS.PAKET_HALAMAN_MAKS) throw galat(`PDF melebihi ${BATAS.PAKET_HALAMAN_MAKS} halaman`);
    return { mime, halaman };
  }
  await tanamGambar(await PDFDocument.create(), bytes, mime);
  return { mime, halaman: 1 };
}

/* ------------------------------------------------------ gabung ke paket */

/** A4 dalam pt; margin gambar. */
const A4: [number, number] = [595.28, 841.89];
const MARGIN = 24;

/**
 * Tag EXIF Orientation (0x0112) dari segmen APP1 JPEG — 1 bila tak ada.
 * Foto HP menyimpan piksel "miring" + tag ini; pdf-lib tidak membacanya.
 */
export function orientasiExif(b: Uint8Array): number {
  const u16 = (o: number, le: boolean) => (le ? b[o] | (b[o + 1] << 8) : (b[o] << 8) | b[o + 1]);
  const u32 = (o: number, le: boolean) => (le ? u16(o, true) + u16(o + 2, true) * 0x10000 : u16(o, false) * 0x10000 + u16(o + 2, false));
  let o = 2;
  while (o + 4 <= b.length && b[o] === 0xff) {
    const marker = b[o + 1];
    const len = (b[o + 2] << 8) | b[o + 3];
    if (marker === 0xda || len < 2) break; // mulai data gambar
    // APP1 "Exif\0\0" → header TIFF.
    if (marker === 0xe1 && o + 10 <= b.length && Buffer.from(b.subarray(o + 4, o + 10)).toString("latin1") === "Exif\0\0") {
      const t = o + 10;
      if (t + 8 > b.length) return 1;
      const le = b[t] === 0x49; // "II" = little endian, "MM" = big endian
      const ifd = t + u32(t + 4, le);
      if (ifd + 2 > b.length) return 1;
      const n = u16(ifd, le);
      for (let i = 0; i < n; i++) {
        const e = ifd + 2 + i * 12;
        if (e + 12 > b.length) return 1;
        if (u16(e, le) === 0x0112) {
          const v = u16(e + 8, le);
          return v >= 1 && v <= 8 ? v : 1;
        }
      }
      return 1;
    }
    o += 2 + len;
  }
  return 1;
}

/**
 * Tempel sisipan ke PDF gabungan; mengembalikan jumlah halaman yang ditambahkan.
 * PDF → salin semua halaman. Gambar → satu halaman A4 (lanskap bila gambar
 * melebar), diperkecil agar muat (tak diperbesar melebihi ukuran asli 96 dpi),
 * di tengah; orientasi EXIF 3/6/8 diputar.
 */
export async function tempelLampiran(out: PDFDocument, bytes: Uint8Array, mime: MimeLampiran): Promise<number> {
  if (mime === "application/pdf") {
    const src = await muatPdf(bytes);
    const pages = await out.copyPages(src, src.getPageIndices());
    for (const p of pages) out.addPage(p);
    return pages.length;
  }
  const img = await tanamGambar(out, bytes, mime);
  const orientasi = mime === "image/jpeg" ? orientasiExif(bytes) : 1;
  const putar = orientasi === 6 || orientasi === 8;
  // Ukuran tampil (pt, 96 dpi) setelah rotasi.
  const w = (img.width * 72) / 96;
  const h = (img.height * 72) / 96;
  const [dw, dh] = putar ? [h, w] : [w, h];
  const [pw, ph] = dw > dh ? [A4[1], A4[0]] : A4;
  const s = Math.min(1, (pw - 2 * MARGIN) / dw, (ph - 2 * MARGIN) / dh);
  const [bw, bh] = [dw * s, dh * s];
  const [bx, by] = [(pw - bw) / 2, (ph - bh) / 2];
  const page = out.addPage([pw, ph]);
  const ukuran = { width: w * s, height: h * s };
  // pdf-lib memutar di titik (x, y) berlawanan jarum jam → geser titik jangkar sesuai sudut.
  if (orientasi === 3) page.drawImage(img, { ...ukuran, x: bx + bw, y: by + bh, rotate: degrees(180) });
  else if (orientasi === 6) page.drawImage(img, { ...ukuran, x: bx, y: by + bh, rotate: degrees(-90) });
  else if (orientasi === 8) page.drawImage(img, { ...ukuran, x: bx + bw, y: by, rotate: degrees(90) });
  else page.drawImage(img, { ...ukuran, x: bx, y: by });
  return 1;
}

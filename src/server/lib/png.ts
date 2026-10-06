/**
 * Normalisasi PNG unggahan (tanda tangan) TANPA dekoder gambar: struktur chunk
 * divalidasi (tanda tangan berkas, CRC, IHDR sah, urutan), lalu berkas DISUSUN
 * ULANG hanya dari chunk yang dibutuhkan untuk menampilkan gambar:
 * IHDR, PLTE, tRNS, IDAT, IEND. Chunk lain (teks, metadata, data sesudah IEND)
 * dibuang → muatan polyglot/tersembunyi tidak ikut tersimpan. Murni & tanpa
 * dependensi.
 */

const SIGNATURE = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const DISIMPAN = new Set(["IHDR", "PLTE", "tRNS", "IDAT", "IEND"]);
/** Kombinasi tipe warna → kedalaman bit yang sah (spesifikasi PNG §11.2.2). */
const BIT_SAH: Record<number, readonly number[]> = { 0: [1, 2, 4, 8, 16], 2: [8, 16], 3: [1, 2, 4, 8], 4: [8, 16], 6: [8, 16] };

export type BatasPng = { maksByte: number; maksSisi: number; maksPiksel: number };
export const BATAS_PNG_TTD: BatasPng = { maksByte: 450 * 1024, maksSisi: 4096, maksPiksel: 8_000_000 };

export type HasilPng =
  | { ok: true; png: Uint8Array<ArrayBuffer>; lebar: number; tinggi: number }
  | { ok: false; alasan: string };

const TABEL_CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (const b of bytes) c = TABEL_CRC[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

const gagal = (alasan: string): HasilPng => ({ ok: false, alasan });

export function normalkanPng(masuk: Uint8Array, batas: BatasPng = BATAS_PNG_TTD): HasilPng {
  if (masuk.byteLength > batas.maksByte) return gagal("Ukuran gambar tanda tangan melebihi batas");
  if (masuk.byteLength < SIGNATURE.length + 12 || SIGNATURE.some((b, i) => masuk[i] !== b)) {
    return gagal("Tanda tangan harus berupa gambar PNG");
  }
  const view = new DataView(masuk.buffer, masuk.byteOffset, masuk.byteLength);
  const keluar: Uint8Array[] = [SIGNATURE];
  let lebar = 0;
  let tinggi = 0;
  let pos = SIGNATURE.length;
  let indeks = 0;
  let adaIdat = false;
  let selesai = false;

  while (!selesai) {
    if (pos + 12 > masuk.byteLength) return gagal("Berkas PNG terpotong");
    const panjang = view.getUint32(pos);
    const akhir = pos + 12 + panjang;
    if (panjang > 0x7fffffff || akhir > masuk.byteLength) return gagal("Berkas PNG terpotong");
    const tipeData = masuk.subarray(pos + 4, pos + 8 + panjang);
    const tipe = String.fromCharCode(...tipeData.subarray(0, 4));
    if (!/^[A-Za-z]{4}$/.test(tipe)) return gagal("Struktur PNG tidak sah");
    if (crc32(tipeData) !== view.getUint32(pos + 8 + panjang)) return gagal("Berkas PNG rusak (CRC)");

    if (indeks === 0) {
      if (tipe !== "IHDR" || panjang !== 13) return gagal("Struktur PNG tidak sah");
      lebar = view.getUint32(pos + 8);
      tinggi = view.getUint32(pos + 12);
      const [bit, warna, kompresi, filter, interlace] = masuk.subarray(pos + 16, pos + 21);
      if (lebar < 1 || tinggi < 1 || lebar > batas.maksSisi || tinggi > batas.maksSisi || lebar * tinggi > batas.maksPiksel) {
        return gagal("Dimensi gambar tanda tangan di luar batas");
      }
      if (!BIT_SAH[warna]?.includes(bit) || kompresi !== 0 || filter !== 0 || interlace > 1) {
        return gagal("Format PNG tidak didukung");
      }
    } else if (tipe === "IHDR") {
      return gagal("Struktur PNG tidak sah");
    }
    // Huruf pertama kapital = chunk kritis: yang tak dikenal tak boleh diabaikan.
    if (!DISIMPAN.has(tipe) && tipe[0] === tipe[0].toUpperCase()) return gagal("Format PNG tidak didukung");

    if (DISIMPAN.has(tipe)) keluar.push(masuk.subarray(pos, akhir));
    if (tipe === "IDAT") adaIdat = true;
    selesai = tipe === "IEND";
    pos = akhir;
    indeks++;
  }
  if (!adaIdat) return gagal("Berkas PNG tidak berisi gambar");

  const total = keluar.reduce((n, b) => n + b.byteLength, 0);
  const png = new Uint8Array(total);
  let o = 0;
  for (const b of keluar) {
    png.set(b, o);
    o += b.byteLength;
  }
  return { ok: true, png, lebar, tinggi };
}

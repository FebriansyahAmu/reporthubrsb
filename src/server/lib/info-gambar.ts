/**
 * Jenis & dimensi gambar raster dari header berkas, TANPA dekoder: JPEG (segmen
 * SOFn), PNG (IHDR), WebP (VP8 / VP8L / VP8X). Murni & tanpa dependensi — untuk
 * menolak unggahan yang bukan gambar atau berdimensi raksasa (bom dekompresi di
 * browser penampil) sebelum disimpan. Jenis ditentukan dari isi, bukan dari
 * nama berkas / Content-Type kiriman klien.
 */

export type MimeGambar = "image/jpeg" | "image/png" | "image/webp";
export type InfoGambar = { mime: MimeGambar; lebar: number; tinggi: number };

const ascii = (b: Uint8Array, dari: number, sampai: number) => String.fromCharCode(...b.subarray(dari, sampai));

/** SOF0–SOF15 kecuali DHT (C4), JPG (C8), DAC (CC) — semuanya memuat dimensi bingkai. */
const adalahSof = (m: number) => m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc;

function jpeg(b: Uint8Array, v: DataView): InfoGambar | null {
  let p = 2;
  while (p + 9 <= b.length) {
    if (b[p] !== 0xff) return null;
    const m = b[p + 1];
    if (m === 0xff) {
      p++; // bita pengisi
      continue;
    }
    if (m === 0x01 || (m >= 0xd0 && m <= 0xd8)) {
      p += 2; // penanda tanpa panjang
      continue;
    }
    if (m === 0xd9 || m === 0xda) return null; // EOI / data pindai sebelum SOF
    const panjang = v.getUint16(p + 2);
    if (panjang < 2) return null;
    if (adalahSof(m)) return { mime: "image/jpeg", tinggi: v.getUint16(p + 5), lebar: v.getUint16(p + 7) };
    p += 2 + panjang;
  }
  return null;
}

function webp(b: Uint8Array, v: DataView): InfoGambar | null {
  if (b.length < 25) return null;
  const potongan = ascii(b, 12, 16);
  if (potongan === "VP8L") {
    if (b[20] !== 0x2f) return null;
    const bit = v.getUint32(21, true);
    return { mime: "image/webp", lebar: (bit & 0x3fff) + 1, tinggi: ((bit >>> 14) & 0x3fff) + 1 };
  }
  if (b.length < 30) return null;
  if (potongan === "VP8 ") {
    // Tag bingkai 3 bita, kode awal 9d 01 2a, lalu lebar/tinggi 14 bit (LE).
    if (b[23] !== 0x9d || b[24] !== 0x01 || b[25] !== 0x2a) return null;
    return { mime: "image/webp", lebar: v.getUint16(26, true) & 0x3fff, tinggi: v.getUint16(28, true) & 0x3fff };
  }
  if (potongan === "VP8X") {
    const u24 = (i: number) => b[i] | (b[i + 1] << 8) | (b[i + 2] << 16);
    return { mime: "image/webp", lebar: u24(24) + 1, tinggi: u24(27) + 1 };
  }
  return null;
}

export function infoGambar(b: Uint8Array): InfoGambar | null {
  const v = new DataView(b.buffer, b.byteOffset, b.byteLength);
  if (b.length >= 24 && ascii(b, 0, 8) === "\x89PNG\r\n\x1a\n" && ascii(b, 12, 16) === "IHDR") {
    return { mime: "image/png", lebar: v.getUint32(16), tinggi: v.getUint32(20) };
  }
  if (b.length >= 12 && ascii(b, 0, 4) === "RIFF" && ascii(b, 8, 12) === "WEBP") return webp(b, v);
  if (b.length >= 4 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return jpeg(b, v);
  return null;
}

import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { infoGambar } from "./info-gambar";

const teks = (s: string) => [...s].map((c) => c.charCodeAt(0));
const u16le = (n: number) => [n & 0xff, n >> 8];
const u16be = (n: number) => [n >> 8, n & 0xff];
const u24le = (n: number) => [n & 0xff, (n >> 8) & 0xff, n >> 16];
const u32be = (n: number) => [n >>> 24, (n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
const riff = (potongan: string, isi: number[]) => Uint8Array.from([...teks("RIFF"), 0, 0, 0, 0, ...teks("WEBP"), ...teks(potongan), ...u24le(isi.length), 0, ...isi]);

describe("infoGambar (jenis & dimensi dari header)", () => {
  it("PNG: IHDR", () => {
    const png = Uint8Array.from([0x89, ...teks("PNG\r\n\x1a\n"), 0, 0, 0, 13, ...teks("IHDR"), ...u32be(640), ...u32be(480), 8, 6, 0, 0, 0]);
    expect(infoGambar(png)).toEqual({ mime: "image/png", lebar: 640, tinggi: 480 });
    const logo = new Uint8Array(readFileSync(path.join(process.cwd(), "public/logo/logoboltim.png")));
    const info = infoGambar(logo);
    expect(info?.mime).toBe("image/png");
    expect(info!.lebar).toBeGreaterThan(0);
  });

  it("WebP: VP8 (lossy), VP8L (lossless), VP8X (extended)", () => {
    expect(infoGambar(riff("VP8 ", [0x10, 0x02, 0x00, 0x9d, 0x01, 0x2a, ...u16le(400), ...u16le(400), 0, 0]))).toEqual({ mime: "image/webp", lebar: 400, tinggi: 400 });
    const bit = (400 - 1) | ((300 - 1) << 14);
    expect(infoGambar(riff("VP8L", [0x2f, bit & 0xff, (bit >> 8) & 0xff, (bit >> 16) & 0xff, bit >>> 24, 0, 0, 0, 0]))).toEqual({ mime: "image/webp", lebar: 400, tinggi: 300 });
    expect(infoGambar(riff("VP8X", [0x10, 0, 0, 0, ...u24le(5000 - 1), ...u24le(20000 - 1)]))).toEqual({ mime: "image/webp", lebar: 5000, tinggi: 20000 });
    // Kode awal VP8 salah → bukan gambar sah.
    expect(infoGambar(riff("VP8 ", [0x10, 0x02, 0x00, 0x00, 0x00, 0x00, ...u16le(400), ...u16le(400), 0, 0]))).toBeNull();
  });

  it("JPEG: lewati segmen APPn sampai SOF", () => {
    const app0 = [0xff, 0xe0, ...u16be(16), ...teks("JFIF\0"), 1, 1, 0, 0, 1, 0, 1, 0, 0];
    const sof2 = [0xff, 0xc2, ...u16be(17), 8, ...u16be(1080), ...u16be(1920), 3, 1, 0x22, 0, 2, 0x11, 1, 3, 0x11, 1];
    expect(infoGambar(Uint8Array.from([0xff, 0xd8, ...app0, ...sof2]))).toEqual({ mime: "image/jpeg", lebar: 1920, tinggi: 1080 });
    // DHT (C4) bukan SOF; SOS sebelum SOF → tolak.
    const dht = [0xff, 0xc4, ...u16be(4), 0, 0];
    const sos = [0xff, 0xda, ...u16be(8), 1, 1, 0, 0, 0x3f, 0];
    expect(infoGambar(Uint8Array.from([0xff, 0xd8, 0xff, ...dht, ...sos, 0, 0, 0]))).toBeNull();
  });

  it("menolak bukan gambar / terpotong / format lain (SVG, GIF, HTML)", () => {
    expect(infoGambar(new Uint8Array())).toBeNull();
    expect(infoGambar(Uint8Array.from(teks("<svg xmlns='http://www.w3.org/2000/svg'><script>alert(1)</script></svg>")))).toBeNull();
    expect(infoGambar(Uint8Array.from(teks("GIF89a\x01\x00\x01\x00")))).toBeNull();
    expect(infoGambar(Uint8Array.from(teks("<html><body>hai</body></html>")))).toBeNull();
    expect(infoGambar(Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0x00]))).toBeNull();
    expect(infoGambar(Uint8Array.from([...teks("RIFF"), 0, 0, 0, 0, ...teks("WEBP")]))).toBeNull();
  });
});

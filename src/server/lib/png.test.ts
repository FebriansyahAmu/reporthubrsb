import { deflateSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { normalkanPng } from "./png";

const SIG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function crc32(buf: Buffer): number {
  let c = ~0;
  for (const b of buf) {
    c ^= b;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  return ~c >>> 0;
}

function chunk(tipe: string, data: Buffer = Buffer.alloc(0), crcRusak = false): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(tipe, "latin1"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crcRusak ? (crc32(td) ^ 1) >>> 0 : crc32(td));
  return Buffer.concat([len, td, crc]);
}

function ihdr(lebar = 1, tinggi = 1, bit = 8, warna = 6): Buffer {
  const d = Buffer.alloc(13);
  d.writeUInt32BE(lebar, 0);
  d.writeUInt32BE(tinggi, 4);
  d[8] = bit;
  d[9] = warna;
  return chunk("IHDR", d);
}

const idat = () => chunk("IDAT", deflateSync(Buffer.from([0, 0, 0, 0, 255])));
const iend = () => chunk("IEND");
const png = (...bagian: Buffer[]) => Buffer.concat([SIG, ...bagian]);

describe("normalkanPng", () => {
  it("PNG minimal sah → identik", () => {
    const masuk = png(ihdr(), idat(), iend());
    const h = normalkanPng(masuk);
    expect(h.ok && Buffer.from(h.png).equals(masuk)).toBe(true);
    expect(h.ok && [h.lebar, h.tinggi]).toEqual([1, 1]);
  });

  it("chunk teks/metadata & data setelah IEND (polyglot) dibuang", () => {
    const bersih = png(ihdr(), idat(), iend());
    const masuk = Buffer.concat([
      png(ihdr(), chunk("tEXt", Buffer.from("Comment\0<script>alert(1)</script>")), chunk("pHYs", Buffer.alloc(9)), idat(), chunk("zzZz", Buffer.from("x")), iend()),
      Buffer.from("<html><script>alert(1)</script></html>"),
    ]);
    const h = normalkanPng(masuk);
    expect(h.ok && Buffer.from(h.png).equals(bersih)).toBe(true);
  });

  it("PLTE & tRNS dipertahankan", () => {
    const masuk = png(ihdr(1, 1, 8, 3), chunk("PLTE", Buffer.alloc(3)), chunk("tRNS", Buffer.from([0])), idat(), iend());
    const h = normalkanPng(masuk);
    expect(h.ok && Buffer.from(h.png).equals(masuk)).toBe(true);
  });

  it.each([
    ["bukan PNG (JPEG)", Buffer.from([0xff, 0xd8, 0xff, 0xe0, ...Buffer.alloc(40)])],
    ["SVG", Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>')],
    ["CRC rusak", png(ihdr(), chunk("IDAT", deflateSync(Buffer.from([0, 0, 0, 0, 255])), true), iend())],
    ["terpotong", png(ihdr(), idat()).subarray(0, 40)],
    ["tanpa IEND", png(ihdr(), idat())],
    ["IHDR bukan chunk pertama", png(idat(), ihdr(), iend())],
    ["IHDR ganda", png(ihdr(), ihdr(), idat(), iend())],
    ["chunk kritis tak dikenal", png(ihdr(), chunk("ABCD", Buffer.from("x")), idat(), iend())],
    ["tanpa IDAT", png(ihdr(), iend())],
    ["dimensi raksasa", png(ihdr(100_000, 100_000), idat(), iend())],
    ["dimensi nol", png(ihdr(0, 1), idat(), iend())],
    ["kedalaman bit tidak sah", png(ihdr(1, 1, 7, 6), idat(), iend())],
    ["tipe chunk bukan huruf", png(ihdr(), chunk("I\0AT", Buffer.from("x")), idat(), iend())],
    ["panjang chunk menipu", Buffer.concat([SIG, Buffer.from([0x7f, 0xff, 0xff, 0xff]), Buffer.from("IHDR"), Buffer.alloc(20)])],
  ])("%s → ditolak", (_n, masuk) => {
    expect(normalkanPng(masuk).ok).toBe(false);
  });

  it("melebihi batas byte → ditolak", () => {
    const masuk = png(ihdr(), idat(), iend());
    expect(normalkanPng(masuk, { maksByte: 10, maksSisi: 10, maksPiksel: 100 }).ok).toBe(false);
  });
});

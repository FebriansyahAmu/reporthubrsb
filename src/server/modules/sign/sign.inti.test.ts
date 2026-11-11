import { createHash } from "node:crypto";
import { deflateSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import {
  buatPenyimpananSign,
  GRASI_SESI_MS,
  JEDA_AMBIL_MS,
  MAKS_SESI_PENGGUNA,
  MAKS_SESI_TOTAL,
  SIGN_TOKEN_RE,
  TTL_SESI_MS,
} from "./sign.inti";
import { signCreateSchema, signSubmitSchema } from "./sign.schema";

/* ---------------------------------------------------------------- PNG uji */

function crc32(buf: Buffer): number {
  let c = ~0;
  for (const b of buf) {
    c ^= b;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  return ~c >>> 0;
}
function chunk(tipe: string, data: Buffer = Buffer.alloc(0)): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(tipe, "latin1"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
const IHDR = (() => {
  const d = Buffer.alloc(13);
  d.writeUInt32BE(1, 0);
  d.writeUInt32BE(1, 4);
  d[8] = 8;
  d[9] = 6;
  return chunk("IHDR", d);
})();
const SIG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const PNG_BERSIH = Buffer.concat([SIG, IHDR, chunk("IDAT", deflateSync(Buffer.from([0, 0, 0, 0, 255]))), chunk("IEND")]);
/** PNG + chunk teks berisi skrip + HTML setelah IEND (polyglot). */
const PNG_POLYGLOT = Buffer.concat([
  SIG,
  IHDR,
  chunk("tEXt", Buffer.from("Comment\0<script>alert(1)</script>")),
  chunk("IDAT", deflateSync(Buffer.from([0, 0, 0, 0, 255]))),
  chunk("IEND"),
  Buffer.from("<html><script>alert(1)</script></html>"),
]);

function jamTiruan(mulai = 1_000_000) {
  let t = mulai;
  return { jam: () => t, maju: (ms: number) => void (t += ms) };
}

describe("TTD Via HP — sesi terikat pembuat (PRD TTD Perangkat Siaga §13 L4)", () => {
  it("alur: buat → HP kirim → pembuat lihat status & ambil sekali → PNG dibuang", () => {
    const j = jamTiruan();
    const s = buatPenyimpananSign({ jam: j.jam });
    const { token, sampai } = s.buat("TTD Pasien", "Nama Pasien", "u1");
    expect(token).toMatch(SIGN_TOKEN_RE);
    expect(sampai).toBe(j.jam() + TTL_SESI_MS);
    expect(s.status(token, "u1")).toBe("pending");
    expect(s.publik(token)).toEqual({ label: "TTD Pasien", context: "Nama Pasien", status: "pending" });

    s.kirim(token, PNG_BERSIH);
    expect(s.status(token, "u1")).toBe("signed");
    const t = s.ambil(token, "u1");
    expect(Buffer.from(t.png).equals(PNG_BERSIH)).toBe(true);
    expect(t.sha256).toBe(createHash("sha256").update(PNG_BERSIH).digest("hex"));

    // Sekali: setelah diambil PNG tidak ada lagi di memori.
    expect(s.status(token, "u1")).toBe("taken");
    expect(() => s.ambil(token, "u1")).toThrow(expect.objectContaining({ httpStatus: 409 }));
    expect(s.publik(token)?.status).toBe("taken");
  });

  it("IDOR: pengguna lain → 404 seragam untuk status & ambil (sama dengan token tak ada)", () => {
    const s = buatPenyimpananSign();
    const { token } = s.buat("TTD", "", "u1");
    s.kirim(token, PNG_BERSIH);
    for (const f of [() => s.status(token, "u2"), () => s.ambil(token, "u2"), () => s.status("x".repeat(32), "u1")]) {
      expect(f).toThrow(expect.objectContaining({ httpStatus: 404, message: "Sesi tanda tangan tidak ditemukan." }));
    }
    // PNG tetap utuh untuk pemilik.
    expect(s.status(token, "u1")).toBe("signed");
  });

  it("tampilan publik (pemegang token) tanpa PNG, sha256, maupun pembuat", () => {
    const s = buatPenyimpananSign();
    const { token } = s.buat("TTD", "Konteks", "u1");
    s.kirim(token, PNG_BERSIH);
    const v = s.publik(token)!;
    expect(Object.keys(v).sort()).toEqual(["context", "label", "status"]);
    expect(JSON.stringify(v)).not.toContain("u1");
  });

  it("TTD sekali kirim: kiriman kedua → 409 CONFLICT, PNG pertama tidak tertimpa", () => {
    const s = buatPenyimpananSign();
    const { token } = s.buat("TTD", "", "u1");
    s.kirim(token, PNG_BERSIH);
    expect(() => s.kirim(token, PNG_POLYGLOT)).toThrow(expect.objectContaining({ httpStatus: 409, code: "CONFLICT" }));
    expect(Buffer.from(s.ambil(token, "u1").png).equals(PNG_BERSIH)).toBe(true);
    // Setelah diambil pun tetap 409.
    expect(() => s.kirim(token, PNG_BERSIH)).toThrow(expect.objectContaining({ code: "CONFLICT" }));
  });

  it("PNG disusun ulang server: polyglot dibersihkan, bukan-PNG → 422", () => {
    const s = buatPenyimpananSign();
    const a = s.buat("TTD", "", "u1").token;
    s.kirim(a, PNG_POLYGLOT);
    const png = Buffer.from(s.ambil(a, "u1").png);
    expect(png.equals(PNG_BERSIH)).toBe(true);
    expect(png.toString("latin1")).not.toContain("<script>");

    const b = s.buat("TTD", "", "u1").token;
    for (const buruk of [Buffer.from("<svg onload=alert(1)>"), Buffer.from("GIF89a"), PNG_BERSIH.subarray(0, 30)]) {
      expect(() => s.kirim(b, buruk)).toThrow(expect.objectContaining({ httpStatus: 422 }));
    }
    expect(s.status(b, "u1")).toBe("pending"); // penolakan tidak mengubah sesi
  });

  it("kedaluwarsa: kirim setelah masa → 409 BUSINESS_RULE; sesi dihapus setelah grasi", () => {
    const j = jamTiruan();
    const s = buatPenyimpananSign({ jam: j.jam });
    const { token } = s.buat("TTD", "", "u1");
    j.maju(TTL_SESI_MS + 1);
    expect(s.status(token, "u1")).toBe("expired");
    expect(() => s.kirim(token, PNG_BERSIH)).toThrow(expect.objectContaining({ httpStatus: 409, code: "BUSINESS_RULE" }));
    j.maju(GRASI_SESI_MS);
    expect(s.publik(token)).toBeNull();
    expect(s.ukuran()).toBe(0);
  });

  it("TTD yang masuk di detik terakhir tetap bisa diambil minimal JEDA_AMBIL_MS", () => {
    const j = jamTiruan();
    const s = buatPenyimpananSign({ jam: j.jam });
    const { token } = s.buat("TTD", "", "u1");
    j.maju(TTL_SESI_MS - 1);
    s.kirim(token, PNG_BERSIH);
    j.maju(JEDA_AMBIL_MS - 1);
    expect(s.status(token, "u1")).toBe("signed");
    expect(s.ambil(token, "u1").png.byteLength).toBeGreaterThan(0);
  });

  it("memori terbatas: sesi ke-(maks+1) pengguna menggeser yang tertua; total penuh → 503", () => {
    const s = buatPenyimpananSign();
    const punyaU1 = Array.from({ length: MAKS_SESI_PENGGUNA }, () => s.buat("TTD", "", "u1").token);
    const baru = s.buat("TTD", "", "u1").token;
    expect(() => s.status(punyaU1[0], "u1")).toThrow(expect.objectContaining({ httpStatus: 404 }));
    expect(s.status(punyaU1[1], "u1")).toBe("pending");
    expect(s.status(baru, "u1")).toBe("pending");
    expect(s.ukuran()).toBe(MAKS_SESI_PENGGUNA);

    // Isi sampai batas total dengan banyak pengguna.
    let n = 0;
    while (s.ukuran() < MAKS_SESI_TOTAL) s.buat("TTD", "", `p${Math.floor(n++ / MAKS_SESI_PENGGUNA)}`);
    expect(() => s.buat("TTD", "", "baru")).toThrow(expect.objectContaining({ httpStatus: 503 }));
    expect(s.ukuran()).toBe(MAKS_SESI_TOTAL);
    // Pengguna yang sudah di batasnya tetap bisa (menggeser miliknya sendiri, tidak menambah total).
    expect(s.buat("TTD", "", "u1").token).toMatch(SIGN_TOKEN_RE);
    expect(s.ukuran()).toBe(MAKS_SESI_TOTAL);
  });

  it("token acak unik", () => {
    const s = buatPenyimpananSign();
    const t = new Set(Array.from({ length: 200 }, (_, i) => s.buat("TTD", "", `u${i}`).token));
    expect(t.size).toBe(200);
  });
});

describe("skema TTD Via HP", () => {
  it("buat: strict (kolom asing → gagal), label wajib, konteks ≤ 200", () => {
    expect(signCreateSchema.safeParse({ label: "TTD", context: "x" }).success).toBe(true);
    expect(signCreateSchema.safeParse({ label: "TTD" }).success).toBe(true);
    expect(signCreateSchema.safeParse({ label: "TTD", userId: "u2" }).success).toBe(false);
    expect(signCreateSchema.safeParse({ label: " " }).success).toBe(false);
    expect(signCreateSchema.safeParse({ label: "TTD", context: "x".repeat(201) }).success).toBe(false);
  });

  it("kirim: hanya data-URL PNG base64, strict, ≤ 700.000 karakter", () => {
    const sah = `data:image/png;base64,${PNG_BERSIH.toString("base64")}`;
    expect(signSubmitSchema.safeParse({ payload: sah }).success).toBe(true);
    for (const payload of [
      "data:image/svg+xml;base64,PHN2Zz4=",
      "data:image/png;base64,<script>",
      "data:text/html;base64,PGh0bWw+",
      `data:image/png;base64,${"A".repeat(700_000)}`,
    ]) {
      expect(signSubmitSchema.safeParse({ payload }).success, payload.slice(0, 40)).toBe(false);
    }
    expect(signSubmitSchema.safeParse({ payload: sah, status: "signed" }).success).toBe(false);
  });
});

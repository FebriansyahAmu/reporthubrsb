import { createHash, randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  ALFABET_KODE,
  buatKode,
  buatPenyimpananKode,
  formatKode,
  normalkanKode,
  PANJANG_KODE,
  UMUR_KODE_MS,
} from "./kode-pasang";
import { AKSI_PERMINTAAN, STATUS_PERMINTAAN, statusAkhir, tenggatUntuk, transisi } from "./status";
import { DETAK_SSE, frameSse, retrySse } from "./sse";
import {
  buatPerangkatSchema,
  namaPerangkatSchema,
  PERANGKAT_ID_RE,
  ubahPerangkatSchema,
} from "@/server/modules/ttd-siaga/perangkat.schema";

const sha = (s: string) => createHash("sha256").update(s).digest("hex");

describe("kode pasang", () => {
  it("alfabet 31 simbol tanpa karakter mirip", () => {
    expect(ALFABET_KODE).toHaveLength(31);
    for (const c of "01OIL") expect(ALFABET_KODE).not.toContain(c);
  });

  it("buatKode: panjang & alfabet benar, sebaran tanpa bias modulo", () => {
    const hitung = new Map<string, number>();
    for (let i = 0; i < 4000; i++) {
      const k = buatKode((n) => randomBytes(n));
      expect(k).toHaveLength(PANJANG_KODE);
      for (const c of k) {
        expect(ALFABET_KODE).toContain(c);
        hitung.set(c, (hitung.get(c) ?? 0) + 1);
      }
    }
    // 32.000 karakter / 31 simbol ≈ 1.032 per simbol; semua simbol muncul dalam rentang wajar.
    expect(hitung.size).toBe(31);
    for (const n of hitung.values()) expect(n).toBeGreaterThan(800);
  });

  it("buatKode menolak byte ≥ 248 (rejection sampling)", () => {
    let panggilan = 0;
    const acak = (n: number) => {
      panggilan++;
      // Panggilan pertama hanya berisi byte yang harus ditolak.
      return panggilan === 1 ? new Uint8Array(n).fill(250) : new Uint8Array(n).fill(0);
    };
    expect(buatKode(acak)).toBe(ALFABET_KODE[0].repeat(PANJANG_KODE));
    expect(panggilan).toBe(2);
  });

  it("formatKode & normalkanKode", () => {
    expect(formatKode("K7Q4MZ2T")).toBe("K7Q4-MZ2T");
    expect(normalkanKode("k7q4-mz2t")).toBe("K7Q4MZ2T");
    expect(normalkanKode(" K7Q4 MZ2T ")).toBe("K7Q4MZ2T");
    expect(normalkanKode("K7Q4MZ2")).toBeNull(); // pendek
    expect(normalkanKode("K7Q4MZ2TX")).toBeNull(); // panjang
    expect(normalkanKode("K7Q4MZ20")).toBeNull(); // 0 bukan alfabet
    expect(normalkanKode("K7Q4MZ2O")).toBeNull(); // O bukan alfabet
    expect(normalkanKode(12345678)).toBeNull();
    expect(normalkanKode("A".repeat(40))).toBeNull();
    expect(normalkanKode("K7Q4\nMZ2T")).toBe("K7Q4MZ2T"); // spasi putih dibuang, bukan disuntikkan
  });

  const toko = (jam: { t: number }) =>
    buatPenyimpananKode({ acak: (n) => randomBytes(n), hash: sha, jam: () => jam.t });

  it("tukar: sekali pakai, mengembalikan perangkat yang benar", () => {
    const jam = { t: 1_000 };
    const s = toko(jam);
    const { kode, sampai } = s.terbitkan("perangkatA");
    expect(sampai).toBe(1_000 + UMUR_KODE_MS);
    expect(s.sampaiAktif("perangkatA")).toBe(sampai);
    expect(s.tukar(formatKode(kode).toLowerCase())).toBe("perangkatA");
    expect(s.tukar(kode)).toBeNull(); // kedua kali ditolak
    expect(s.sampaiAktif("perangkatA")).toBeNull();
    expect(s.ukuran()).toBe(0);
  });

  it("kedaluwarsa setelah 10 menit", () => {
    const jam = { t: 0 };
    const s = toko(jam);
    const { kode } = s.terbitkan("p1");
    jam.t = UMUR_KODE_MS - 1;
    expect(s.sampaiAktif("p1")).not.toBeNull();
    jam.t = UMUR_KODE_MS;
    expect(s.tukar(kode)).toBeNull();
    expect(s.ukuran()).toBe(0);
  });

  it("kode baru membatalkan kode lama perangkat yang sama, tidak perangkat lain", () => {
    const s = toko({ t: 0 });
    const lama = s.terbitkan("p1").kode;
    const lain = s.terbitkan("p2").kode;
    const baru = s.terbitkan("p1").kode;
    expect(s.tukar(lama)).toBeNull();
    expect(s.tukar(baru)).toBe("p1");
    expect(s.tukar(lain)).toBe("p2");
  });

  it("batalkan & kode salah / sampah", () => {
    const s = toko({ t: 0 });
    const { kode } = s.terbitkan("p1");
    s.batalkan("p1");
    expect(s.tukar(kode)).toBeNull();
    expect(s.tukar("")).toBeNull();
    expect(s.tukar(undefined)).toBeNull();
    expect(s.tukar({ kode })).toBeNull();
  });

  it("menyimpan hash, bukan kode mentah", () => {
    const disimpan: string[] = [];
    const s = buatPenyimpananKode({
      acak: (n) => randomBytes(n),
      hash: (x) => {
        disimpan.push(x);
        return sha(x);
      },
    });
    const { kode } = s.terbitkan("p1");
    // Hash dipanggil atas kode (bukti kunci = hash), dan struktur internal tak terekspos.
    expect(disimpan).toContain(kode);
    expect(Object.keys(s)).not.toContain("perHash");
  });
});

describe("mesin status permintaan", () => {
  it("alur normal & minta ulang", () => {
    expect(transisi("DIKIRIM", "tampil")).toBe("TAMPIL");
    expect(transisi("TAMPIL", "ttd")).toBe("DITANDATANGANI");
    expect(transisi("DITANDATANGANI", "terima")).toBe("DITERIMA");
    expect(transisi("DITANDATANGANI", "ulang")).toBe("DIKIRIM");
  });

  it("status akhir tidak bisa berpindah lagi", () => {
    for (const s of STATUS_PERMINTAAN.filter(statusAkhir)) {
      for (const a of AKSI_PERMINTAAN) expect(transisi(s, a)).toBeNull();
    }
  });

  it("transisi terlarang ditolak (tanpa timpa buta)", () => {
    expect(transisi("DIKIRIM", "terima")).toBeNull(); // terima sebelum ada TTD
    expect(transisi("TAMPIL", "ulang")).toBeNull();
    expect(transisi("DITANDATANGANI", "ttd")).toBeNull(); // kirim TTD dua kali
    expect(transisi("DITANDATANGANI", "tampil")).toBeNull();
  });

  it("batal & kedaluwarsa dari semua status tak-akhir", () => {
    for (const s of STATUS_PERMINTAAN.filter((x) => !statusAkhir(x))) {
      expect(transisi(s, "batal")).toBe("DIBATALKAN");
      expect(transisi(s, "kedaluwarsa")).toBe("KEDALUWARSA");
    }
  });

  it("tenggat per status", () => {
    expect(tenggatUntuk("DIKIRIM")).toBe(180_000);
    expect(tenggatUntuk("TAMPIL")).toBe(180_000);
    expect(tenggatUntuk("DITANDATANGANI")).toBe(120_000);
    expect(tenggatUntuk("DITERIMA")).toBeNull();
  });
});

describe("frame SSE", () => {
  it("event + JSON satu baris", () => {
    expect(frameSse("permintaan", { id: "abc", sampai: 5 })).toBe('event: permintaan\ndata: {"id":"abc","sampai":5}\n\n');
  });

  it("nilai berisi baris baru tidak bisa menyuntik field/event", () => {
    const f = frameSse("status", { status: "x\n\nevent: ttd\ndata: palsu\r\n" });
    expect(f.split("\n\n")).toHaveLength(2); // satu frame + sisa kosong
    expect(f.match(/^event:/gm)).toHaveLength(1);
    expect(f.match(/^data:/gm)).toHaveLength(1);
  });

  it("event di luar daftar ditolak", () => {
    expect(() => frameSse("evil" as never, {})).toThrow(RangeError);
    expect(() => frameSse("status\ndata: x" as never, {})).toThrow(RangeError);
  });

  it("detak = komentar, retry = bilangan bulat", () => {
    expect(DETAK_SSE.startsWith(":")).toBe(true);
    expect(retrySse(3000)).toBe("retry: 3000\n\n");
    expect(() => retrySse(-1)).toThrow(RangeError);
    expect(() => retrySse(1.5)).toThrow(RangeError);
  });
});

describe("skema pengelola perangkat", () => {
  it("nama sah & dirapikan", () => {
    expect(namaPerangkatSchema.parse("  Tablet TTD IGD 1 ")).toBe("Tablet TTD IGD 1");
    expect(namaPerangkatSchema.parse("Tablet   R. Mawar (2)")).toBe("Tablet R. Mawar (2)");
    expect(namaPerangkatSchema.parse("HP Poli #3 / Lt-2")).toBe("HP Poli #3 / Lt-2");
  });

  it("nama berbahaya / tak sah ditolak", () => {
    for (const n of [
      "<script>alert(1)</script>",
      "Tab\nlet",
      "Tablet\tIGD",
      "ab",
      "x".repeat(81),
      "-Tablet",
      "Tablet \"IGD\"",
      "Tablet & IGD",
      "Tablet\u0000",
    ]) {
      expect(namaPerangkatSchema.safeParse(n).success, n).toBe(false);
    }
  });

  it("strict: kolom tambahan (mass assignment) → gagal", () => {
    expect(buatPerangkatSchema.safeParse({ nama: "Tablet IGD", aktif: false }).success).toBe(false);
    expect(buatPerangkatSchema.safeParse({ nama: "Tablet IGD", tokenHash: "a".repeat(64) }).success).toBe(false);
    expect(ubahPerangkatSchema.safeParse({ nama: "Tablet IGD", dibuatOlehId: "x" }).success).toBe(false);
  });

  it("ruangan 9 digit atau null; ubah wajib berisi perubahan", () => {
    expect(buatPerangkatSchema.parse({ nama: "Tablet IGD", ruanganId: "101010101" }).ruanganId).toBe("101010101");
    expect(buatPerangkatSchema.parse({ nama: "Tablet IGD", ruanganId: null }).ruanganId).toBeNull();
    expect(buatPerangkatSchema.safeParse({ nama: "Tablet IGD", ruanganId: "1010" }).success).toBe(false);
    expect(buatPerangkatSchema.safeParse({ nama: "Tablet IGD", ruanganId: "1' OR 1=1" }).success).toBe(false);
    expect(ubahPerangkatSchema.safeParse({}).success).toBe(false);
    expect(ubahPerangkatSchema.safeParse({ ruanganId: null }).success).toBe(true);
  });

  it("format ID perangkat", () => {
    expect(PERANGKAT_ID_RE.test("cmhr0f1ab0000xyz123456789")).toBe(true);
    expect(PERANGKAT_ID_RE.test("../etc/passwd")).toBe(false);
    expect(PERANGKAT_ID_RE.test("CMHR0F1AB0000XYZ123456789")).toBe(false);
  });
});

import { describe, expect, it } from "vitest";
import { namaAkun, nipBermakna, normNip, ruanganPerAkun, samarkanNip } from "./petugas.util";
import { MAKS_RUANGAN_PENGGUNA, penggunaQuerySchema, petugasPutSchema, ruanganPenggunaPutSchema } from "./petugas.schema";

describe("petugas.util", () => {
  it("normNip membuang semua spasi", () => {
    expect(normNip(" 19831027 201903 1 003 ")).toBe("198310272019031003");
    expect(normNip(null)).toBe("");
  });

  it("nipBermakna menolak isian kosong / tanda strip", () => {
    expect(nipBermakna("198310272019031003")).toBe(true);
    expect(nipBermakna("-")).toBe(false);
    expect(nipBermakna("0")).toBe(false);
    expect(nipBermakna("--------")).toBe(false);
  });

  it("samarkanNip", () => {
    expect(samarkanNip("19831027 201903 1 003")).toBe("1983…1003");
    expect(samarkanNip("1234")).toBe("••••");
    expect(samarkanNip("")).toBeNull();
  });

  it("namaAkun bergelar", () => {
    expect(namaAkun({ name: "Budi", gelarDepan: "dr.", gelarBelakang: "Sp.PD" })).toBe("dr. Budi, Sp.PD");
    expect(namaAkun({ name: " Ani ", gelarDepan: null, gelarBelakang: " " })).toBe("Ani");
  });
});

describe("petugas.schema", () => {
  it("userIds: ID aman, maks 50, kunci asing ditolak", () => {
    expect(petugasPutSchema.parse({ userIds: ["cm1abc", "seed_admin-1"] }).userIds).toHaveLength(2);
    expect(() => petugasPutSchema.parse({ userIds: ["x' OR 1=1"] })).toThrow();
    expect(() => petugasPutSchema.parse({ userIds: Array.from({ length: 51 }, (_, i) => `u${i}`) })).toThrow();
    expect(() => petugasPutSchema.parse({ userIds: [], lain: 1 })).toThrow();
    expect(() => petugasPutSchema.parse({ userIds: ["a".repeat(31)] })).toThrow();
  });

  it("q dibatasi 60 karakter, parameter asing ditolak", () => {
    expect(penggunaQuerySchema.parse({}).q).toBe("");
    expect(() => penggunaQuerySchema.parse({ q: "a".repeat(61) })).toThrow();
    expect(() => penggunaQuerySchema.parse({ q: "a", take: "999" })).toThrow();
  });
});

describe("ruangan tugas dari sisi akun (Master › Pengguna)", () => {
  const R = (id: string, kode: string, aktif = true) => ({ id, kodePrefix: kode, nama: `Ruang ${kode}`, aktif });

  it("ruanganPerAkun: pemetaan dulu, lalu NIP PJ; nonaktif & duplikat dibuang", () => {
    const peta = ruanganPerAkun(
      [
        { id: "u1", nip: "19831027 201903 1 003" },
        { id: "u2", nip: "-" },
        { id: "u3", nip: null },
      ],
      [
        { userId: "u1", ruangan: R("r2", "ICU") },
        { userId: "u1", ruangan: R("r9", "LAMA", false) },
        { userId: "u2", ruangan: R("r3", "OBG") },
        { userId: "lain", ruangan: R("r4", "DIR") },
      ],
      [
        { id: "r1", kodePrefix: "IGD", nama: "Ruang IGD", pjNip: "198310272019031003" },
        { id: "r2", kodePrefix: "ICU", nama: "Ruang ICU", pjNip: "19831027 201903 1 003" },
        { id: "r5", kodePrefix: "LAB", nama: "Ruang LAB", pjNip: "-" },
      ],
    );
    expect(peta.get("u1")).toEqual([
      { kodePrefix: "ICU", nama: "Ruang ICU", otomatis: false },
      { kodePrefix: "IGD", nama: "Ruang IGD", otomatis: true },
    ]);
    // NIP "-" tak pernah cocok dengan PJ ber-NIP "-".
    expect(peta.get("u2")).toEqual([{ kodePrefix: "OBG", nama: "Ruang OBG", otomatis: false }]);
    expect(peta.get("u3")).toEqual([]);
    expect(peta.has("lain")).toBe(false);
  });

  it("ruanganIds: ID aman, maks 100, kunci asing ditolak", () => {
    expect(ruanganPenggunaPutSchema.parse({ ruanganIds: ["cm1abc"] }).ruanganIds).toEqual(["cm1abc"]);
    expect(ruanganPenggunaPutSchema.parse({ ruanganIds: [] }).ruanganIds).toEqual([]);
    expect(() => ruanganPenggunaPutSchema.parse({ ruanganIds: ["1; DROP TABLE x"] })).toThrow();
    expect(() =>
      ruanganPenggunaPutSchema.parse({ ruanganIds: Array.from({ length: MAKS_RUANGAN_PENGGUNA + 1 }, (_, i) => `r${i}`) }),
    ).toThrow();
    expect(() => ruanganPenggunaPutSchema.parse({ ruanganIds: [], userId: "x" })).toThrow();
    expect(() => ruanganPenggunaPutSchema.parse({})).toThrow();
  });
});
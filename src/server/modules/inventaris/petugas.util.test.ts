import { describe, expect, it } from "vitest";
import { namaAkun, nipBermakna, normNip, samarkanNip } from "./petugas.util";
import { petugasPutSchema, penggunaQuerySchema } from "./petugas.schema";

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

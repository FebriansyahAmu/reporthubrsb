import { describe, expect, it } from "vitest";
import { ValidationError } from "@/server/lib/errors";
import { jepitRentang, potongRentang } from "./surat-kontrol.filter";
import { eksporQuerySchema, suratKontrolQuerySchema, tentukanRentang } from "./surat-kontrol.schema";

describe("tentukanRentang", () => {
  it("bawaan = bulan berjalan (termasuk Februari & Desember)", () => {
    expect(tentukanRentang({}, "2026-10-12")).toEqual({ from: "2026-10-01", to: "2026-10-31" });
    expect(tentukanRentang({}, "2028-02-10")).toEqual({ from: "2028-02-01", to: "2028-02-29" });
    expect(tentukanRentang({}, "2026-12-31")).toEqual({ from: "2026-12-01", to: "2026-12-31" });
  });
  it("hanya from / hanya to → dilengkapi 31 hari; terbalik → ditukar", () => {
    expect(tentukanRentang({ from: "2026-09-01" }, "2026-10-12")).toEqual({ from: "2026-09-01", to: "2026-10-01" });
    expect(tentukanRentang({ to: "2026-10-31" }, "2026-10-12")).toEqual({ from: "2026-10-01", to: "2026-10-31" });
    expect(tentukanRentang({ from: "2026-10-10", to: "2026-10-01" }, "2026-10-12")).toEqual({ from: "2026-10-01", to: "2026-10-10" });
  });
  it("> 31 hari → ValidationError; batas depan 90 hari dijepit", () => {
    expect(() => tentukanRentang({ from: "2026-09-01", to: "2026-10-02" }, "2026-10-12")).toThrow(ValidationError);
    expect(tentukanRentang({ from: "2027-01-01", to: "2027-01-20" }, "2026-10-12")).toEqual({ from: "2027-01-01", to: "2027-01-10" });
    expect(tentukanRentang({ from: "2027-02-01", to: "2027-02-10" }, "2026-10-12")).toEqual({ from: "2027-01-10", to: "2027-01-10" });
  });
});

describe("jepitRentang (layar)", () => {
  const batas = "2027-01-10";
  it("ubah from: to ikut digeser agar ≤ 31 hari & ≥ from & ≤ batas depan", () => {
    expect(jepitRentang("2026-10-20", "2026-10-10", "from", batas)).toEqual(["2026-10-20", "2026-10-20"]);
    expect(jepitRentang("2026-09-01", "2026-10-31", "from", batas)).toEqual(["2026-09-01", "2026-10-01"]);
    expect(jepitRentang("2027-01-05", "2027-01-30", "from", batas)).toEqual(["2027-01-05", "2027-01-10"]);
    expect(jepitRentang("2027-02-01", "2027-02-05", "from", batas)).toEqual(["2027-01-10", "2027-01-10"]);
  });
  it("ubah to: from ikut digeser", () => {
    expect(jepitRentang("2026-10-20", "2026-10-05", "to", batas)).toEqual(["2026-10-05", "2026-10-05"]);
    expect(jepitRentang("2026-09-01", "2026-10-31", "to", batas)).toEqual(["2026-10-01", "2026-10-31"]);
    expect(jepitRentang("2026-12-20", "2027-03-01", "to", batas)).toEqual(["2026-12-20", "2027-01-10"]);
  });
});

describe("potongRentang (batas VClaim 30 hari)", () => {
  it("≤ 30 hari = satu potongan; 31 hari = dua; tanpa celah/tumpang", () => {
    expect(potongRentang("2026-10-01", "2026-10-30")).toEqual([["2026-10-01", "2026-10-30"]]);
    expect(potongRentang("2026-10-01", "2026-10-31")).toEqual([["2026-10-01", "2026-10-30"], ["2026-10-31", "2026-10-31"]]);
    expect(potongRentang("2026-10-05", "2026-10-05")).toEqual([["2026-10-05", "2026-10-05"]]);
    expect(potongRentang("2028-02-01", "2028-03-02")).toEqual([["2028-02-01", "2028-03-01"], ["2028-03-02", "2028-03-02"]]);
  });
});

describe("skema query", () => {
  it("menolak tanggal tak valid & jenis asing; bawaan jenis = 2", () => {
    expect(suratKontrolQuerySchema.parse({}).jenis).toBe("2");
    expect(() => suratKontrolQuerySchema.parse({ from: "2026-02-30" })).toThrow();
    expect(() => suratKontrolQuerySchema.parse({ from: "2026-10-01'--" })).toThrow();
    expect(() => suratKontrolQuerySchema.parse({ jenis: "3" })).toThrow();
    expect(() => suratKontrolQuerySchema.parse({ segar: "true" })).toThrow();
  });
  it("ekspor: status/temuan dari katalog, cari dibatasi 80 karakter", () => {
    expect(eksporQuerySchema.parse({ status: "MASALAH", temuan: "TANGGAL_BEDA" }).temuan).toBe("TANGGAL_BEDA");
    expect(() => eksporQuerySchema.parse({ temuan: "DROP" })).toThrow();
    expect(() => eksporQuerySchema.parse({ q: "x".repeat(81) })).toThrow();
  });
});

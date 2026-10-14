import { describe, expect, it } from "vitest";
import { hitungPerStatus, jangkarForm, statusBerulang } from "./profil";

describe("statusBerulang", () => {
  it("belum ada isian → KOSONG", () => {
    expect(statusBerulang([])).toBe("KOSONG");
  });

  it("ada satu draf di antara final → DRAF (kartu kuning sampai semua difinalkan)", () => {
    expect(statusBerulang([{ status: "FINAL" }, { status: "DRAF" }, { status: "FINAL" }])).toBe("DRAF");
  });

  it("semua final → FINAL", () => {
    expect(statusBerulang([{ status: "FINAL" }, { status: "FINAL" }])).toBe("FINAL");
  });

  it("BATAL diabaikan: final + batal → FINAL, batal saja → KOSONG", () => {
    expect(statusBerulang([{ status: "FINAL" }, { status: "BATAL" }])).toBe("FINAL");
    expect(statusBerulang([{ status: "BATAL" }])).toBe("KOSONG");
  });
});

describe("hitungPerStatus", () => {
  it("menghitung tiap status, nol untuk yang tak ada", () => {
    expect(hitungPerStatus([{ status: "DRAF" }, { status: "DRAF" }, { status: "FINAL" }])).toEqual({ KOSONG: 0, DRAF: 2, FINAL: 1 });
    expect(hitungPerStatus([])).toEqual({ KOSONG: 0, DRAF: 0, FINAL: 0 });
  });
});

describe("jangkarForm", () => {
  it("id jangkar kartu tetap (dipakai tautan lama #form-RM.22)", () => {
    expect(jangkarForm("RM.22")).toBe("form-RM.22");
  });
});

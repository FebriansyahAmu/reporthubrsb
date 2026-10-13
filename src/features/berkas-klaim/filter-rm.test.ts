import { describe, expect, it } from "vitest";
import { adaParamFilter, filterAktif, filterBawaan, keQueryRm, uraiFilterRm } from "./filter-rm";

const HARI = "2026-10-13";

describe("filter Berkas Klaim RM", () => {
  it("bawaan = 7 hari terakhir, semua jenis", () => {
    expect(filterBawaan(HARI)).toEqual({ from: "2026-10-07", to: "2026-10-13", ruangan: "", kategori: "Semua", q: "", page: 1 });
    expect(uraiFilterRm({}, HARI)).toEqual(filterBawaan(HARI));
  });

  it("pulang-pergi URL: urai(keQuery(f)) = f", () => {
    const f = { from: "2026-09-01", to: "2026-09-30", ruangan: "101020101", kategori: "Rawat Inap" as const, q: "budi", page: 3 };
    const q = keQueryRm(f);
    expect(q).toBe("dari=2026-09-01&sampai=2026-09-30&jenis=ri&ruangan=101020101&cari=budi&hal=3");
    expect(uraiFilterRm(new URLSearchParams(q), HARI)).toEqual(f);
    expect(uraiFilterRm(new URLSearchParams("jenis=rj"), HARI).kategori).toBe("Rawat Jalan Klinik");
    expect(uraiFilterRm(new URLSearchParams("jenis=igd"), HARI).kategori).toBe("IGD");
  });

  it("nilai rusak/berbahaya jatuh ke bawaan; tanggal dijepit", () => {
    const f = uraiFilterRm({ dari: "2026-02-30", sampai: "2027-01-01", jenis: "x", ruangan: "1' OR 1=1", hal: "-2", cari: "x".repeat(90) }, HARI);
    expect(f.to).toBe(HARI);
    expect(f.from).toBe("2026-10-07");
    expect(f.kategori).toBe("Semua");
    expect(f.ruangan).toBe("");
    expect(f.page).toBe(1);
    expect(f.q).toHaveLength(60);
    expect(uraiFilterRm({ dari: "2026-10-12", sampai: "2026-10-05" }, HARI)).toMatchObject({ from: "2026-10-05", to: "2026-10-05" });
  });

  it("adaParamFilter & filterAktif", () => {
    expect(adaParamFilter({})).toBe(false);
    expect(adaParamFilter(new URLSearchParams("utm=1"))).toBe(false);
    expect(adaParamFilter(new URLSearchParams("jenis=ri"))).toBe(true);
    expect(filterAktif(filterBawaan(HARI), HARI)).toEqual([]);
    expect(filterAktif({ ...filterBawaan(HARI), from: "2026-10-01", kategori: "IGD", q: " a " }, HARI)).toEqual(["tanggal", "kategori", "q"]);
  });
});

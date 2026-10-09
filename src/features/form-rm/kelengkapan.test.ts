import { describe, expect, it } from "vitest";
import { kelengkapanDari, statusPasien, wajibBagi } from "./kelengkapan";
import { DEFINISI_FORM, type JenisKunjungan, type KodeForm } from "./registry";
import type { RingkasIsian } from "@/server/modules/form-rm/isian.types";

const isian = (status: RingkasIsian["status"]): RingkasIsian => ({ id: "x", status, rev: 1, updatedAt: "2026-10-06T00:00:00.000Z", jumlah: 1 });
const jenis = (...j: JenisKunjungan[]) => new Set(j);
const status = (k: ReturnType<typeof kelengkapanDari>, kode: string) => k.formulir.find((f) => f.kode === kode)?.status;

/** Definisi sintetis: mekanisme `wajibUntuk` diuji lepas dari konfigurasi registri. */
const FORMS: { kode: KodeForm; wajibUntuk: JenisKunjungan[] }[] = [
  { kode: "RM.04", wajibUntuk: [2] },
  { kode: "RM.21", wajibUntuk: [2, 3] },
  { kode: "RM.01", wajibUntuk: [3] },
];

describe("kelengkapanDari (form wajib per jenis kunjungan episode)", () => {
  it("konfigurasi registri saat ini: keempat form wajib untuk episode IGD, tak ada untuk rawat inap", () => {
    expect(kelengkapanDari({}, DEFINISI_FORM, jenis(2))).toMatchObject({ total: 4, terisi: 0, lengkap: false });
    expect(kelengkapanDari({}, DEFINISI_FORM, jenis(3))).toMatchObject({ total: 0, lengkap: false });
  });

  it("hanya form yang wajibUntuk-nya cocok jenis episode yang dihitung", () => {
    const igd = kelengkapanDari({}, FORMS, jenis(2));
    expect(igd.formulir.map((f) => [f.kode, f.wajib])).toEqual([["RM.04", true], ["RM.21", true], ["RM.01", false]]);
    expect(igd.total).toBe(2);
    expect(kelengkapanDari({}, FORMS, jenis(3)).total).toBe(2);
    expect(kelengkapanDari({}, FORMS, jenis(2, 3)).total).toBe(3);
  });

  it("DRAF dihitung terisi tetapi tidak membuat lengkap", () => {
    const k = kelengkapanDari({ "RM.04": isian("FINAL"), "RM.21": isian("DRAF") }, FORMS, jenis(2));
    expect(k).toMatchObject({ terisi: 2, final: 1, lengkap: false });
    expect(status(k, "RM.21")).toBe("DRAF");
    expect(status(k, "RM.01")).toBe("KOSONG");
  });

  it("lengkap bila semua form WAJIB FINAL — form tak wajib tak menghalangi", () => {
    const k = kelengkapanDari({ "RM.04": isian("FINAL"), "RM.21": isian("FINAL") }, FORMS, jenis(2));
    expect(k).toMatchObject({ total: 2, final: 2, lengkap: true });
    expect(status(k, "RM.01")).toBe("KOSONG");
  });

  it("episode tanpa form wajib tidak pernah 'lengkap'", () => {
    expect(kelengkapanDari({}, FORMS, jenis(1))).toMatchObject({ total: 0, lengkap: false });
  });

  it("hanya form yang diberikan (boleh dilihat) yang dihitung", () => {
    const k = kelengkapanDari({ "RM.04": isian("FINAL"), "RM.21": isian("DRAF") }, FORMS.slice(0, 1), jenis(2, 3));
    expect(k.formulir.map((f) => f.kode)).toEqual(["RM.04"]);
    expect(k).toMatchObject({ total: 1, lengkap: true });
  });

  it("status BATAL tidak pernah dihitung (diperlakukan KOSONG)", () => {
    expect(status(kelengkapanDari({ "RM.21": isian("BATAL") }, FORMS, jenis(2)), "RM.21")).toBe("KOSONG");
    expect(statusPasien(null)).toBe("KOSONG");
  });

  it("wajibBagi: irisan wajibUntuk dengan jenis kunjungan episode", () => {
    expect(wajibBagi({ wajibUntuk: [2] }, jenis(2, 3))).toBe(true);
    expect(wajibBagi({ wajibUntuk: [2] }, jenis(3))).toBe(false);
    expect(wajibBagi({ wajibUntuk: [2, 3] }, jenis())).toBe(false);
  });
});

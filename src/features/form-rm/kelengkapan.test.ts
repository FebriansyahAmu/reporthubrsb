import { describe, expect, it } from "vitest";
import { kelengkapanDari } from "./kelengkapan";
import { KODE_FORM } from "./registry";
import type { RingkasIsian } from "@/server/modules/form-rm/isian.types";

const isian = (status: RingkasIsian["status"]): RingkasIsian => ({ id: "x", status, rev: 1, updatedAt: "2026-10-06T00:00:00.000Z" });

describe("kelengkapanDari", () => {
  it("tanpa isian → semua KOSONG, belum lengkap", () => {
    const k = kelengkapanDari({});
    expect(k).toMatchObject({ terisi: 0, final: 0, total: KODE_FORM.length, lengkap: false });
    expect(Object.values(k.status).every((s) => s === "KOSONG")).toBe(true);
  });

  it("DRAF dihitung terisi tetapi tidak membuat lengkap", () => {
    const k = kelengkapanDari({ "RM.04": isian("FINAL"), "RM.21": isian("DRAF") });
    expect(k).toMatchObject({ terisi: 2, final: 1, lengkap: false });
    expect(k.status["RM.21"]).toBe("DRAF");
    expect(k.status["RM.01"]).toBe("KOSONG");
  });

  it("lengkap hanya bila semua form FINAL", () => {
    const semua = Object.fromEntries(KODE_FORM.map((kode) => [kode, isian("FINAL")]));
    expect(kelengkapanDari(semua)).toMatchObject({ terisi: KODE_FORM.length, final: KODE_FORM.length, lengkap: true });
  });

  it("status BATAL tidak pernah dihitung (diperlakukan KOSONG)", () => {
    expect(kelengkapanDari({ "RM.03": isian("BATAL") }).status["RM.03"]).toBe("KOSONG");
  });
});

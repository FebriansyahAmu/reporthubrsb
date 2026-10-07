import { describe, expect, it } from "vitest";
import { AKSI_FORM, hakDari, PASANGAN_HAK } from "./hak";
import { DAFTAR_KATEGORI } from "./kategori";

const hak = (...izin: string[]) => hakDari(new Set(izin), false);

describe("hak Form RM per kategori", () => {
  it("modul `form-rm` = semua kategori (grant lama tetap berlaku)", () => {
    const h = hak(...AKSI_FORM.map((a) => `form-rm:${a}`));
    for (const k of DAFTAR_KATEGORI) for (const a of AKSI_FORM) expect(h.boleh(k, a)).toBe(true);
  });

  it("modul kategori hanya membuka kategorinya sendiri", () => {
    const h = hak("form-rm.gawat-darurat:view", "form-rm.gawat-darurat:create", "form-rm.gawat-darurat:update");
    expect(h.boleh("gawat-darurat", "update")).toBe(true);
    expect(h.boleh("gawat-darurat", "print")).toBe(false);
    expect(h.boleh("edukasi", "view")).toBe(false);
    expect(h.boleh("administrasi-persetujuan", "create")).toBe(false);
  });

  it("aksi tanpa `view` pada kategori itu tak berlaku", () => {
    const h = hak("form-rm.edukasi:create", "form-rm.edukasi:update", "form-rm.edukasi:print");
    for (const a of AKSI_FORM) expect(h.boleh("edukasi", a)).toBe(false);
  });

  it("view dari modul semua kategori + aksi dari modul kategori digabung", () => {
    const h = hak("form-rm:view", "form-rm.edukasi:update");
    expect(h.boleh("edukasi", "update")).toBe(true);
    expect(h.boleh("gawat-darurat", "update")).toBe(false);
    expect(h.boleh("gawat-darurat", "view")).toBe(true);
  });

  it("izin di luar Form RM (mis. form-rm.kelola:view, dashboard) tak membuka form", () => {
    const h = hak("form-rm.kelola:view", "form-rm.kelola:update", "dashboard:view");
    for (const k of DAFTAR_KATEGORI) expect(h.boleh(k, "view")).toBe(false);
  });

  it("kelola diteruskan apa adanya", () => {
    expect(hakDari(new Set(), true).kelola).toBe(true);
    expect(hakDari(new Set(), false).kelola).toBe(false);
  });

  it("pasangan resolusi = (semua + tiap kategori) × 4 aksi, tanpa duplikat", () => {
    const kunci = PASANGAN_HAK.map(([m, a]) => `${m}:${a}`);
    expect(kunci).toHaveLength((DAFTAR_KATEGORI.length + 1) * AKSI_FORM.length);
    expect(new Set(kunci).size).toBe(kunci.length);
  });
});

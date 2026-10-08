import { describe, expect, it } from "vitest";
import { DAFTAR_KATEGORI, MODUL_AKSES_FORM_RM, modulKategori } from "@/features/form-rm/kategori";
import { getModule, isValidModuleAction, MODULE_KEYS, moduleKeyForApiPath } from "./modules";

describe("katalog modul RBAC", () => {
  it("kunci modul unik", () => {
    expect(new Set(MODULE_KEYS).size).toBe(MODULE_KEYS.length);
  });

  it("Form RM: modul semua kategori tetap ada (grant lama berlaku) + satu modul per kategori", () => {
    expect(getModule("form-rm")?.actions).toEqual(["view", "create", "update", "print"]);
    for (const k of DAFTAR_KATEGORI) {
      const m = getModule(modulKategori(k));
      expect(m, k).toBeDefined();
      expect(m?.group).toBe("Form RM");
      for (const a of ["view", "create", "update", "print"]) expect(isValidModuleAction(modulKategori(k), a)).toBe(true);
      expect(isValidModuleAction(modulKategori(k), "delete")).toBe(false);
    }
    for (const k of MODUL_AKSES_FORM_RM) expect(MODULE_KEYS).toContain(k);
    expect(isValidModuleAction("form-rm.kelola", "update")).toBe(true);
  });

  it("Pemetaan RL terpisah dari Pusat Laporan (least privilege)", () => {
    expect(moduleKeyForApiPath("/api/laporan/rl32/pemetaan")).toBe("laporan.pemetaan-rl");
    expect(moduleKeyForApiPath("/api/laporan/rl32")).toBe("laporan");
    expect(moduleKeyForApiPath("/api/laporan/rl32/export")).toBe("laporan");
    expect(isValidModuleAction("laporan.pemetaan-rl", "update")).toBe(true);
    expect(isValidModuleAction("laporan.pemetaan-rl", "delete")).toBe(false);
  });

  it("API Form RM tetap dipetakan ke modul form-rm (kontrak)", () => {
    expect(moduleKeyForApiPath("/api/form-rm/f/RM.04/pasien")).toBe("form-rm");
    expect(moduleKeyForApiPath("/api/form-rm/isian/abc")).toBe("form-rm");
  });
});

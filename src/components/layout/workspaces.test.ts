import { describe, expect, it } from "vitest";
import { MODULE_KEYS } from "@/server/rbac/modules";
import { halamanAwal } from "./workspaces";

const izin = (...k: string[]) => new Set(k);

describe("halamanAwal (tujuan setelah masuk)", () => {
  it("superadmin / punya Dasbor → dasbor", () => {
    expect(halamanAwal(new Set(MODULE_KEYS))).toBe("/dashboard");
    expect(halamanAwal(izin("dashboard", "berkas-klaim"))).toBe("/dashboard");
  });

  it("tanpa Dasbor → modul pertama yang diizinkan (urutan menu), bukan /403", () => {
    expect(halamanAwal(izin("berkas-klaim"))).toBe("/berkas-klaim/rm");
    expect(halamanAwal(izin("audit-rme.surat-kontrol"))).toBe("/audit-rme/surat-kontrol");
    expect(halamanAwal(izin("inventaris.kir", "rekap-klaim.data"))).toBe("/inventaris/kir");
    expect(halamanAwal(izin("monitoring.pelayanan"))).toBe("/monitoring/pelayanan/kunjungan");
  });

  it("modul alternatif (anyOf) & kategori Form RM ikut dihitung", () => {
    expect(halamanAwal(izin("berkas-klaim.paket"))).toBe("/berkas-klaim/verifikasi");
    expect(halamanAwal(izin("form-rm.gawat-darurat"))).toBe("/form-rm");
  });

  it("modul kerja didahulukan dari Master; hanya Master → Master", () => {
    expect(halamanAwal(izin("master.peran", "laporan"))).toBe("/laporan");
    expect(halamanAwal(izin("master.peran"))).toBe("/master/peran");
  });

  it("tanpa modul apa pun → null (halaman 403 menjelaskan)", () => {
    expect(halamanAwal(izin())).toBeNull();
    expect(halamanAwal(izin("modul-tak-dikenal"))).toBeNull();
  });
});

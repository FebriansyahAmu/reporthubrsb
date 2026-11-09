import { describe, expect, it } from "vitest";
import { MODULE_KEYS, MODULES } from "@/server/rbac/modules";
import { halamanAwal, visibleWorkspaces, workspaceKeyForPath, WORKSPACES } from "./workspaces";

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
    expect(halamanAwal(izin("bckh"))).toBe("/bckh");
    expect(halamanAwal(izin("bckh.tim"))).toBe("/bckh/tim");
    expect(halamanAwal(izin("bckh.persetujuan"))).toBe("/bckh/persetujuan");
  });

  it("setiap modul ber-navHref punya item menu (tak ada halaman yatim tanpa menu)", () => {
    // Sengaja tanpa item sidebar: dibuka dari kartu Pusat Laporan / rute lama.
    const lewatKatalog = new Set(["kunjungan", "laporan.pendapatan"]);
    const hrefMenu = new Set(WORKSPACES.flatMap((w) => w.items.map((i) => i.href)));
    const yatim = MODULES.filter((m) => m.navHref && !lewatKatalog.has(m.key) && !hrefMenu.has(m.navHref)).map(
      (m) => `${m.key} → ${m.navHref}`,
    );
    expect(yatim).toEqual([]);
  });

  it("Form RM: Katalog, Per Pasien, Riwayat Pengisian untuk setiap kategori", () => {
    const ws = visibleWorkspaces(izin("form-rm.kebidanan")).find((w) => w.key === "form-rm");
    expect(ws?.items.map((i) => i.href)).toEqual(["/form-rm", "/form-rm/pasien", "/form-rm/riwayat"]);
    expect(workspaceKeyForPath("/form-rm/riwayat")).toBe("form-rm");
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

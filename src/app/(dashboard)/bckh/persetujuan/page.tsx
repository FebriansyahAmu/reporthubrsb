import { PageHeader } from "@/components/layout/PageHeader";
import { FadeIn } from "@/components/motion/Motion";
import { PersetujuanView } from "@/features/bckh/PersetujuanView";
import { tabPersetujuanDari } from "@/features/bckh/tab";
import { tanggalHariIniWita } from "@/lib/format";
import { jumlahMenunggu } from "@/server/modules/bckh/bckh.persetujuan";
import { hasModule, requireModule } from "@/server/rbac/guard";

export const metadata = {
  title: "Pegawai & Persetujuan BCKH · AuditTrail RS BOLTIM",
};
export const dynamic = "force-dynamic";

/**
 * Menu atasan (PRD §15.4) — `bckh.persetujuan:view`: laporan yang menunggu tanda
 * tangan, riwayat, dan pegawai bawahan. `?tab=menunggu|riwayat|pegawai`, `?buka=<id>`.
 */
export default async function BckhPersetujuanPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requireModule("bckh.persetujuan");
  const sp = await searchParams;
  const [cetak, menunggu] = await Promise.all([hasModule(user, "bckh.persetujuan", "print"), jumlahMenunggu(user.id)]);
  const buka = typeof sp.buka === "string" && /^[a-z0-9]{1,30}$/.test(sp.buka) ? sp.buka : null;
  return (
    <FadeIn className="space-y-6">
      <PageHeader
        title="Pegawai & Persetujuan"
        description="Tinjau, setujui, dan tanda tangani Laporan Kinerja Harian yang diajukan pegawai Anda, lalu pantau pengisian BCKH mereka setiap bulan."
      />
      <PersetujuanView hariIni={tanggalHariIniWita()} tabAwal={tabPersetujuanDari(sp.tab)} bukaAwal={buka} menungguAwal={menunggu} bolehCetak={cetak} />
    </FadeIn>
  );
}

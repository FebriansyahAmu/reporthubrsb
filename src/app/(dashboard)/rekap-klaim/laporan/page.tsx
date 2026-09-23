import { PageHeader } from "@/components/layout/PageHeader";
import { FadeIn } from "@/components/motion/Motion";
import { LaporanView } from "@/features/rekap-klaim/LaporanView";
import { hasModule, requireModule } from "@/server/rbac/guard";

export const metadata = { title: "Laporan Klaim · AuditTrail RS BOLTIM" };
export const dynamic = "force-dynamic";

export default async function LaporanKlaimPage() {
  const user = await requireModule("rekap-klaim.laporan");
  const canPrint = await hasModule(user, "rekap-klaim.laporan", "print");
  return (
    <FadeIn className="space-y-6">
      <PageHeader
        title="Laporan & Rekapitulasi Klaim"
        description="Rekap per tahun, perbandingan antar tahun, laporan klaim pending & rujukan ambulans — dengan export Excel & PDF."
      />
      <LaporanView canPrint={canPrint} />
    </FadeIn>
  );
}

import { ComingSoon } from "@/features/rekap-klaim/ComingSoon";
import { requireModule } from "@/server/rbac/guard";

export const metadata = { title: "Laporan Klaim · AuditTrail RS BOLTIM" };
export const dynamic = "force-dynamic";

export default async function LaporanKlaimPage() {
  await requireModule("rekap-klaim.laporan");
  return (
    <ComingSoon
      title="Laporan & Rekapitulasi Klaim"
      description="Rekap per tahun, laporan pending & rujukan, perbandingan antar tahun, serta export Excel/PDF."
      sesi="Sesi 5 (Laporan & Export)"
    />
  );
}

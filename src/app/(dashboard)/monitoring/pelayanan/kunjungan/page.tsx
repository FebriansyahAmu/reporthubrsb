import { PageHeader } from "@/components/layout/PageHeader";
import { FadeIn } from "@/components/motion/Motion";
import { KunjunganPelayananView } from "@/features/monitoring-pelayanan/KunjunganPelayananView";
import { getRuanganKunjunganList } from "@/server/modules/ruangan/ruangan.service";

export const metadata = { title: "Monitoring Kunjungan · ReportHub RSB" };
// Data ruangan diambil dari SIMGOS saat request.
export const dynamic = "force-dynamic";

export default async function MonitoringKunjunganPage() {
  const ruangan = await getRuanganKunjunganList().catch(() => []);
  const nowIso = new Date().toISOString();

  return (
    <FadeIn className="space-y-6">
      <PageHeader
        title="Monitoring Kunjungan"
        description="Kunjungan per rentang waktu dengan lama rawat. Baris merah = pasien belum difinalkan (KELUAR kosong) — lama dihitung sampai sekarang."
      />
      <KunjunganPelayananView ruanganOptions={ruangan} nowIso={nowIso} />
    </FadeIn>
  );
}

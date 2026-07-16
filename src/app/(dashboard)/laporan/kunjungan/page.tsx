import { PageHeader } from "@/components/layout/PageHeader";
import { FadeIn } from "@/components/motion/Motion";
import { LaporanKunjunganView } from "@/features/laporan-kunjungan/LaporanKunjunganView";

export const metadata = { title: "Laporan Kunjungan · ReportHub RSB" };

export default function LaporanKunjunganPage() {
  return (
    <FadeIn className="space-y-6">
      <PageHeader
        title="Laporan Kunjungan Pasien"
        description="Rekap kunjungan dengan ringkasan dan rincian. Filter, cetak, atau ekspor sesuai kebutuhan."
      />
      <LaporanKunjunganView />
    </FadeIn>
  );
}

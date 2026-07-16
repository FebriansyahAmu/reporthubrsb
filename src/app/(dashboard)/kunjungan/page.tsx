import { PageHeader } from "@/components/layout/PageHeader";
import { FadeIn } from "@/components/motion/Motion";
import { KunjunganView } from "@/features/kunjungan/KunjunganView";

export const metadata = { title: "Kunjungan Pasien · ReportHub RSB" };

export default function KunjunganPage() {
  return (
    <FadeIn className="space-y-6">
      <PageHeader
        title="Kunjungan Pasien"
        description="Daftar kunjungan pasien dari SIMGOS. Gunakan filter untuk mempersempit hasil."
      />
      <KunjunganView />
    </FadeIn>
  );
}

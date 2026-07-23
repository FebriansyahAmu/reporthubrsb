import { PageHeader } from "@/components/layout/PageHeader";
import { FadeIn } from "@/components/motion/Motion";
import { LaporanHub } from "@/features/laporan/LaporanHub";

export const metadata = { title: "Pusat Laporan · ReportHub RSB" };

export default function LaporanIndexPage() {
  return (
    <FadeIn className="space-y-6">
      <PageHeader
        title="Pusat Laporan"
        description="Katalog seluruh laporan yang tersedia dan yang akan datang. Pilih laporan untuk membukanya."
      />
      <LaporanHub />
    </FadeIn>
  );
}

import { PageHeader } from "@/components/layout/PageHeader";
import { FadeIn } from "@/components/motion/Motion";
import { ResumeMedikSearchView } from "@/features/resume-medik/ResumeMedikSearchView";

export const metadata = { title: "Cetak Resume Medik · ReportHub RSB" };

export default function ResumeMedikPage() {
  return (
    <FadeIn className="space-y-6">
      <PageHeader
        title="Cetak Resume Medik"
        description="Cari kunjungan yang sudah selesai, lalu cetak resume mediknya."
      />
      <ResumeMedikSearchView />
    </FadeIn>
  );
}

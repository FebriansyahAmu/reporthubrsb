import { PageHeader } from "@/components/layout/PageHeader";
import { FadeIn } from "@/components/motion/Motion";
import { ResumeMedisBrowser } from "@/features/resume-medis/ResumeMedisBrowser";
import { getKunjunganResumeList } from "@/server/modules/kunjungan/kunjungan.service";

export const metadata = { title: "Resume Medis · ReportHub RSB" };

export default async function ResumeMedisListPage() {
  const list = await getKunjunganResumeList();
  // Tanggal dari server agar SSR & hidrasi konsisten (default = minggu berjalan).
  const nowIso = new Date().toISOString();

  return (
    <FadeIn className="space-y-6">
      <PageHeader
        title="Cetak Resume Medis"
        description="Kunjungan per minggu — dipisah Rawat Inap, Rawat Jalan Klinik, dan IGD. Kartu merah = pasien belum keluar (kolom KELUAR kosong) dan belum bisa dicetak."
      />

      <ResumeMedisBrowser items={list} nowIso={nowIso} />
    </FadeIn>
  );
}

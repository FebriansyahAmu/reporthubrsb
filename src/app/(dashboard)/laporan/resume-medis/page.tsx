import { PageHeader } from "@/components/layout/PageHeader";
import { FadeIn } from "@/components/motion/Motion";
import { ResumeMedisBrowser } from "@/features/resume-medis/ResumeMedisBrowser";
import { getRuanganKunjunganList } from "@/server/modules/ruangan/ruangan.service";

export const metadata = { title: "Resume Medis · ReportHub RSB" };
// Selalu render dinamis: data ruangan diambil dari SIMGOS saat request.
export const dynamic = "force-dynamic";

export default async function ResumeMedisListPage() {
  // Ruangan untuk dropdown filter (gagal → dropdown "Semua ruangan" saja).
  const ruangan = await getRuanganKunjunganList().catch(() => []);
  const nowIso = new Date().toISOString();

  return (
    <FadeIn className="space-y-6">
      <PageHeader
        title="Cetak Resume Medis"
        description="Kunjungan per minggu — dipisah Rawat Inap, Rawat Jalan Klinik, dan IGD. Kartu merah = pasien belum keluar (kolom KELUAR kosong) dan belum bisa dicetak."
      />

      <ResumeMedisBrowser ruanganOptions={ruangan} nowIso={nowIso} />
    </FadeIn>
  );
}

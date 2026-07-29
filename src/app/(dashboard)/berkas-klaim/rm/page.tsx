import { PageHeader } from "@/components/layout/PageHeader";
import { FadeIn } from "@/components/motion/Motion";
import { BerkasKlaimRMView } from "@/features/berkas-klaim/BerkasKlaimRMView";
import { getRuanganKunjunganList } from "@/server/modules/ruangan/ruangan.service";

export const metadata = { title: "Berkas Klaim RM · ReportHub RSB" };
export const dynamic = "force-dynamic";

export default async function BerkasKlaimRMPage() {
  const ruangan = await getRuanganKunjunganList().catch(() => []);
  const nowIso = new Date().toISOString();

  return (
    <FadeIn className="space-y-6">
      <PageHeader
        title="Berkas Klaim RM"
        description="Pasien yang sudah selesai/final — siap dirakit berkas klaimnya. Pilih pasien untuk membuka kelengkapan dokumen (Rekam Medis, Triase, SEP, SPRI, Bukti Pelayanan, CPPT, Resume Pulang) dan cetak."
      />
      <BerkasKlaimRMView ruanganOptions={ruangan} nowIso={nowIso} />
    </FadeIn>
  );
}

import { PageHeader } from "@/components/layout/PageHeader";
import { FadeIn } from "@/components/motion/Motion";
import { ResumeView } from "@/features/monitoring-pelayanan/ResumeView";
import { getRuanganKunjunganList } from "@/server/modules/ruangan/ruangan.service";

export const metadata = { title: "Kelengkapan Resume Medis · ReportHub RSB" };
export const dynamic = "force-dynamic";

export default async function ResumePage() {
  const ruangan = await getRuanganKunjunganList().catch(() => []);
  const nowIso = new Date().toISOString();

  return (
    <FadeIn className="space-y-6">
      <PageHeader
        title="Kelengkapan Resume Medis"
        description="Kunjungan yang sudah final namun resume medisnya belum diinput atau belum lengkap. Pantau kepatuhan pengisian ringkasan pelayanan di SIMGOS."
      />
      <ResumeView ruanganOptions={ruangan} nowIso={nowIso} />
    </FadeIn>
  );
}

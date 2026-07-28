import { PageHeader } from "@/components/layout/PageHeader";
import { FadeIn } from "@/components/motion/Motion";
import { DiagnosaView } from "@/features/monitoring-pelayanan/DiagnosaView";
import { getRuanganKunjunganList } from "@/server/modules/ruangan/ruangan.service";

export const metadata = { title: "Kelengkapan Diagnosa · ReportHub RSB" };
export const dynamic = "force-dynamic";

export default async function DiagnosaPage() {
  const ruangan = await getRuanganKunjunganList().catch(() => []);
  const nowIso = new Date().toISOString();

  return (
    <FadeIn className="space-y-6">
      <PageHeader
        title="Kelengkapan Diagnosa"
        description="Kunjungan yang sudah final namun diagnosanya belum lengkap — tanpa diagnosa, tanpa kode ICD, atau tanpa diagnosa utama. Pantau kepatuhan koding."
      />
      <DiagnosaView ruanganOptions={ruangan} nowIso={nowIso} />
    </FadeIn>
  );
}

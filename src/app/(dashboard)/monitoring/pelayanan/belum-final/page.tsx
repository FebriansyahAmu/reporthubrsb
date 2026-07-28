import { PageHeader } from "@/components/layout/PageHeader";
import { FadeIn } from "@/components/motion/Motion";
import { BelumFinalView } from "@/features/monitoring-pelayanan/BelumFinalView";
import { getRuanganKunjunganList } from "@/server/modules/ruangan/ruangan.service";

export const metadata = { title: "Belum Difinalkan · ReportHub RSB" };
export const dynamic = "force-dynamic";

export default async function BelumFinalPage() {
  const ruangan = await getRuanganKunjunganList().catch(() => []);

  return (
    <FadeIn className="space-y-6">
      <PageHeader
        title="Belum Difinalkan"
        description="Kunjungan dengan KELUAR masih kosong (belum ditutup), diurut dari yang paling lama terbuka. Pantau kepatuhan finalisasi."
      />
      <BelumFinalView ruanganOptions={ruangan} />
    </FadeIn>
  );
}

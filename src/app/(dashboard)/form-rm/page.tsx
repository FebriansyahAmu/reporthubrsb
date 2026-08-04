import { PageHeader } from "@/components/layout/PageHeader";
import { FadeIn } from "@/components/motion/Motion";
import { FormRmListView } from "@/features/form-rm/FormRmListView";
import { getRuanganKunjunganList } from "@/server/modules/ruangan/ruangan.service";

export const metadata = { title: "Form RM · ReportHub RSB" };
export const dynamic = "force-dynamic";

export default async function FormRmListPage() {
  const ruangan = (await getRuanganKunjunganList().catch(() => [])).filter(
    (r) => r.kategori === "IGD",
  );
  const nowIso = new Date().toISOString();

  return (
    <FadeIn className="space-y-6">
      <PageHeader
        title="Form RM (Admisi)"
        description="Pasien yang baru masuk lewat IGD — pilih pasien untuk mengisi formulir Rekam Medis di awal kunjungan (Edukasi Pasien RM.21, Ringkasan Masuk & Keluar RM.01, General Consent RM.03)."
      />
      <FormRmListView ruanganOptions={ruangan} nowIso={nowIso} />
    </FadeIn>
  );
}

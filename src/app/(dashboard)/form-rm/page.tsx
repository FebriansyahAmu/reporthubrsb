import { PageHeader } from "@/components/layout/PageHeader";
import { FadeIn } from "@/components/motion/Motion";
import { FormRmListView } from "@/features/form-rm/FormRmListView";
import { PindahDataLama } from "@/features/form-rm/isian/PindahDataLama";
import { hasModule, requireModule } from "@/server/rbac/guard";
import { hitungDataLamaTertunda } from "@/server/modules/form-rm/isian.lama";
import { getRuanganKunjunganList } from "@/server/modules/ruangan/ruangan.service";

export const metadata = { title: "Form RM · AuditTrail RS BOLTIM" };
export const dynamic = "force-dynamic";

export default async function FormRmListPage() {
  const user = await requireModule("form-rm", "view");
  const [ruangan, dataLama] = await Promise.all([
    getRuanganKunjunganList()
      .catch(() => [])
      .then((rs) => rs.filter((r) => r.kategori === "IGD")),
    // Hanya pengelola RM yang melihat & memicu pemindahan data lama.
    hasModule(user, "form-rm.kelola", "update").then((kelola) => (kelola ? hitungDataLamaTertunda().catch(() => 0) : 0)),
  ]);
  const nowIso = new Date().toISOString();

  return (
    <FadeIn className="space-y-6">
      <PageHeader
        title="Form RM (Admisi)"
        description="Pasien yang baru masuk lewat IGD — pilih pasien untuk mengisi formulir Rekam Medis (Triase RM.04, Edukasi Pasien RM.21, Ringkasan Masuk & Keluar RM.01, General Consent RM.03). Lengkap = semua form FINAL."
      />
      {dataLama > 0 && <PindahDataLama jumlah={dataLama} />}
      <FormRmListView ruanganOptions={ruangan} nowIso={nowIso} />
    </FadeIn>
  );
}

import { PageHeader } from "@/components/layout/PageHeader";
import { FadeIn } from "@/components/motion/Motion";
import { LaporanHub } from "@/features/laporan/LaporanHub";
import { requireModule } from "@/server/rbac/guard";
import { allowedModuleKeys } from "@/server/rbac/permissions";

export const metadata = { title: "Pusat Laporan · AuditTrail RS BOLTIM" };
export const dynamic = "force-dynamic";

export default async function LaporanIndexPage() {
  const user = await requireModule("laporan");
  const allowed = await allowedModuleKeys(user.role);

  return (
    <FadeIn className="space-y-6">
      <PageHeader
        title="Pusat Laporan"
        description="Katalog seluruh laporan yang tersedia dan yang akan datang. Pilih laporan untuk membukanya."
      />
      <LaporanHub allowed={allowed} />
    </FadeIn>
  );
}

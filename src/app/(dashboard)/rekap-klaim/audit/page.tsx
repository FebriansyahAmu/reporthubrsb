import { PageHeader } from "@/components/layout/PageHeader";
import { FadeIn } from "@/components/motion/Motion";
import { AuditView } from "@/features/rekap-klaim/AuditView";
import { requireModule } from "@/server/rbac/guard";

export const metadata = { title: "Audit Trail Klaim · AuditTrail RS BOLTIM" };
export const dynamic = "force-dynamic";

export default async function AuditKlaimPage() {
  await requireModule("rekap-klaim.audit");
  return (
    <FadeIn className="space-y-6">
      <PageHeader
        title="Audit Trail Klaim"
        description="Riwayat perubahan data klaim & potongan — siapa mengubah apa dan kapan. Read-only untuk akuntabilitas."
      />
      <AuditView />
    </FadeIn>
  );
}

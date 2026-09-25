import { PageHeader } from "@/components/layout/PageHeader";
import { FadeIn } from "@/components/motion/Motion";
import { AuditStatusView } from "@/features/audit-rme/AuditStatusView";
import { requireModule } from "@/server/rbac/guard";

export const metadata = { title: "Audit Trail RME · AuditTrail RS BOLTIM" };
export const dynamic = "force-dynamic";

export default async function AuditRmePage() {
  await requireModule("audit-rme");

  return (
    <FadeIn className="space-y-6">
      <PageHeader
        title="Audit Trail RME"
        description="Log aktivitas rekam medis elektronik (read-only dari SIMGOS) — pemantauan penambahan, perubahan, dan akses data untuk kepatuhan."
      />
      <AuditStatusView />
    </FadeIn>
  );
}

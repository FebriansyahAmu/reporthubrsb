import { PageHeader } from "@/components/layout/PageHeader";
import { FadeIn } from "@/components/motion/Motion";
import { AuditRmeView } from "@/features/audit-rme/AuditRmeView";
import { hasModule, requireModule } from "@/server/rbac/guard";

export const metadata = { title: "Audit Trail RME · AuditTrail RS BOLTIM" };
export const dynamic = "force-dynamic";

export default async function AuditRmePage() {
  const user = await requireModule("audit-rme");
  const bolehEkspor = await hasModule(user, "audit-rme", "print");

  return (
    <FadeIn className="space-y-6">
      <PageHeader
        title="Audit Trail RME"
        description="Kepatuhan pengimputan RME per kunjungan & ruangan — data aktual + log aktivitas (read-only dari SIMGOS)."
      />
      <AuditRmeView bolehEkspor={bolehEkspor} />
    </FadeIn>
  );
}

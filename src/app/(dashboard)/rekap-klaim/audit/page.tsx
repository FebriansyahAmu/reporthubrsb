import { ComingSoon } from "@/features/rekap-klaim/ComingSoon";
import { requireModule } from "@/server/rbac/guard";

export const metadata = { title: "Audit Trail Klaim · AuditTrail RS BOLTIM" };
export const dynamic = "force-dynamic";

export default async function AuditKlaimPage() {
  await requireModule("rekap-klaim.audit");
  return (
    <ComingSoon
      title="Audit Trail Klaim"
      description="Riwayat perubahan data klaim (siapa mengubah apa dan kapan) — read-only untuk akuntabilitas."
      sesi="Sesi 7 (Audit Trail Viewer)"
    />
  );
}

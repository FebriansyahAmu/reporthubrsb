import { PageHeader } from "@/components/layout/PageHeader";
import { FadeIn } from "@/components/motion/Motion";
import { AuditSuratKontrolView } from "@/features/surat-kontrol/AuditSuratKontrolView";
import { hasModule, requireModule } from "@/server/rbac/guard";

export const metadata = { title: "Audit Surat Kontrol · AuditTrail RS BOLTIM" };
export const dynamic = "force-dynamic";

export default async function AuditSuratKontrolPage() {
  const user = await requireModule("audit-rme.surat-kontrol");
  const bolehEkspor = await hasModule(user, "audit-rme.surat-kontrol", "print");

  return (
    <FadeIn className="space-y-6">
      <PageHeader
        title="Audit Surat Kontrol"
        description="Surat Kontrol & SPRI yang terbit di BPJS dibandingkan dengan jadwal di SIMRS — tanggal, poli, status & jam (read-only)."
      />
      <AuditSuratKontrolView bolehEkspor={bolehEkspor} />
    </FadeIn>
  );
}

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { FadeIn } from "@/components/motion/Motion";
import { DataKlaimView } from "@/features/rekap-klaim/DataKlaimView";
import { hasModule, requireModule } from "@/server/rbac/guard";

export const metadata = { title: "Data Klaim · AuditTrail RS BOLTIM" };
export const dynamic = "force-dynamic";

export default async function DataKlaimPage() {
  const user = await requireModule("rekap-klaim.data");
  const [create, update, del] = await Promise.all([
    hasModule(user, "rekap-klaim.data", "create"),
    hasModule(user, "rekap-klaim.data", "update"),
    hasModule(user, "rekap-klaim.data", "delete"),
  ]);

  return (
    <FadeIn className="space-y-6">
      <Link href="/rekap-klaim" className="inline-flex items-center gap-1.5 text-sm font-medium text-fg-muted transition-colors hover:text-fg">
        <ArrowLeft className="size-4" />
        Kembali ke Rekap Klaim
      </Link>
      <PageHeader
        title="Data Klaim"
        description="Entri & kelola klaim INA-CBG's dan rujukan ambulans BPJS — Reguler, Pending, Susulan."
      />
      <DataKlaimView perms={{ create, update, delete: del }} />
    </FadeIn>
  );
}

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { FadeIn } from "@/components/motion/Motion";
import { ChecklistView } from "@/features/inventaris/pemeliharaan/ChecklistView";
import { hasModule, requireModule } from "@/server/rbac/guard";

export const metadata = { title: "Pemeliharaan Barang · AuditTrail RS BOLTIM" };
export const dynamic = "force-dynamic";

export default async function PemeliharaanPage() {
  const user = await requireModule("inventaris.pemeliharaan");
  const [canCreate, canUpdate] = await Promise.all([
    hasModule(user, "inventaris.pemeliharaan", "create"),
    hasModule(user, "inventaris.pemeliharaan", "update"),
  ]);

  return (
    <FadeIn className="space-y-6">
      <Link
        href="/inventaris"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-fg-muted transition-colors hover:text-fg"
      >
        <ArrowLeft className="size-4" />
        Kembali ke Inventarisasi
      </Link>
      <PageHeader
        title="Checklist Pemeliharaan"
        description="Checklist perawatan berkala per ruangan — harian, mingguan, bulanan. Centang tiap barang lewat kartu, telusuri riwayat pelaksanaan, dan ekspor ke Excel."
      />
      <ChecklistView canCreate={canCreate} canUpdate={canUpdate} />
    </FadeIn>
  );
}

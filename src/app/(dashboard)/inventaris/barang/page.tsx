import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { FadeIn } from "@/components/motion/Motion";
import { MasterBarangView } from "@/features/inventaris/barang/MasterBarangView";
import { hasModule, requireModule } from "@/server/rbac/guard";

export const metadata = { title: "Master Barang · AuditTrail RS BOLTIM" };
export const dynamic = "force-dynamic";

export default async function MasterBarangPage() {
  const user = await requireModule("inventaris.barang");
  const [create, update, del] = await Promise.all([
    hasModule(user, "inventaris.barang", "create"),
    hasModule(user, "inventaris.barang", "update"),
    hasModule(user, "inventaris.barang", "delete"),
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
        title="Master Barang"
        description="Data seluruh unit aset RSUD Boltim — kode otomatis, kondisi, lokasi, harga, QR, import & ekspor."
      />
      <MasterBarangView perms={{ create, update, delete: del }} />
    </FadeIn>
  );
}

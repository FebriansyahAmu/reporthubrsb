import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { FadeIn } from "@/components/motion/Motion";
import { PengaturanView } from "@/features/inventaris/pengaturan/PengaturanView";
import { hasModule, requireModule } from "@/server/rbac/guard";

export const metadata = { title: "Pengaturan Inventaris · AuditTrail RS BOLTIM" };
export const dynamic = "force-dynamic";

export default async function PengaturanInventarisPage() {
  const user = await requireModule("inventaris.pengaturan");
  const canManage = await hasModule(user, "inventaris.pengaturan", "update");

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
        title="Pengaturan Inventaris"
        description="Kelola data referensi modul inventaris: satuan, kondisi barang, sumber anggaran, kategori, dan ruangan (kode prefix + penanggung jawab)."
      />
      <PengaturanView canManage={canManage} />
    </FadeIn>
  );
}

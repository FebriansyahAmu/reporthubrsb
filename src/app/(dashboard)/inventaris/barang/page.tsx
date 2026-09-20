import Link from "next/link";
import { ArrowLeft, PackageSearch } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { FadeIn } from "@/components/motion/Motion";
import { ComingSoon } from "@/features/inventaris/ComingSoon";
import { requireModule } from "@/server/rbac/guard";

export const metadata = { title: "Master Barang · AuditTrail RS BOLTIM" };
export const dynamic = "force-dynamic";

export default async function MasterBarangPage() {
  await requireModule("inventaris.barang");
  return (
    <FadeIn className="space-y-6">
      <Link
        href="/inventaris"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-fg-muted transition-colors hover:text-fg"
      >
        <ArrowLeft className="size-4" />
        Kembali ke Inventarisasi
      </Link>
      <PageHeader title="Master Barang" description="Data seluruh unit aset RSUD Boltim." />
      <ComingSoon
        icon={PackageSearch}
        title="Master Barang — Sesi berikutnya"
        description="CRUD unit aset (kode otomatis, kondisi, lokasi, harga, nomor seri, foto & QR), lengkap dengan import data existing dan ekspor. Fondasi & Pengaturan sudah siap."
      />
    </FadeIn>
  );
}

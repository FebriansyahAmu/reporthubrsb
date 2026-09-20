import Link from "next/link";
import { ArrowLeft, Wrench } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { FadeIn } from "@/components/motion/Motion";
import { ComingSoon } from "@/features/inventaris/ComingSoon";
import { requireModule } from "@/server/rbac/guard";

export const metadata = { title: "Pemeliharaan Barang · AuditTrail RS BOLTIM" };
export const dynamic = "force-dynamic";

export default async function PemeliharaanPage() {
  await requireModule("inventaris.pemeliharaan");
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
        title="Pemeliharaan Barang"
        description="Checklist & riwayat perawatan/pengecekan aset."
      />
      <ComingSoon
        icon={Wrench}
        title="Pemeliharaan — Sesi berikutnya"
        description="Jadwalkan & catat inspeksi/perawatan per unit, dengan status jatuh tempo yang jelas dan notifikasi. Menunggu modul Master Barang."
      />
    </FadeIn>
  );
}

import Link from "next/link";
import { ArrowLeft, ClipboardList } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { FadeIn } from "@/components/motion/Motion";
import { ComingSoon } from "@/features/inventaris/ComingSoon";
import { requireModule } from "@/server/rbac/guard";

export const metadata = { title: "KIR · AuditTrail RS BOLTIM" };
export const dynamic = "force-dynamic";

export default async function KirPage() {
  await requireModule("inventaris.kir");
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
        title="KIR — Kartu Inventaris Ruangan"
        description="Daftar aset per ruangan, siap cetak resmi."
      />
      <ComingSoon
        icon={ClipboardList}
        title="KIR — Sesi berikutnya"
        description="Pilih ruangan untuk melihat seluruh asetnya, lalu cetak Kartu Inventaris Ruangan resmi bertanda tangan penanggung jawab. Menunggu modul Master Barang."
      />
    </FadeIn>
  );
}

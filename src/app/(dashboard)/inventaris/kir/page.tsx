import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { FadeIn } from "@/components/motion/Motion";
import { KirView } from "@/features/inventaris/kir/KirView";
import { hasModule, requireModule } from "@/server/rbac/guard";

export const metadata = { title: "KIR · AuditTrail RS BOLTIM" };
export const dynamic = "force-dynamic";

export default async function KirPage() {
  const user = await requireModule("inventaris.kir");
  const canPrint = await hasModule(user, "inventaris.kir", "print");

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
        description="Daftar aset per ruangan, siap cetak resmi bertanda tangan penanggung jawab."
      />
      <KirView canPrint={canPrint} />
    </FadeIn>
  );
}

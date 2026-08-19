import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { FadeIn } from "@/components/motion/Motion";
import { FarmasiObatView } from "@/features/laporan-farmasi/FarmasiObatView";

export const metadata = { title: "10 Obat Terbanyak · Pusat Laporan · ReportHub RSB" };
export const dynamic = "force-dynamic";

export default function FarmasiObatPage() {
  return (
    <FadeIn className="space-y-6">
      <Link
        href="/laporan"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-fg-muted transition-colors hover:text-fg"
      >
        <ArrowLeft className="size-4" />
        Kembali ke Pusat Laporan
      </Link>
      <PageHeader
        title="10 Obat Terbanyak"
        description="Peringkat obat & alkes paling banyak dikeluarkan farmasi pada suatu periode. Saring per kategori dan cara bayar, urutkan menurut kuantitas atau nilai."
      />
      <FarmasiObatView />
    </FadeIn>
  );
}

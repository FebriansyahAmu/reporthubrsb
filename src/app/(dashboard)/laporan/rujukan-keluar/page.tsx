import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { FadeIn } from "@/components/motion/Motion";
import { RujukanKeluarView } from "@/features/laporan-rujukan/RujukanKeluarView";

export const metadata = { title: "Rujukan Keluar · Pusat Laporan · ReportHub RSB" };
export const dynamic = "force-dynamic";

export default function RujukanKeluarPage() {
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
        title="Rujukan Keluar"
        description="Pasien yang dirujuk keluar ke fasilitas kesehatan lain (data BPJS). Menampilkan 10 terakhir — gunakan filter untuk mempersempit."
      />
      <RujukanKeluarView />
    </FadeIn>
  );
}

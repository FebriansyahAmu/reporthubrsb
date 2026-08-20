import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { FadeIn } from "@/components/motion/Motion";
import { PenyakitView } from "@/features/laporan-penyakit/PenyakitView";

export const metadata = { title: "10 Penyakit Terbanyak · Pusat Laporan · ReportHub RSB" };
export const dynamic = "force-dynamic";

export default function PenyakitPage() {
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
        title="10 Penyakit Terbanyak"
        description="Peringkat diagnosa ICD-10 terbanyak pada suatu periode. Pilih jenis layanan (rawat jalan/gawat darurat/rawat inap) & cara bayar, urutkan menurut jumlah kasus atau pasien."
      />
      <PenyakitView />
    </FadeIn>
  );
}

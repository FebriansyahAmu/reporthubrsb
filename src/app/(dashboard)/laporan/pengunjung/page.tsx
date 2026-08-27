import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { FadeIn } from "@/components/motion/Motion";
import { PengunjungView } from "@/features/laporan-pengunjung/PengunjungView";

export const metadata = { title: "Laporan Pengunjung Per Pasien · Pusat Laporan · ReportHub RSB" };
export const dynamic = "force-dynamic";

export default function PengunjungPage() {
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
        title="Laporan Pengunjung Per Pasien"
        description="Daftar kunjungan pasien per periode. Pisahkan berdasarkan jenis layanan (rawat jalan/gawat darurat/rawat inap) & ruangan; khusus IGD dibedakan rawat jalan vs lanjut rawat inap."
      />
      <PengunjungView />
    </FadeIn>
  );
}

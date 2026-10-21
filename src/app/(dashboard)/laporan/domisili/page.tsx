import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { FadeIn } from "@/components/motion/Motion";
import { DomisiliView } from "@/features/laporan-domisili/DomisiliView";

export const metadata = { title: "Klasifikasi Kunjungan per Domisili · Pusat Laporan · AuditTrail RS BOLTIM" };
export const dynamic = "force-dynamic";

export default function DomisiliPage() {
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
        title="Klasifikasi Kunjungan per Domisili"
        description="Kunjungan IGD, rawat jalan, dan rawat inap sekaligus, dipilah menurut domisili pasien: dalam atau luar Kabupaten Bolaang Mongondow Timur, dengan rincian per kecamatan dan per kabupaten/kota asal."
      />
      <DomisiliView />
    </FadeIn>
  );
}

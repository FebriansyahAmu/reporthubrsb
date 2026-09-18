import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { FadeIn } from "@/components/motion/Motion";
import { Rl51View } from "@/features/laporan-rl51/Rl51View";

export const metadata = {
  title: "RL 5.1 — Morbiditas Rawat Jalan · Pusat Laporan · AuditTrail RS BOLTIM",
};
export const dynamic = "force-dynamic";

export default function Rl51Page() {
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
        title="RL 5.1 — Morbiditas Rawat Jalan"
        description="Rekap diagnosa ICD-10 pasien rawat jalan & gawat darurat pada suatu periode, dirinci kunjungan, kasus baru, jenis kelamin, dan 25 kelompok umur kasus baru (format SIRS Kemenkes). Rincian 25 kelompok umur tersedia di Export Excel."
      />
      <Rl51View />
    </FadeIn>
  );
}

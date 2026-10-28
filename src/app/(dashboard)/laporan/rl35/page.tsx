import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { FadeIn } from "@/components/motion/Motion";
import { Rl35View } from "@/features/laporan-rl35/Rl35View";
import { hasModule, requireModule } from "@/server/rbac/guard";

export const metadata = {
  title: "RL 3.5 — Kunjungan · Pusat Laporan · AuditTrail RS BOLTIM",
};
export const dynamic = "force-dynamic";

/** Laporan butuh `laporan:view` (layout); panel pemetaan butuh `laporan.pemetaan-rl`. */
export default async function Rl35Page() {
  const user = await requireModule("laporan");
  const [lihatPeta, ubahPeta] = await Promise.all([
    hasModule(user, "laporan.pemetaan-rl", "view"),
    hasModule(user, "laporan.pemetaan-rl", "update"),
  ]);

  return (
    <FadeIn className="space-y-6">
      <Link
        href="/laporan"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-fg-muted transition-colors hover:text-fg"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Kembali ke Pusat Laporan
      </Link>
      <PageHeader
        title="RL 3.5 — Kunjungan"
        description="Rekapitulasi kunjungan (format SIRS 6) per bulan, triwulan, atau rentang tanggal: kunjungan poliklinik per jenis kegiatan dan rawat darurat, dirinci laki-laki/perempuan serta domisili dalam/luar kabupaten, ditambah rata-rata hari poliklinik buka dan kunjungan per hari."
      />
      <Rl35View bolehLihatPeta={lihatPeta} bolehUbahPeta={lihatPeta && ubahPeta} />
    </FadeIn>
  );
}

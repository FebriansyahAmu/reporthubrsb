import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { FadeIn } from "@/components/motion/Motion";
import { Rl32View } from "@/features/laporan-rl32/Rl32View";
import { hasModule, requireModule } from "@/server/rbac/guard";

export const metadata = {
  title: "RL 3.2 — Rawat Inap · Pusat Laporan · AuditTrail RS BOLTIM",
};
export const dynamic = "force-dynamic";

/** Laporan butuh `laporan:view` (layout); panel pemetaan butuh `laporan.pemetaan-rl`. */
export default async function Rl32Page() {
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
        title="RL 3.2 — Rawat Inap"
        description="Rekapitulasi kegiatan pelayanan rawat inap (format SIRS 6) per bulan, triwulan, atau rentang tanggal: pasien awal, masuk, pindahan, keluar hidup/mati, lama dirawat, hari perawatan per kelas, dan alokasi tempat tidur — dikelompokkan per jenis pelayanan menurut ruang rawatnya."
      />
      <Rl32View bolehLihatPeta={lihatPeta} bolehUbahPeta={lihatPeta && ubahPeta} />
    </FadeIn>
  );
}

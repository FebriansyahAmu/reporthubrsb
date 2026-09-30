import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { FadeIn } from "@/components/motion/Motion";
import { PendapatanUnitView } from "@/features/laporan-pendapatan/PendapatanUnitView";
import { CAKUPAN_DEFAULT, CAKUPAN_KEYS, type CakupanKey } from "@/server/modules/pendapatan-unit/pendapatan.constants";
import { hasModule, requireModule } from "@/server/rbac/guard";

export const metadata = {
  title: "Pendapatan per Unit · Pusat Laporan · AuditTrail RS BOLTIM",
};
export const dynamic = "force-dynamic";

/** `?layanan=ri` (tautan langsung) — nilai di luar katalog diabaikan. */
function layananAwal(v: string | string[] | undefined): CakupanKey {
  return typeof v === "string" && (CAKUPAN_KEYS as readonly string[]).includes(v) ? (v as CakupanKey) : CAKUPAN_DEFAULT;
}

/** Data keuangan: butuh `laporan.pendapatan:view` (layout /laporan sudah mensyaratkan `laporan`). */
export default async function PendapatanUnitPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireModule("laporan.pendapatan");
  const bolehEkspor = await hasModule(user, "laporan.pendapatan", "print");
  const { layanan } = await searchParams;

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
        title="Pendapatan per Unit"
        description="Pendapatan akomodasi & tindakan pelayanan tiap unit dari tagihan pasien — Rawat Jalan, IGD, Rawat Inap, Laboratorium, Radiologi & Farmasi — termasuk tagihan yang belum difinalkan kasir. Diolah dari SIMGOS (hanya dibaca) dengan logika SP LaporanPendapatanPerUnit."
      />
      <PendapatanUnitView bolehEkspor={bolehEkspor} layananAwal={layananAwal(layanan)} />
    </FadeIn>
  );
}

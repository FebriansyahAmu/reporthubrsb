import { PageHeader } from "@/components/layout/PageHeader";
import { FadeIn } from "@/components/motion/Motion";
import { DashboardView } from "@/features/dashboard/DashboardView";

export const metadata = { title: "Dashboard · AuditTrail RS BOLTIM" };
export const dynamic = "force-dynamic";

export default function DashboardPage() {
  return (
    <FadeIn className="space-y-6">
      <PageHeader
        title="Dashboard"
        description="Statistik ringkas kunjungan pasien (rawat jalan, IGD, rawat inap): tren harian, komposisi layanan, cara bayar, ruangan tersibuk, distribusi jam, dan sensus rawat inap."
      />
      <DashboardView />
    </FadeIn>
  );
}

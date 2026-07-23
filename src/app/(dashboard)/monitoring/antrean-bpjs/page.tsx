import { PageHeader } from "@/components/layout/PageHeader";
import { FadeIn } from "@/components/motion/Motion";
import { AntreanBpjsView } from "@/features/monitoring/AntreanBpjsView";

export const metadata = { title: "Monitoring Antrean BPJS · ReportHub RSB" };

export default function MonitoringAntreanBpjsPage() {
  return (
    <FadeIn className="space-y-6">
      <PageHeader
        title="Monitoring Antrean BPJS"
        description="Pantau progres antrean pasien menembus Task 1–7 (bridging Antrean RS BPJS) secara real-time."
      />
      <AntreanBpjsView />
    </FadeIn>
  );
}

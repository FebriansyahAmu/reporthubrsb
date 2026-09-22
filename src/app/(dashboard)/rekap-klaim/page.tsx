import Link from "next/link";
import { ArrowRight, FileBarChart, History, ReceiptText, type LucideIcon } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { FadeIn } from "@/components/motion/Motion";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/cn";
import { hasModule, requireModule } from "@/server/rbac/guard";

export const metadata = { title: "Rekap Klaim BPJS · AuditTrail RS BOLTIM" };
export const dynamic = "force-dynamic";

type Feature = {
  moduleKey: string;
  href: string;
  icon: LucideIcon;
  title: string;
  description: string;
  status: "tersedia" | "segera";
};

const FEATURES: Feature[] = [
  {
    moduleKey: "rekap-klaim.data",
    href: "/rekap-klaim/data",
    icon: ReceiptText,
    title: "Data Klaim",
    description: "Entri klaim INA-CBG's & rujukan ambulans (Reguler/Pending/Susulan) beserta potongan/adjustment.",
    status: "tersedia",
  },
  {
    moduleKey: "rekap-klaim.laporan",
    href: "/rekap-klaim/laporan",
    icon: FileBarChart,
    title: "Laporan & Rekapitulasi",
    description: "Rekap per tahun (format tabel), laporan pending & rujukan, perbandingan antar tahun, export Excel/PDF.",
    status: "segera",
  },
  {
    moduleKey: "rekap-klaim.audit",
    href: "/rekap-klaim/audit",
    icon: History,
    title: "Audit Trail",
    description: "Riwayat perubahan data klaim (siapa, kapan, apa yang berubah) — read-only untuk akuntabilitas.",
    status: "segera",
  },
];

export default async function RekapKlaimLandingPage() {
  const user = await requireModule("rekap-klaim");
  const visible = await Promise.all(
    FEATURES.map(async (f) => ({ ...f, allowed: await hasModule(user, f.moduleKey, "view") })),
  );

  return (
    <FadeIn className="space-y-6">
      <PageHeader
        title="Rekapitulasi Klaim BPJS"
        description="Rekap dana klaim INA-CBG's & rujukan ambulans BPJS — pencatatan terpusat, pelacakan potongan, status, dan audit trail."
      />

      {/* Dashboard analitik menyusul (Sesi 6) */}
      <div className="rounded-[var(--radius-lg)] border border-dashed border-border bg-surface-2/40 px-5 py-8 text-center">
        <p className="text-sm font-medium text-fg">Dashboard analitik sedang disiapkan</p>
        <p className="mx-auto mt-1 max-w-md text-xs leading-relaxed text-fg-muted">
          Ringkasan total klaim YTD, pending belum cair, potongan berjalan, dan tren bulanan akan tampil di sini.
        </p>
        <span className="mt-3 inline-flex"><Badge tone="neutral">Segera</Badge></span>
      </div>

      {/* Pintasan modul */}
      <div>
        <h2 className="mb-3 text-sm font-semibold text-fg-muted">Modul</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {visible
            .filter((f) => f.allowed)
            .map((f) => (
              <FeatureCard key={f.moduleKey} feature={f} />
            ))}
        </div>
      </div>
    </FadeIn>
  );
}

function FeatureCard({ feature }: { feature: Feature }) {
  const Icon = feature.icon;
  const available = feature.status === "tersedia";
  return (
    <Link
      href={feature.href}
      className={cn(
        "group flex flex-col rounded-[var(--radius-lg)] border border-border bg-surface p-4 transition-all",
        "hover:border-brand/40 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div
          className={cn(
            "flex size-10 items-center justify-center rounded-[var(--radius-md)]",
            available ? "bg-brand-soft text-brand" : "bg-surface-2 text-fg-subtle",
          )}
        >
          <Icon className="size-5" />
        </div>
        {available ? <Badge tone="success" dot>Tersedia</Badge> : <Badge tone="neutral">Segera</Badge>}
      </div>
      <div className="mt-3">
        <h3 className="flex items-center gap-1 text-sm font-semibold text-fg">
          {feature.title}
          <ArrowRight className="size-3.5 text-fg-subtle transition-transform group-hover:translate-x-0.5 group-hover:text-brand" />
        </h3>
        <p className="mt-1 text-xs leading-relaxed text-fg-muted">{feature.description}</p>
      </div>
    </Link>
  );
}

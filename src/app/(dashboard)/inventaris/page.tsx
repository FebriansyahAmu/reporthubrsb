import Link from "next/link";
import {
  ArrowRight,
  ClipboardList,
  PackageSearch,
  SlidersHorizontal,
  TrendingUp,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { FadeIn } from "@/components/motion/Motion";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/cn";
import { hasModule, requireModule } from "@/server/rbac/guard";

export const metadata = { title: "Inventarisasi Barang · AuditTrail RS BOLTIM" };
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
    moduleKey: "inventaris.pengaturan",
    href: "/inventaris/pengaturan",
    icon: SlidersHorizontal,
    title: "Pengaturan",
    description: "Kelola satuan, kondisi, sumber anggaran, kategori, dan ruangan (prefix + penanggung jawab).",
    status: "tersedia",
  },
  {
    moduleKey: "inventaris.barang",
    href: "/inventaris/barang",
    icon: PackageSearch,
    title: "Master Barang",
    description: "Data seluruh unit aset — kode otomatis, kondisi, lokasi, harga & QR. Import & ekspor.",
    status: "tersedia",
  },
  {
    moduleKey: "inventaris.kir",
    href: "/inventaris/kir",
    icon: ClipboardList,
    title: "KIR (Kartu Inventaris Ruangan)",
    description: "Daftar aset per ruangan siap cetak resmi bertanda tangan penanggung jawab.",
    status: "tersedia",
  },
  {
    moduleKey: "inventaris.pemeliharaan",
    href: "/inventaris/pemeliharaan",
    icon: Wrench,
    title: "Pemeliharaan",
    description: "Checklist & riwayat perawatan/pengecekan aset, dengan status jatuh tempo yang jelas.",
    status: "segera",
  },
];

export default async function InventarisLandingPage() {
  const user = await requireModule("inventaris");
  const visible = await Promise.all(
    FEATURES.map(async (f) => ({ ...f, allowed: await hasModule(user, f.moduleKey, "view") })),
  );

  return (
    <FadeIn className="space-y-6">
      <PageHeader
        title="Inventarisasi Barang"
        description="Manajemen seluruh data aset & barang RSUD Boltim — master barang, kartu inventaris ruangan, pemeliharaan, dan analitik tren."
      />

      {/* Catatan dashboard analitik (menyusul) */}
      <div className="flex items-start gap-3 rounded-[var(--radius-lg)] border border-brand/25 bg-brand-soft/40 px-4 py-3">
        <TrendingUp className="mt-0.5 size-5 shrink-0 text-brand" />
        <div className="text-sm">
          <p className="font-medium text-fg">Dashboard Analitik Tren</p>
          <p className="text-fg-muted">
            Ringkasan nilai aset, komposisi kondisi, dan tren perolehan akan tampil di sini setelah data barang tersedia.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {visible
          .filter((f) => f.allowed)
          .map((f) => (
            <FeatureCard key={f.moduleKey} feature={f} />
          ))}
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
        {available ? (
          <Badge tone="success" dot>
            Tersedia
          </Badge>
        ) : (
          <Badge tone="neutral">Segera</Badge>
        )}
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

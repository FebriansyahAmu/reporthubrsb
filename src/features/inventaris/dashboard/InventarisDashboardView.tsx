"use client";

import type { LucideIcon } from "lucide-react";
import {
  Activity, AlertTriangle, Boxes, DoorOpen, Landmark, Layers, Tags, TrendingUp, Wallet,
} from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { AnimatedNumber } from "@/components/ui/AnimatedNumber";
import { ErrorState } from "@/components/feedback/States";
import { DonutChart } from "@/components/charts/DonutChart";
import { HBarList } from "@/components/charts/HBarList";
import { VBarChart } from "@/components/charts/VBarChart";
import { useAsyncData } from "@/lib/useAsyncData";
import { formatRupiah, formatRupiahRingkas } from "@/lib/format";
import { cn } from "@/lib/cn";
import { fetchInvDashboard, TONE_COLOR, type InvDashboardData } from "./dashboard.client";

type Tone = "brand" | "success" | "accent" | "danger" | "warning" | "neutral";
const TONE_BG: Record<Tone, string> = {
  brand: "bg-brand-soft text-brand",
  success: "bg-success-soft text-success",
  accent: "bg-accent-soft text-accent",
  danger: "bg-danger-soft text-danger",
  warning: "bg-warning-soft text-warning",
  neutral: "bg-surface-2 text-fg-muted",
};

export function InventarisDashboardView() {
  const { result, loading, error, reload } = useAsyncData<InvDashboardData>(() => fetchInvDashboard(), []);
  const d = result;

  if (loading && !d) return <DashboardSkeleton />;
  if (error) return <Card className="p-0"><ErrorState onRetry={reload} /></Card>;
  if (!d) return null;

  const kosong = d.totals.totalUnit === 0;

  return (
    <div className="space-y-4">
      {/* Ringkasan angka */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <NumTile label="Total Unit Aset" value={d.totals.totalUnit} icon={Boxes} tone="brand" />
        <TextTile label="Total Nilai Aset" value={formatRupiahRingkas(d.totals.totalNilai)} title={formatRupiah(d.totals.totalNilai)} icon={Wallet} tone="success" />
        <NumTile label="Jenis Barang" value={d.totals.jenisBarang} icon={Layers} tone="accent" />
        <NumTile label="Perlu Perhatian" value={d.totals.perluPerhatian} icon={AlertTriangle} tone={d.totals.perluPerhatian > 0 ? "warning" : "neutral"} />
      </div>

      {kosong && (
        <div className="flex items-start gap-2.5 rounded-[var(--radius-md)] border border-brand/25 bg-brand-soft/40 px-4 py-3 text-sm text-fg">
          <TrendingUp className="mt-0.5 size-4 shrink-0 text-brand" />
          <span>Belum ada data aset. Tambahkan barang di <span className="font-medium">Master Barang</span> agar analitik & tren muncul di sini.</span>
        </div>
      )}

      {/* Komposisi kondisi + status aset */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Section icon={Activity} title="Komposisi Kondisi" subtitle="Sebaran kondisi fisik seluruh unit aktif">
          <DonutChart
            centerLabel="Unit"
            segments={d.kondisi.map((k) => ({ label: k.label, value: k.value, color: TONE_COLOR[k.tone] ?? TONE_COLOR.neutral }))}
          />
        </Section>
        <Section icon={Boxes} title="Status Aset" subtitle="Kondisi operasional unit">
          <HBarList items={d.statusAset.map((s) => ({ label: s.label, value: s.value, color: TONE_COLOR[s.tone] ?? TONE_COLOR.neutral }))} />
        </Section>
      </div>

      {/* Tren perolehan per tahun */}
      <Section icon={TrendingUp} title="Tren Perolehan per Tahun" subtitle="Jumlah unit diperoleh tiap tahun (arahkan kursor untuk nilai)">
        <VBarChart
          ariaLabel="Tren perolehan aset per tahun"
          data={d.trenTahun.map((y) => ({ label: String(y.tahun), value: y.jumlah, hint: formatRupiah(y.nilai) }))}
        />
      </Section>

      {/* Sebaran */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Section icon={DoorOpen} title="Sebaran per Ruangan" subtitle={`Top ${d.perRuangan.length}`}>
          <HBarList items={d.perRuangan.map((r) => ({ label: r.label, value: r.jumlah, color: "var(--brand)", sub: r.nilai > 0 ? formatRupiahRingkas(r.nilai) : undefined }))} />
        </Section>
        <Section icon={Tags} title="Sebaran per Kategori" subtitle={`Top ${d.perKategori.length}`}>
          <HBarList items={d.perKategori.map((k) => ({ label: k.label, value: k.jumlah, color: "var(--brand)", sub: k.nilai > 0 ? formatRupiahRingkas(k.nilai) : undefined }))} />
        </Section>
        <Section icon={Landmark} title="Sebaran per Sumber" subtitle="Sumber anggaran">
          <HBarList items={d.perSumber.map((s) => ({ label: s.label, value: s.jumlah, color: "var(--brand)", sub: s.nilai > 0 ? formatRupiahRingkas(s.nilai) : undefined }))} />
        </Section>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- potongan */

function NumTile({ label, value, icon: Icon, tone }: { label: string; value: number; icon: LucideIcon; tone: Tone }) {
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-fg-muted">{label}</p>
        <div className={cn("flex size-8 items-center justify-center rounded-[var(--radius-md)]", TONE_BG[tone])}><Icon className="size-4" /></div>
      </div>
      <p className="mt-3 text-2xl font-semibold tracking-tight text-fg tabular"><AnimatedNumber value={value} /></p>
    </Card>
  );
}

function TextTile({ label, value, title, icon: Icon, tone }: { label: string; value: string; title?: string; icon: LucideIcon; tone: Tone }) {
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-fg-muted">{label}</p>
        <div className={cn("flex size-8 items-center justify-center rounded-[var(--radius-md)]", TONE_BG[tone])}><Icon className="size-4" /></div>
      </div>
      <p title={title} className="mt-3 truncate text-2xl font-semibold tracking-tight text-fg tabular">{value}</p>
    </Card>
  );
}

function Section({
  icon: Icon, title, subtitle, children,
}: {
  icon: LucideIcon; title: string; subtitle?: string; children: React.ReactNode;
}) {
  return (
    <Card className="p-4">
      <div className="mb-4 flex items-center gap-2.5">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-surface-2 text-fg-muted">
          <Icon className="size-4" />
        </span>
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-fg">{title}</h3>
          {subtitle && <p className="truncate text-xs text-fg-muted">{subtitle}</p>}
        </div>
      </div>
      {children}
    </Card>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-[92px] rounded-[var(--radius-lg)]" />)}
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Skeleton className="h-64 rounded-[var(--radius-lg)]" />
        <Skeleton className="h-64 rounded-[var(--radius-lg)]" />
      </div>
      <Skeleton className="h-72 rounded-[var(--radius-lg)]" />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-56 rounded-[var(--radius-lg)]" />)}
      </div>
    </div>
  );
}

"use client";

import type { LucideIcon } from "lucide-react";
import {
  Activity, AlertTriangle, Clock, Layers, ReceiptText, Scissors, TrendingUp, Wallet,
} from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/feedback/States";
import { DonutChart } from "@/components/charts/DonutChart";
import { HBarList } from "@/components/charts/HBarList";
import { VBarChart } from "@/components/charts/VBarChart";
import { useAsyncData } from "@/lib/useAsyncData";
import { formatRupiah, formatRupiahRingkas } from "@/lib/format";
import { cn } from "@/lib/cn";
import { BULAN_LABEL } from "@/server/modules/rekap-klaim/klaim.schema";
import { fetchKlaimDashboard, TONE_COLOR, type KlaimDashboardData } from "./dashboard.client";

const JUTA = 1_000_000;
type Tone = "brand" | "success" | "accent" | "danger" | "warning" | "neutral";
const TONE_BG: Record<Tone, string> = {
  brand: "bg-brand-soft text-brand",
  success: "bg-success-soft text-success",
  accent: "bg-accent-soft text-accent",
  danger: "bg-danger-soft text-danger",
  warning: "bg-warning-soft text-warning",
  neutral: "bg-surface-2 text-fg-muted",
};

export function DashboardKlaimView() {
  const { result: d, loading, error, reload } = useAsyncData<KlaimDashboardData>(() => fetchKlaimDashboard(), []);

  if (loading && !d) return <DashboardSkeleton />;
  if (error) return <Card className="p-0"><ErrorState onRetry={reload} /></Card>;
  if (!d) return null;

  const ytdKosong = d.totals.entriYtd === 0;

  return (
    <div className="space-y-4">
      {/* Ringkasan */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile
          icon={Wallet} tone="brand" label={`Total Klaim ${d.tahunBerjalan}`}
          value={formatRupiahRingkas(d.totals.totalYtd)} title={formatRupiah(d.totals.totalYtd)}
          sub={`diterima ${formatRupiahRingkas(d.totals.diterimaYtd)} · ${d.totals.entriYtd} entri`}
        />
        <Tile
          icon={Clock} tone="warning" label="Pending Belum Cair"
          value={formatRupiahRingkas(d.belumCair.nilai)} title={formatRupiah(d.belumCair.nilai)}
          sub={`${d.belumCair.count} entri · semua periode`}
        />
        <Tile
          icon={Scissors} tone="accent" label="Potongan Berjalan"
          value={formatRupiahRingkas(d.potonganBerjalan.nilai)} title={formatRupiah(d.potonganBerjalan.nilai)}
          sub={`${d.potonganBerjalan.count} cicilan aktif`}
        />
        <Tile
          icon={AlertTriangle} tone={d.perluPerhatian > 0 ? "danger" : "neutral"} label="Perlu Perhatian"
          value={String(d.perluPerhatian)} sub="expired / selisih" highlight={d.perluPerhatian > 0}
        />
      </div>

      {!d.adaData && (
        <div className="flex items-start gap-2.5 rounded-[var(--radius-md)] border border-brand/25 bg-brand-soft/40 px-4 py-3 text-sm text-fg">
          <TrendingUp className="mt-0.5 size-4 shrink-0 text-brand" />
          <span>Belum ada data klaim. Tambahkan entri di <span className="font-medium">Data Klaim</span> agar analitik & tren muncul di sini.</span>
        </div>
      )}

      {/* Komposisi jenis + sebaran status */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Section icon={Layers} title="Komposisi Klaim per Jenis" subtitle="Jumlah entri · seluruh periode">
          {d.komposisiJenis.length === 0 ? <Kosong /> : (
            <DonutChart
              centerLabel="Klaim"
              segments={d.komposisiJenis.map((s) => ({ label: s.label, value: s.value, color: TONE_COLOR[s.tone] ?? TONE_COLOR.neutral }))}
            />
          )}
        </Section>
        <Section icon={ReceiptText} title="Sebaran Status Klaim" subtitle="Jumlah entri per status">
          {d.statusKlaim.length === 0 ? <Kosong /> : (
            <HBarList items={d.statusKlaim.map((s) => ({ label: s.label, value: s.value, color: TONE_COLOR[s.tone] ?? TONE_COLOR.neutral }))} />
          )}
        </Section>
      </div>

      {/* Tren dana bulanan tahun berjalan */}
      <Section icon={Activity} title={`Tren Dana Klaim Bulanan ${d.tahunBerjalan}`} subtitle="Nilai dalam juta rupiah · arahkan kursor untuk nilai penuh">
        {ytdKosong ? (
          <p className="py-10 text-center text-sm text-fg-muted">Belum ada klaim pada tahun {d.tahunBerjalan}.</p>
        ) : (
          <VBarChart
            ariaLabel={`Tren dana klaim per bulan ${d.tahunBerjalan}`}
            data={d.trenBulanan.map((b) => ({
              label: BULAN_LABEL[b.bulan - 1].slice(0, 3),
              value: b.dana / JUTA,
              hint: `${formatRupiah(b.dana)} · ${b.entri} entri`,
            }))}
          />
        )}
      </Section>

      {/* Tren dana per tahun */}
      <Section icon={TrendingUp} title="Tren Dana Klaim per Tahun" subtitle="Nilai dalam juta rupiah · seluruh periode pelayanan">
        {d.trenTahun.length === 0 ? <Kosong /> : (
          <VBarChart
            ariaLabel="Tren dana klaim per tahun"
            data={d.trenTahun.map((y) => ({
              label: String(y.tahun),
              value: y.dana / JUTA,
              hint: `${formatRupiah(y.dana)} · ${y.entri} entri`,
            }))}
          />
        )}
      </Section>
    </div>
  );
}

/* ---------------------------------------------------------------- potongan */

function Tile({
  icon: Icon, label, value, title, sub, tone, highlight,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  title?: string;
  sub?: string;
  tone: Tone;
  highlight?: boolean;
}) {
  return (
    <Card className={cn("p-4", highlight && "ring-1 ring-danger/30")}>
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-fg-muted">{label}</p>
        <div className={cn("flex size-8 items-center justify-center rounded-[var(--radius-md)]", TONE_BG[tone])}><Icon className="size-4" /></div>
      </div>
      <p title={title} className="mt-3 truncate text-xl font-semibold tracking-tight text-fg tabular-nums">{value}</p>
      {sub && <p className="mt-0.5 truncate text-[11px] text-fg-subtle">{sub}</p>}
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

function Kosong() {
  return <p className="py-8 text-center text-sm text-fg-muted">Tidak ada data.</p>;
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
      <Skeleton className="h-72 rounded-[var(--radius-lg)]" />
    </div>
  );
}

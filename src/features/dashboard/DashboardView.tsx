"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
  Activity,
  BedDouble,
  Clock,
  CreditCard,
  Building2,
  RefreshCw,
  TrendingDown,
  TrendingUp,
  UserPlus,
  Users,
} from "lucide-react";
import { Card, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { AnimatedNumber } from "@/components/ui/AnimatedNumber";
import { ErrorState } from "@/components/feedback/States";
import { cn } from "@/lib/cn";
import { useAsyncData } from "@/lib/useAsyncData";
import { formatNumber } from "@/lib/format";
import { TrendAreaChart } from "@/components/charts/TrendAreaChart";
import { DonutChart, type DonutSegment } from "@/components/charts/DonutChart";
import { HBarList } from "@/components/charts/HBarList";
import { HourBarChart } from "@/components/charts/HourBarChart";
import { Sparkline } from "@/components/charts/Sparkline";
import type { DashboardData, JenisKey, PeriodKey } from "@/server/modules/dashboard/dashboard.types";

const JENIS_COLOR: Record<JenisKey, string> = {
  rj: "var(--chart-rj)",
  igd: "var(--chart-igd)",
  ri: "var(--chart-ri)",
};
// Palet cara bayar — dipimpin brand (dominan BPJS) agar beda dari donut jenis
// yang dipimpin teal. Kategori ke-5+ dilipat ke "Lainnya".
const CARABAYAR_CYCLE = [
  "var(--brand)",
  "var(--chart-ri)",
  "var(--chart-rj)",
  "var(--fg-muted)",
  "var(--fg-subtle)",
];

const PERIODS: { key: PeriodKey; label: string }[] = [
  { key: "7d", label: "7 Hari" },
  { key: "30d", label: "30 Hari" },
  { key: "90d", label: "90 Hari" },
  { key: "month", label: "Bulan Ini" },
];

async function fetchDashboard(period: PeriodKey): Promise<DashboardData> {
  const res = await fetch(`/api/dashboard?period=${period}`);
  if (!res.ok) throw new Error("Gagal memuat data");
  return ((await res.json()) as { data: DashboardData }).data;
}

export function DashboardView() {
  const [period, setPeriod] = useState<PeriodKey>("30d");
  const { result, loading, error, reload } = useAsyncData<DashboardData>(
    () => fetchDashboard(period),
    [period],
  );

  const d = result;

  return (
    <div className="space-y-5">
      {/* Status bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm text-fg-muted">
          <Clock className="size-4" />
          {d ? (
            <span className="tabular">Data per {d.generatedAt} WITA</span>
          ) : (
            <span>Memuat…</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <PeriodSegmented value={period} onChange={setPeriod} />
          <Button
            variant="secondary"
            size="sm"
            icon={<RefreshCw className={cn("size-4", loading && "animate-spin")} />}
            onClick={() => reload()}
          >
            Refresh
          </Button>
        </div>
      </div>

      {error && !d ? (
        <Card className="p-0">
          <ErrorState onRetry={reload} />
        </Card>
      ) : (
        <>
          {/* KPI */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <TodayTile data={d} loading={loading} />
            <TotalTile data={d} loading={loading} />
            <BaruTile data={d} loading={loading} />
            <CensusTile data={d} loading={loading} />
          </div>

          {/* Tren (hero) */}
          <Card>
            <CardHeader
              title="Tren Kunjungan"
              subtitle={d ? `${label(d)} · per hari` : "Memuat…"}
            />
            <div className="p-5">
              {loading || !d ? (
                <Skeleton className="h-[340px] w-full rounded-[var(--radius-md)]" />
              ) : (
                <TrendAreaChart data={d.trend} />
              )}
            </div>
          </Card>

          {/* Komposisi & cara bayar */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader title="Komposisi Jenis Layanan" subtitle={d ? label(d) : ""} />
              <div className="p-5">
                {loading || !d ? (
                  <ChartSkeleton />
                ) : (
                  <DonutChart
                    centerLabel="Kunjungan"
                    segments={d.byJenis.map((j) => ({
                      label: j.label,
                      value: j.value,
                      color: JENIS_COLOR[j.key],
                    }))}
                  />
                )}
              </div>
            </Card>

            <Card>
              <CardHeader
                title="Cara Bayar"
                subtitle={d ? label(d) : ""}
                action={<CreditCard className="size-4 text-fg-subtle" />}
              />
              <div className="p-5">
                {loading || !d ? (
                  <ChartSkeleton />
                ) : (
                  <DonutChart
                    centerLabel="Kunjungan"
                    segments={caraBayarSegments(d.byCaraBayar)}
                  />
                )}
              </div>
            </Card>
          </div>

          {/* Top ruangan & jam */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader
                title="Ruangan Terbanyak"
                subtitle={d ? `${label(d)} · top ${Math.min(8, d.topRooms.length)}` : ""}
                action={<Building2 className="size-4 text-fg-subtle" />}
              />
              <div className="p-5">
                {loading || !d ? (
                  <ListSkeleton />
                ) : (
                  <HBarList
                    items={d.topRooms.map((r) => ({
                      label: r.unit,
                      value: r.value,
                      color: JENIS_COLOR[r.jenis],
                      sub: r.jenis.toUpperCase(),
                    }))}
                  />
                )}
              </div>
            </Card>

            <Card>
              <CardHeader
                title="Distribusi per Jam"
                subtitle={d ? `${label(d)} · jam masuk` : ""}
                action={<Clock className="size-4 text-fg-subtle" />}
              />
              <div className="p-5">
                {loading || !d ? (
                  <Skeleton className="h-[170px] w-full rounded-[var(--radius-md)]" />
                ) : (
                  <HourBarChart data={d.byHour} />
                )}
              </div>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}

const label = (d: DashboardData) => d.period.label;

function caraBayarSegments(items: { label: string; value: number }[]): DonutSegment[] {
  const MAX = CARABAYAR_CYCLE.length; // 5
  if (items.length <= MAX) {
    return items.map((it, i) => ({ label: it.label, value: it.value, color: CARABAYAR_CYCLE[i] }));
  }
  const head = items.slice(0, MAX - 1).map((it, i) => ({
    label: it.label,
    value: it.value,
    color: CARABAYAR_CYCLE[i],
  }));
  const rest = items.slice(MAX - 1).reduce((a, x) => a + x.value, 0);
  return [...head, { label: "Lainnya", value: rest, color: CARABAYAR_CYCLE[MAX - 1] }];
}

/* ------------------------------------------------------------------ KPI tiles */

function TileShell({
  icon: Icon,
  label: lbl,
  accent,
  children,
}: {
  icon: typeof Users;
  label: string;
  accent?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Card className="flex flex-col p-4">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-fg-muted">{lbl}</p>
        <span
          className={cn(
            "flex size-7 items-center justify-center rounded-[var(--radius-md)]",
            accent ? "bg-brand-soft text-brand" : "bg-surface-2 text-fg-muted",
          )}
        >
          <Icon className="size-3.5" />
        </span>
      </div>
      {children}
    </Card>
  );
}

function BigValue({ value, loading }: { value: number; loading: boolean }) {
  return (
    <p className="mt-2 text-2xl font-semibold tabular text-fg">
      {loading ? <span className="text-fg-subtle">—</span> : <AnimatedNumber value={value} />}
    </p>
  );
}

function TodayTile({ data, loading }: { data: DashboardData | null; loading: boolean }) {
  const t = data?.todayCard;
  const delta = t ? t.total - t.yesterday : 0;
  return (
    <TileShell icon={Activity} label="Kunjungan Hari Ini" accent>
      <div className="flex items-end justify-between gap-2">
        <BigValue value={t?.total ?? 0} loading={loading} />
        {t && !loading && t.total + t.yesterday > 0 && (
          <span
            className={cn(
              "mb-1 inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[11px] font-semibold tabular",
              delta >= 0 ? "bg-success-soft text-success" : "bg-danger-soft text-danger",
            )}
            title="dibanding kemarin"
          >
            {delta >= 0 ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />}
            {delta >= 0 ? "+" : ""}
            {delta}
          </span>
        )}
      </div>
      {t && !loading ? (
        <>
          <p className="mt-0.5 text-[11px] text-fg-subtle">
            RJ {t.rj} · IGD {t.igd} · RI {t.ri}
          </p>
          <div className="mt-auto pt-3">
            <Sparkline data={t.spark.map((s) => s.value)} height={34} />
          </div>
        </>
      ) : (
        <div className="mt-3 space-y-2">
          <Skeleton className="h-3 w-28 rounded" />
          <Skeleton className="h-8 w-full rounded" />
        </div>
      )}
    </TileShell>
  );
}

function TotalTile({ data, loading }: { data: DashboardData | null; loading: boolean }) {
  const s = data?.summary;
  return (
    <TileShell icon={Users} label={`Total Kunjungan · ${data ? data.period.label : ""}`}>
      <BigValue value={s?.total ?? 0} loading={loading} />
      {s && !loading ? (
        <div className="mt-auto pt-3">
          <TriBar rj={s.rj} igd={s.igd} ri={s.ri} />
          <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-fg-muted tabular">
            <Dot color="var(--chart-rj)" label={`RJ ${formatNumber(s.rj)}`} />
            <Dot color="var(--chart-igd)" label={`IGD ${formatNumber(s.igd)}`} />
            <Dot color="var(--chart-ri)" label={`RI ${formatNumber(s.ri)}`} />
          </div>
        </div>
      ) : (
        <div className="mt-3 space-y-2">
          <Skeleton className="h-2.5 w-full rounded-full" />
          <Skeleton className="h-3 w-32 rounded" />
        </div>
      )}
    </TileShell>
  );
}

function BaruTile({ data, loading }: { data: DashboardData | null; loading: boolean }) {
  const s = data?.summary;
  const pct = s && s.total > 0 ? Math.round((s.baru / s.total) * 100) : 0;
  return (
    <TileShell icon={UserPlus} label="Pasien Baru">
      <BigValue value={s?.baru ?? 0} loading={loading} />
      {s && !loading ? (
        <div className="mt-auto pt-3">
          <div className="flex h-2.5 w-full overflow-hidden rounded-full" style={{ background: "var(--chart-track)" }}>
            <span className="h-full" style={{ width: `${pct}%`, background: "var(--brand)" }} />
          </div>
          <p className="mt-2 text-[11px] text-fg-muted tabular">
            {pct}% dari total · {formatNumber(s.lama)} lama
          </p>
        </div>
      ) : (
        <div className="mt-3 space-y-2">
          <Skeleton className="h-2.5 w-full rounded-full" />
          <Skeleton className="h-3 w-24 rounded" />
        </div>
      )}
    </TileShell>
  );
}

function CensusTile({ data, loading }: { data: DashboardData | null; loading: boolean }) {
  return (
    <TileShell icon={BedDouble} label="Sedang Dirawat">
      <BigValue value={data?.census ?? 0} loading={loading} />
      {data && !loading ? (
        <p className="mt-auto flex items-center gap-1.5 pt-3 text-[11px] text-fg-subtle">
          <span className="relative flex size-1.5">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-success opacity-60" />
            <span className="relative inline-flex size-1.5 rounded-full bg-success" />
          </span>
          Bed rawat inap terisi saat ini
        </p>
      ) : (
        <div className="mt-3">
          <Skeleton className="h-3 w-36 rounded" />
        </div>
      )}
    </TileShell>
  );
}

function TriBar({ rj, igd, ri }: { rj: number; igd: number; ri: number }) {
  const total = rj + igd + ri || 1;
  const seg = (v: number, color: string) =>
    v > 0 ? <span className="h-full" style={{ width: `${(v / total) * 100}%`, background: color }} /> : null;
  return (
    <div className="flex h-2.5 w-full gap-px overflow-hidden rounded-full" style={{ background: "var(--chart-track)" }}>
      {seg(rj, "var(--chart-rj)")}
      {seg(igd, "var(--chart-igd)")}
      {seg(ri, "var(--chart-ri)")}
    </div>
  );
}

function Dot({ color, label: lbl }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      <span className="size-1.5 rounded-full" style={{ background: color }} />
      {lbl}
    </span>
  );
}

/* ----------------------------------------------------------------- controls */

function PeriodSegmented({ value, onChange }: { value: PeriodKey; onChange: (v: PeriodKey) => void }) {
  return (
    <div className="inline-flex items-center gap-0.5 rounded-[var(--radius-md)] border border-border bg-surface-2/60 p-0.5">
      {PERIODS.map((o) => {
        const active = o.key === value;
        return (
          <button
            key={o.key}
            type="button"
            onClick={() => onChange(o.key)}
            className={cn(
              "relative rounded-[calc(var(--radius-md)-2px)] px-2.5 py-1.5 text-[13px] font-medium transition-colors sm:px-3",
              active ? "text-fg" : "text-fg-muted hover:text-fg",
            )}
          >
            {active && (
              <motion.span
                layoutId="dash-period-seg"
                className="absolute inset-0 rounded-[calc(var(--radius-md)-2px)] bg-surface shadow-xs ring-1 ring-border"
                transition={{ type: "spring", stiffness: 400, damping: 32 }}
              />
            )}
            <span className="relative">{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}

/* ---------------------------------------------------------------- skeletons */

function ChartSkeleton() {
  return (
    <div className="flex flex-col items-center gap-5 sm:flex-row sm:gap-6">
      <Skeleton className="size-[184px] shrink-0 rounded-full" />
      <div className="w-full space-y-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-6 w-full rounded" />
        ))}
      </div>
    </div>
  );
}

function ListSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="space-y-1.5">
          <Skeleton className="h-3 w-40 rounded" />
          <Skeleton className="h-2 w-full rounded-full" />
        </div>
      ))}
    </div>
  );
}

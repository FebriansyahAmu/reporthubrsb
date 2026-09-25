"use client";

import { useMemo, useState } from "react";
import type { LucideIcon } from "lucide-react";
import { Activity, Clock, LogIn, Pencil, Plus, Table2, TrendingUp, UsersRound } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { AnimatedNumber } from "@/components/ui/AnimatedNumber";
import { ErrorState } from "@/components/feedback/States";
import { DonutChart } from "@/components/charts/DonutChart";
import { HBarList } from "@/components/charts/HBarList";
import { useAsyncData } from "@/lib/useAsyncData";
import { formatNumber, formatDate, addDays, toLocalDateInput } from "@/lib/format";
import { cn } from "@/lib/cn";
import { fetchAuditDashboard, type AuditDashboard } from "./audit.client";
import { AuditTrendChart } from "./AuditTrendChart";

type Tone = "brand" | "success" | "accent" | "warning" | "neutral";
const TONE_BG: Record<Tone, string> = {
  brand: "bg-brand-soft text-brand",
  success: "bg-success-soft text-success",
  accent: "bg-accent-soft text-accent",
  warning: "bg-warning-soft text-warning",
  neutral: "bg-surface-2 text-fg-muted",
};

const PRESETS = [
  { days: 7, label: "7 hari" },
  { days: 30, label: "30 hari" },
  { days: 90, label: "90 hari" },
];

export function AuditDashboardView() {
  const [days, setDays] = useState(30);
  const range = useMemo(() => {
    const to = toLocalDateInput(new Date());
    const from = toLocalDateInput(addDays(new Date(), -(days - 1)));
    return { from, to };
  }, [days]);

  const { result, loading, error, reload } = useAsyncData<AuditDashboard>(
    () => fetchAuditDashboard(range),
    [range.from, range.to],
  );
  const d = result;

  return (
    <div className="space-y-4">
      {/* Header rentang */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-fg-muted">
          {d ? (
            <>Periode <b className="text-fg">{formatDate(d.range.from)} – {formatDate(d.range.to)}</b> · {d.totals.penggunaAktif} pengguna aktif</>
          ) : (
            "Memuat…"
          )}
        </p>
        <div className="inline-flex rounded-[var(--radius-md)] border border-border bg-surface-2 p-1">
          {PRESETS.map((p) => (
            <button
              key={p.days}
              type="button"
              onClick={() => setDays(p.days)}
              aria-pressed={days === p.days}
              className={cn(
                "rounded-[var(--radius-sm)] px-3 py-1.5 text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring",
                days === p.days ? "bg-surface text-fg shadow-xs" : "text-fg-muted hover:text-fg",
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {loading && !d ? (
        <DashboardSkeleton />
      ) : error || !d ? (
        <Card className="overflow-hidden"><ErrorState onRetry={reload} /></Card>
      ) : (
        <>
          {/* Stat tiles */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <NumTile label="Aktivitas RME" value={d.totals.rme} icon={Activity} tone="brand" />
            <NumTile label="Penambahan" value={d.totals.penambahan} icon={Plus} tone="success" />
            <NumTile label="Perubahan" value={d.totals.perubahan} icon={Pencil} tone="warning" />
            <NumTile label="Login" value={d.totals.login} icon={LogIn} tone="accent" />
          </div>

          {/* Tren RME harian */}
          <Section icon={TrendingUp} title="Tren Aktivitas RME Harian" subtitle="Penambahan & perubahan per hari (arahkan kursor untuk rincian)">
            <AuditTrendChart
              ariaLabel="Tren aktivitas RME harian"
              data={d.trenRme.map((r) => ({ date: r.date, values: [r.penambahan, r.perubahan] }))}
              series={[
                { key: "c", label: "Penambahan", color: "var(--success)" },
                { key: "u", label: "Perubahan", color: "var(--warning)" },
              ]}
            />
          </Section>

          {/* Komposisi + per objek */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Section icon={Activity} title="Komposisi Aktivitas" subtitle="Penambahan vs perubahan">
              {d.totals.rme > 0 ? (
                <DonutChart
                  centerLabel="Aktivitas"
                  segments={[
                    { label: "Penambahan", value: d.totals.penambahan, color: "var(--success)" },
                    { label: "Perubahan", value: d.totals.perubahan, color: "var(--warning)" },
                  ]}
                />
              ) : (
                <p className="py-10 text-center text-sm text-fg-muted">Tidak ada aktivitas pada rentang ini.</p>
              )}
            </Section>
            <Section icon={Table2} title="Aktivitas per Objek RME" subtitle="Sebaran per tabel rekam medis">
              <HBarList items={d.perObjek.map((o) => ({ label: o.label, value: o.total, color: "var(--brand)" }))} />
            </Section>
          </div>

          {/* Pengguna teraktif + per jam */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Section icon={UsersRound} title="Pengguna Teraktif" subtitle={`Top ${d.topPengguna.length} berdasarkan aktivitas RME`}>
              <HBarList
                items={d.topPengguna.map((u) => ({
                  label: u.nama || u.login || `#${u.id}`,
                  value: u.total,
                  color: "var(--brand)",
                  sub: u.login ?? undefined,
                }))}
              />
            </Section>
            <Section icon={Clock} title="Distribusi per Jam" subtitle="Waktu aktivitas RME (WITA) — deteksi akses di luar jam">
              <HourBars data={d.perJam} />
            </Section>
          </div>

          {/* Tren login */}
          <Section icon={LogIn} title="Tren Login Harian" subtitle="Jumlah login pengguna per hari">
            <AuditTrendChart
              ariaLabel="Tren login harian"
              data={d.trenLogin.map((r) => ({ date: r.date, values: [r.total] }))}
              series={[{ key: "login", label: "Login", color: "var(--accent)" }]}
            />
          </Section>
        </>
      )}
    </div>
  );
}

function HourBars({ data }: { data: { hour: number; value: number }[] }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  const peak = data.reduce((a, b) => (b.value > a.value ? b : a), data[0] ?? { hour: 0, value: 0 });
  return (
    <div>
      <div className="flex h-[150px] items-end gap-[3px]">
        {data.map((d) => {
          const pct = (d.value / max) * 100;
          const isPeak = d.value > 0 && d.hour === peak.hour;
          return (
            <div key={d.hour} className="group relative flex h-full flex-1 items-end">
              <div
                title={`${String(d.hour).padStart(2, "0")}:00 — ${formatNumber(d.value)} aktivitas`}
                className={cn("w-full rounded-t-[3px] transition-[height,background] duration-300", isPeak ? "bg-brand" : "bg-brand/45 group-hover:bg-brand/70")}
                style={{ height: `${Math.max(pct, d.value > 0 ? 3 : 0)}%` }}
              />
              <div className="pointer-events-none absolute -top-10 left-1/2 z-10 hidden -translate-x-1/2 whitespace-nowrap rounded-md border border-border bg-surface px-2 py-1 text-[11px] shadow-md group-hover:block">
                <span className="tabular font-semibold text-fg">{formatNumber(d.value)}</span>
                <span className="text-fg-muted"> · {String(d.hour).padStart(2, "0")}:00</span>
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-1.5 flex gap-[3px] text-[10px] text-fg-subtle">
        {data.map((d) => (
          <span key={d.hour} className="tabular flex-1 text-center">{d.hour % 3 === 0 ? String(d.hour).padStart(2, "0") : ""}</span>
        ))}
      </div>
    </div>
  );
}

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

function Section({ icon: Icon, title, subtitle, children }: { icon: LucideIcon; title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <Card className="p-4">
      <div className="mb-4 flex items-center gap-2.5">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-surface-2 text-fg-muted"><Icon className="size-4" /></span>
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
      <Skeleton className="h-72 rounded-[var(--radius-lg)]" />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Skeleton className="h-64 rounded-[var(--radius-lg)]" />
        <Skeleton className="h-64 rounded-[var(--radius-lg)]" />
      </div>
    </div>
  );
}

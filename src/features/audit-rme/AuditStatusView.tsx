"use client";

import { Activity, CalendarRange, Database, LogIn, ShieldAlert, Table2, UsersRound } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/feedback/States";
import { Stagger, StaggerItem } from "@/components/motion/Motion";
import { useAsyncData } from "@/lib/useAsyncData";
import { formatNumber, formatDate, formatDateTime } from "@/lib/format";
import { fetchAuditStatus, type AuditStatus } from "./audit.client";

export function AuditStatusView() {
  const { result, loading, error, reload } = useAsyncData<AuditStatus>(() => fetchAuditStatus(), []);

  if (loading) return <StatusSkeleton />;
  if (error || !result) return <Card className="overflow-hidden"><ErrorState onRetry={reload} /></Card>;
  if (!result.configured) {
    return (
      <Card className="flex items-start gap-3 p-5">
        <ShieldAlert className="mt-0.5 size-5 shrink-0 text-warning" />
        <div>
          <h2 className="text-sm font-semibold text-fg">Sumber SIMGOS belum dikonfigurasi</h2>
          <p className="mt-1 text-sm text-fg-muted">
            Modul ini membaca log SIMGOS (read-only). Set <code className="rounded bg-surface-2 px-1">DATABASE_URL_SIMGOS</code> pada <code className="rounded bg-surface-2 px-1">.env</code> untuk mengaktifkan.
          </p>
        </div>
      </Card>
    );
  }

  const cov = result.coverage;
  const covLabel = cov.minDate && cov.maxDate ? `${formatDate(cov.minDate)} – ${formatDate(cov.maxDate)}` : "—";

  return (
    <div className="space-y-5">
      {/* Ringkasan cakupan */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile icon={<Activity className="size-4" />} label="Aktivitas RME tercatat" value={formatNumber(result.totalEvents)} hint="Penambahan & perubahan (C/U)" tone="brand" />
        <StatTile icon={<CalendarRange className="size-4" />} label="Cakupan data" value={covLabel} hint="Rentang tanggal aktivitas" tone="accent" />
        <StatTile icon={<LogIn className="size-4" />} label="Login tercatat" value={formatNumber(result.login.total)} hint={result.login.lastAt ? `Terakhir ${formatDateTime(result.login.lastAt)}` : "—"} tone="success" />
        <StatTile icon={<UsersRound className="size-4" />} label="Pengguna aktif" value={formatNumber(result.users.aktif)} hint="Akun SIMGOS status aktif" tone="neutral" />
      </div>

      {/* Objek dalam scope */}
      <Card className="overflow-hidden">
        <div className="flex items-center gap-2 border-b border-border px-5 py-3.5">
          <Database className="size-4 text-brand" />
          <h2 className="text-sm font-semibold text-fg">Objek RME dalam pemantauan</h2>
          <Badge tone="neutral">{result.scope.length} tabel</Badge>
        </div>
        <Stagger className="divide-y divide-border">
          {result.scope.map((s) => (
            <StaggerItem key={s.objek}>
              <div className="flex items-center gap-3 px-5 py-3.5">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-brand-soft text-brand">
                  <Table2 className="size-4.5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-fg">{s.label}</p>
                  <p className="truncate font-mono text-xs text-fg-subtle">{s.tabel}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold tabular-nums text-fg">{formatNumber(s.total)}</p>
                  <p className="text-xs text-fg-muted">aktivitas</p>
                </div>
              </div>
            </StaggerItem>
          ))}
        </Stagger>
      </Card>

      {/* Catatan fondasi & keterbatasan sumber */}
      <Card className="p-5">
        <h2 className="text-sm font-semibold text-fg">Fondasi siap</h2>
        <p className="mt-1 text-sm text-fg-muted">
          Jalur baca SIMGOS read-only (database <span className="font-mono text-xs">logs</span> &amp; <span className="font-mono text-xs">aplikasi</span>) dan resolver objek telah aktif. Tahap berikutnya: <b>Timeline aktivitas</b> interaktif, <b>penelusuran perubahan</b> (sebelum → sesudah), <b>dashboard tren &amp; kepatuhan</b>, lalu <b>ekspor</b>.
        </p>
        <div className="mt-3 flex items-start gap-2 rounded-[var(--radius-md)] border border-border bg-surface-2/50 px-3 py-2 text-xs text-fg-muted">
          <ShieldAlert className="mt-0.5 size-3.5 shrink-0 text-fg-subtle" />
          <span>
            Catatan sumber: SIMGOS mencatat <b>Penambahan</b> &amp; <b>Perubahan</b>; <b>Penghapusan/Pembatalan</b> berupa soft-delete (perubahan status), sedangkan <b>Akses baca per-record</b> dan <b>Logout</b> tidak dicatat sistem sumber.
          </span>
        </div>
      </Card>
    </div>
  );
}

type Tone = "brand" | "accent" | "success" | "neutral";
const TONE_BG: Record<Tone, string> = {
  brand: "bg-brand-soft text-brand",
  accent: "bg-accent-soft text-accent",
  success: "bg-success-soft text-success",
  neutral: "bg-surface-2 text-fg-muted",
};

function StatTile({ icon, label, value, hint, tone }: { icon: React.ReactNode; label: string; value: string; hint?: string; tone: Tone }) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-2">
        <span className={`flex size-8 shrink-0 items-center justify-center rounded-[var(--radius-md)] ${TONE_BG[tone]}`}>{icon}</span>
        <p className="text-xs font-medium text-fg-muted">{label}</p>
      </div>
      <p className="mt-2 truncate text-lg font-semibold text-fg" title={value}>{value}</p>
      {hint && <p className="mt-0.5 truncate text-xs text-fg-subtle">{hint}</p>}
    </Card>
  );
}

function StatusSkeleton() {
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-[var(--radius-lg)] border border-border bg-surface p-4">
            <Skeleton className="h-8 w-8 rounded" />
            <Skeleton className="mt-2 h-5 w-24 rounded" />
            <Skeleton className="mt-1 h-3 w-32 rounded" />
          </div>
        ))}
      </div>
      <Card className="p-5">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="mb-3 h-10 w-full rounded" />
        ))}
      </Card>
    </div>
  );
}

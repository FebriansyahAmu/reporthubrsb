"use client";

import { useState } from "react";
import {
  CheckCircle2, ChevronDown, Circle, CircleDashed, Clock, Download, FileDown, History, UserCheck,
} from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState, ErrorState } from "@/components/feedback/States";
import { useToast } from "@/components/ui/Toast";
import { useAsyncData } from "@/lib/useAsyncData";
import { downloadFromEndpoint } from "@/lib/download";
import { formatDateTime, formatTime } from "@/lib/format";
import { cn } from "@/lib/cn";
import { FREKUENSI_LABEL, type Frekuensi } from "@/server/modules/inventaris/checklist.schema";
import { FrekuensiTabs } from "./FrekuensiTabs";
import {
  exportChecklistUrl, fetchRiwayat, fetchRunDetail,
  type RiwayatOverview, type RiwayatRun, type RunDetail,
} from "./checklist.client";

type Tone = "neutral" | "brand" | "success" | "warning" | "danger" | "accent";

export function RiwayatPanel({
  ruanganId,
  frekuensi,
  setFrekuensi,
}: {
  ruanganId: string;
  frekuensi: Frekuensi;
  setFrekuensi: (f: Frekuensi) => void;
}) {
  const toast = useToast();
  const [exporting, setExporting] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);

  const { result, loading, error, reload } = useAsyncData<RiwayatOverview | null>(
    () => (ruanganId ? fetchRiwayat({ ruanganId, frekuensi, limit: 60 }) : Promise.resolve(null)),
    [ruanganId, frekuensi],
  );
  const runs = result?.runs ?? [];

  async function doExport() {
    if (!ruanganId) return;
    setExporting(true);
    try {
      await downloadFromEndpoint(exportChecklistUrl({ ruanganId, frekuensi, mode: "riwayat" }), `Riwayat-Checklist_${frekuensi}.xlsx`);
    } catch (e) {
      toast.error("Gagal mengekspor", e instanceof Error ? e.message : undefined);
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="space-y-4">
      <FrekuensiTabs value={frekuensi} onChange={setFrekuensi} />

      <Card className="p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <History className="size-4 shrink-0 text-brand" />
              <h2 className="text-sm font-semibold text-fg">Riwayat Pelaksanaan {FREKUENSI_LABEL[frekuensi]}</h2>
            </div>
            <p className="mt-0.5 text-xs text-fg-muted">
              {runs.length > 0
                ? `${runs.length} periode tercatat · ${runs.filter((r) => r.selesai).length} selesai`
                : "Belum ada pelaksanaan yang tercatat."}
            </p>
          </div>
          <Button variant="secondary" size="sm" icon={<Download className="size-4" />} onClick={doExport} loading={exporting} disabled={runs.length === 0}>
            Ekspor Riwayat
          </Button>
        </div>
      </Card>

      {loading ? (
        <ListSkeleton />
      ) : error ? (
        <Card className="overflow-hidden"><ErrorState onRetry={reload} /></Card>
      ) : runs.length === 0 ? (
        <Card className="overflow-hidden">
          <EmptyState title="Belum ada riwayat" description="Pelaksanaan checklist untuk ruangan & frekuensi ini belum pernah dicatat." />
        </Card>
      ) : (
        <div className="space-y-2.5">
          {runs.map((run) => (
            <RunRow
              key={run.id}
              run={run}
              total={result?.total ?? run.total}
              open={openId === run.id}
              onToggle={() => setOpenId((id) => (id === run.id ? null : run.id))}
              ruanganId={ruanganId}
              frekuensi={frekuensi}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function RunRow({
  run,
  total,
  open,
  onToggle,
  ruanganId,
  frekuensi,
}: {
  run: RiwayatRun;
  total: number;
  open: boolean;
  onToggle: () => void;
  ruanganId: string;
  frekuensi: Frekuensi;
}) {
  const denom = Math.max(total, run.done);
  const pct = denom > 0 ? Math.round((run.done / denom) * 100) : 0;

  return (
    <Card className={cn("overflow-hidden transition-colors", open && "border-brand/40")}>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-2/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring"
      >
        <Ring pct={pct} done={run.selesai} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate text-sm font-semibold text-fg">{run.periodeLabel}</p>
            {run.current && <Badge tone="brand" dot>Kini</Badge>}
            {run.selesai ? <Badge tone="success" dot>Selesai</Badge> : <Badge tone="neutral" dot>Berjalan</Badge>}
          </div>
          <p className="mt-0.5 truncate text-xs text-fg-muted">
            {run.done} dari {denom} barang diperiksa
            {run.selesai && run.selesaiBy ? ` · oleh ${run.selesaiBy}` : ""}
            {run.selesaiAt ? ` · ${formatDateTime(run.selesaiAt)}` : ""}
          </p>
        </div>
        <ChevronDown className={cn("size-4 shrink-0 text-fg-subtle transition-transform", open && "rotate-180")} />
      </button>

      {open && <RunDetailBody runId={run.id} ruanganId={ruanganId} frekuensi={frekuensi} periodeKey={run.periodeKey} />}
    </Card>
  );
}

function RunDetailBody({
  runId,
  ruanganId,
  frekuensi,
  periodeKey,
}: {
  runId: string;
  ruanganId: string;
  frekuensi: Frekuensi;
  periodeKey: string;
}) {
  const toast = useToast();
  const [exporting, setExporting] = useState(false);
  const { result, loading, error, reload } = useAsyncData<RunDetail | null>(() => fetchRunDetail(runId), [runId]);

  async function doExport() {
    setExporting(true);
    try {
      await downloadFromEndpoint(
        exportChecklistUrl({ ruanganId, frekuensi, mode: "periode", periodeKey }),
        `Checklist_${periodeKey}.xlsx`,
      );
    } catch (e) {
      toast.error("Gagal mengekspor", e instanceof Error ? e.message : undefined);
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="border-t border-border bg-surface-2/30 px-4 py-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-xs font-medium text-fg-muted">Rincian pemeriksaan barang</p>
        <Button variant="ghost" size="sm" icon={<FileDown className="size-3.5" />} onClick={doExport} loading={exporting} disabled={loading || error}>
          Ekspor periode
        </Button>
      </div>

      {loading ? (
        <div className="space-y-2 py-1">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-10 w-full rounded" />)}
        </div>
      ) : error || !result ? (
        <ErrorState onRetry={reload} />
      ) : result.rows.length === 0 ? (
        <p className="py-3 text-center text-xs text-fg-subtle">Ruangan ini belum memiliki unit barang.</p>
      ) : (
        <ul className="max-h-96 space-y-1.5 overflow-y-auto pr-0.5">
          {result.rows.map((r) => (
            <li
              key={r.barangId}
              className={cn(
                "flex items-start gap-2.5 rounded-[var(--radius-md)] border px-3 py-2",
                r.checked ? "border-success/30 bg-success-soft/20" : "border-border bg-surface",
              )}
            >
              {r.checked
                ? <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" />
                : <Circle className="mt-0.5 size-4 shrink-0 text-fg-subtle" />}
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                  <span className="font-mono text-[11px] font-semibold text-brand">{r.kodeBarang}</span>
                  <span className="truncate text-sm text-fg">{r.nama}</span>
                  {r.kondisi && (
                    <Badge tone={(r.kondisi.tone as Tone) || "neutral"} dot>{r.kondisi.nama}</Badge>
                  )}
                </div>
                {r.catatan && <p className="mt-0.5 text-xs text-fg-muted">{r.catatan}</p>}
                {r.checked && (
                  <p className="mt-0.5 flex items-center gap-1.5 text-[11px] text-fg-subtle">
                    <UserCheck className="size-3 shrink-0" />
                    {r.checkedBy ?? "—"}
                    {r.checkedAt ? <><Clock className="ml-1 size-3 shrink-0" />{formatTime(r.checkedAt)}</> : null}
                  </p>
                )}
                {!r.checked && <p className="mt-0.5 text-[11px] text-fg-subtle">Belum diperiksa</p>}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Cincin progres kecil (SVG). */
function Ring({ pct, done }: { pct: number; done: boolean }) {
  const r = 15;
  const c = 2 * Math.PI * r;
  const off = c - (Math.min(Math.max(pct, 0), 100) / 100) * c;
  return (
    <span className="relative flex size-10 shrink-0 items-center justify-center">
      <svg viewBox="0 0 36 36" className="size-10 -rotate-90">
        <circle cx="18" cy="18" r={r} fill="none" strokeWidth="3" className="stroke-surface-2" />
        <circle
          cx="18" cy="18" r={r} fill="none" strokeWidth="3" strokeLinecap="round"
          className={cn(done ? "stroke-success" : "stroke-brand", "transition-all duration-500")}
          strokeDasharray={c} strokeDashoffset={off}
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center">
        {done
          ? <CheckCircle2 className="size-4 text-success" />
          : pct === 0
            ? <CircleDashed className="size-4 text-fg-subtle" />
            : <span className="text-[10px] font-semibold tabular-nums text-fg-muted">{pct}%</span>}
      </span>
    </span>
  );
}

function ListSkeleton() {
  return (
    <div className="space-y-2.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 rounded-[var(--radius-lg)] border border-border bg-surface px-4 py-3">
          <Skeleton className="size-10 rounded-full" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-3.5 w-40 rounded" />
            <Skeleton className="h-3 w-56 rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}

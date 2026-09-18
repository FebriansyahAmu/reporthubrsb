"use client";

import { useMemo, useState } from "react";
import {
  AlertCircle,
  Clock,
  FileSpreadsheet,
  Layers,
  RefreshCw,
  RotateCcw,
  Stethoscope,
  UserPlus,
} from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { DatePicker } from "@/components/ui/DatePicker";
import { Label } from "@/components/ui/Field";
import { Skeleton } from "@/components/ui/Skeleton";
import { Table, THead, TH, TBody, TR, TD } from "@/components/ui/Table";
import { EmptyState, ErrorState } from "@/components/feedback/States";
import { cn } from "@/lib/cn";
import { useAsyncData } from "@/lib/useAsyncData";
import { downloadFromEndpoint } from "@/lib/download";
import { formatDate, formatJam, formatNumber } from "@/lib/format";
import type { Rl51Result } from "@/server/modules/rl51/rl51.types";

/* ------------------------------------------------------------------ helpers */

const p2 = (n: number) => String(n).padStart(2, "0");
const ymd = (d: Date) => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;

type PresetKey = "bulan-ini" | "bulan-lalu" | "triwulan" | "tahun-ini";

function presetRange(key: PresetKey): { from: string; to: string } {
  const now = new Date();
  const today = ymd(now);
  if (key === "bulan-lalu") {
    const first = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const last = new Date(now.getFullYear(), now.getMonth(), 0);
    return { from: ymd(first), to: ymd(last) };
  }
  if (key === "triwulan") {
    const q = Math.floor(now.getMonth() / 3);
    return { from: ymd(new Date(now.getFullYear(), q * 3, 1)), to: today };
  }
  if (key === "tahun-ini") return { from: ymd(new Date(now.getFullYear(), 0, 1)), to: today };
  return { from: ymd(new Date(now.getFullYear(), now.getMonth(), 1)), to: today };
}

const PRESETS: { key: PresetKey; label: string }[] = [
  { key: "bulan-ini", label: "Bulan ini" },
  { key: "bulan-lalu", label: "Bulan lalu" },
  { key: "triwulan", label: "Triwulan" },
  { key: "tahun-ini", label: "Tahun ini" },
];

async function fetchRl51(from: string, to: string): Promise<Rl51Result> {
  const p = new URLSearchParams({ from, to });
  const res = await fetch(`/api/laporan/rl51?${p.toString()}`);
  if (!res.ok) throw new Error("Gagal memuat data");
  return ((await res.json()) as { data: Rl51Result }).data;
}

/* -------------------------------------------------------------------- view */

export function Rl51View() {
  const initial = useMemo(() => presetRange("bulan-ini"), []);
  const [from, setFrom] = useState(initial.from);
  const [to, setTo] = useState(initial.to);
  const [preset, setPreset] = useState<PresetKey | "">("bulan-ini");
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const rangeInvalid = !!from && !!to && from > to;

  const { result, loading, error, reload } = useAsyncData<Rl51Result>(
    () => fetchRl51(from, to),
    [from, to],
  );

  const rows = result?.data ?? [];
  const summary = result?.summary ?? null;
  const updatedAt = result?.updatedAt ?? null;
  const hasFilter = preset !== "bulan-ini";

  function applyPreset(key: PresetKey) {
    const rng = presetRange(key);
    setFrom(rng.from);
    setTo(rng.to);
    setPreset(key);
  }

  async function doExport() {
    setExporting(true);
    setExportError(null);
    try {
      const p = new URLSearchParams({ from, to });
      await downloadFromEndpoint(`/api/laporan/rl51/export?${p.toString()}`, "RL-5.1.xlsx");
    } catch (e) {
      setExportError(e instanceof Error ? e.message : "Gagal mengekspor data.");
    } finally {
      setExporting(false);
    }
  }

  const canExport = !rangeInvalid && !loading && (summary?.totalKunjungan ?? 0) > 0;

  return (
    <div className="space-y-5">
      {/* Status bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm text-fg-muted">
          <Clock className="size-4" />
          {updatedAt ? (
            <span className="tabular">Diperbarui pukul {formatJam(updatedAt)}</span>
          ) : (
            <span>Memuat…</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            icon={<RefreshCw className={cn("size-4", loading && "animate-spin")} />}
            onClick={() => reload()}
          >
            Refresh
          </Button>
          <Button
            size="sm"
            icon={<FileSpreadsheet className="size-4" />}
            loading={exporting}
            disabled={!canExport}
            onClick={doExport}
            title={canExport ? "Unduh matriks RL 5.1 (Excel)" : "Tidak ada data untuk diekspor"}
          >
            Export Excel
          </Button>
        </div>
      </div>

      {exportError && (
        <div className="flex items-center gap-2 rounded-[var(--radius-md)] border border-danger/30 bg-danger-soft px-3 py-2 text-sm text-danger">
          <AlertCircle className="size-4 shrink-0" />
          {exportError}
        </div>
      )}

      {/* Filter periode */}
      <Card className="p-4">
        <Label>Periode (tanggal kunjungan)</Label>
        <div className="flex flex-wrap items-center gap-2">
          {PRESETS.map((pr) => (
            <Chip key={pr.key} active={preset === pr.key} onClick={() => applyPreset(pr.key)}>
              {pr.label}
            </Chip>
          ))}
          <span className="mx-1 hidden h-5 w-px bg-border sm:block" />
          <div className="w-[10.5rem]">
            <DatePicker
              value={from}
              onChange={(v) => {
                setFrom(v);
                setPreset("");
              }}
              max={to || undefined}
              clearable={false}
            />
          </div>
          <span className="text-fg-subtle">–</span>
          <div className="w-[10.5rem]">
            <DatePicker
              value={to}
              onChange={(v) => {
                setTo(v);
                setPreset("");
              }}
              min={from || undefined}
              clearable={false}
            />
          </div>
          {hasFilter && (
            <button
              type="button"
              onClick={() => applyPreset("bulan-ini")}
              className="ml-auto inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-medium text-fg-muted transition-colors hover:bg-surface-2 hover:text-fg"
            >
              <RotateCcw className="size-3.5" />
              Reset
            </button>
          )}
        </div>
        {rangeInvalid && (
          <p className="mt-2 text-xs text-danger">Tanggal awal melebihi tanggal akhir.</p>
        )}
      </Card>

      {/* Ringkasan */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          icon={Stethoscope}
          label="Total kunjungan"
          value={summary ? formatNumber(summary.totalKunjungan) : "—"}
          hint={summary ? `${formatNumber(summary.jenisDiag)} jenis diagnosa` : ""}
          loading={loading}
          accent
        />
        <StatTile
          icon={UserPlus}
          label="Kasus baru"
          value={summary ? formatNumber(summary.totalBaru) : "—"}
          hint={
            summary && summary.totalKunjungan > 0
              ? `${Math.round((summary.totalBaru / summary.totalKunjungan) * 100)}% dari kunjungan`
              : ""
          }
          loading={loading}
        />
        <StatTile
          icon={Layers}
          label="Jenis diagnosa (ICD-10)"
          value={summary ? formatNumber(summary.jenisDiag) : "—"}
          loading={loading}
        />
        <SplitTile
          label="Komposisi L / P"
          aLabel="L"
          bLabel="P"
          a={summary?.totalLk ?? 0}
          b={summary?.totalPr ?? 0}
          loading={loading}
        />
      </div>

      {/* Tabel ringkas per ICD */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-fg">Rekap per Diagnosa (ICD-10)</h3>
          <p className="text-[11px] text-fg-subtle">
            {formatDate(from)} – {formatDate(to)} · rincian 25 kelompok umur tersedia di Export Excel
          </p>
        </div>
        {!loading && rows.length > 0 && (
          <span className="text-xs text-fg-subtle tabular">{formatNumber(rows.length)} diagnosa</span>
        )}
      </div>

      <Card className="overflow-hidden p-0">
        {loading ? (
          <TableSkeleton />
        ) : error ? (
          <ErrorState onRetry={reload} />
        ) : rows.length === 0 ? (
          <EmptyState
            title="Tidak ada data"
            description="Tidak ada kunjungan rawat jalan / gawat darurat dengan diagnosa pada periode ini. Coba perlebar periode."
          />
        ) : (
          <div className="max-h-[62vh] overflow-auto">
            <Table>
              <THead>
                <TH className="w-12 text-center">No</TH>
                <TH className="w-24">Kode</TH>
                <TH>Diagnosa</TH>
                <TH className="text-right">L</TH>
                <TH className="text-right">P</TH>
                <TH className="text-right">Baru</TH>
                <TH className="text-right">Kunjungan</TH>
              </THead>
              <TBody>
                {rows.map((it) => (
                  <TR key={it.kode}>
                    <TD align="center" className="text-xs text-fg-subtle tabular">
                      {it.rank}
                    </TD>
                    <TD className="font-mono text-xs font-semibold text-fg">{it.kode}</TD>
                    <TD className="text-fg-muted">{it.diagnosa}</TD>
                    <TD align="right" className="tabular text-fg-muted">
                      {formatNumber(it.lk)}
                    </TD>
                    <TD align="right" className="tabular text-fg-muted">
                      {formatNumber(it.pr)}
                    </TD>
                    <TD align="right" className="tabular font-semibold text-brand-soft-fg">
                      {formatNumber(it.baru)}
                    </TD>
                    <TD align="right" className="tabular font-semibold text-fg">
                      {formatNumber(it.total)}
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </div>
        )}
      </Card>

      <p className="text-xs text-fg-subtle">
        Sumber: SIMGOS (read-only) · kunjungan rawat jalan &amp; gawat darurat dengan diagnosa
        klinis (ICD-10), dihitung pada tanggal kunjungan. &quot;Baru&quot; = kasus baru
        (<span className="font-mono">md.BARU</span>); kolom kelompok umur di Excel = kasus baru.
        Logika di-port dari SP <span className="font-mono">LaporanRL51Revisi</span> dengan 25
        kelompok umur diperbaiki.
      </p>
    </div>
  );
}

/* --------------------------------------------------------------- stat tiles */

function StatTile({
  icon: Icon,
  label,
  value,
  hint,
  loading,
  accent,
}: {
  icon: typeof Stethoscope;
  label: string;
  value: string;
  hint?: string;
  loading: boolean;
  accent?: boolean;
}) {
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-fg-muted">{label}</p>
        <span
          className={cn(
            "flex size-7 items-center justify-center rounded-[var(--radius-md)]",
            accent ? "bg-brand-soft text-brand" : "bg-surface-2 text-fg-muted",
          )}
        >
          <Icon className="size-3.5" />
        </span>
      </div>
      <p className="mt-2 text-2xl font-semibold tabular text-fg">
        {loading ? <span className="text-fg-subtle">—</span> : value}
      </p>
      {hint && !loading && <p className="mt-0.5 truncate text-[11px] text-fg-subtle">{hint}</p>}
    </Card>
  );
}

function SplitTile({
  label,
  aLabel,
  bLabel,
  a,
  b,
  loading,
}: {
  label: string;
  aLabel: string;
  bLabel: string;
  a: number;
  b: number;
  loading: boolean;
}) {
  const total = a + b;
  const aPct = total > 0 ? (a / total) * 100 : 50;
  return (
    <Card className="p-4">
      <p className="text-xs font-medium text-fg-muted">{label}</p>
      {loading ? (
        <div className="mt-3 space-y-2">
          <Skeleton className="h-2 w-full rounded-full" />
          <Skeleton className="h-3 w-24 rounded" />
        </div>
      ) : (
        <>
          <div className="mt-3 flex h-2.5 w-full overflow-hidden rounded-full bg-surface-2">
            <span className="h-full bg-accent" style={{ width: `${aPct}%` }} />
            <span className="h-full bg-brand" style={{ width: `${100 - aPct}%` }} />
          </div>
          <div className="mt-2 flex items-center justify-between text-[11px] text-fg-muted tabular">
            <span className="inline-flex items-center gap-1">
              <span className="size-1.5 rounded-full bg-accent" />
              {aLabel} {formatNumber(a)}
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="size-1.5 rounded-full bg-brand" />
              {bLabel} {formatNumber(b)}
            </span>
          </div>
        </>
      )}
    </Card>
  );
}

/* ------------------------------------------------------------------ controls */

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center rounded-full border px-3 py-1.5 text-[13px] font-medium transition-colors",
        active
          ? "border-brand bg-brand-soft text-brand-soft-fg"
          : "border-border bg-surface text-fg-muted hover:bg-surface-2 hover:text-fg",
      )}
    >
      {children}
    </button>
  );
}

/* ------------------------------------------------------------------ skeleton */

function TableSkeleton() {
  return (
    <div className="divide-y divide-border">
      {Array.from({ length: 10 }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 px-4 py-3">
          <Skeleton className="size-4 rounded" />
          <Skeleton className="h-3.5 w-16 rounded" />
          <Skeleton className="h-3.5 flex-1 rounded" />
          <Skeleton className="h-3.5 w-10 rounded" />
          <Skeleton className="h-3.5 w-10 rounded" />
          <Skeleton className="h-3.5 w-12 rounded" />
        </div>
      ))}
    </div>
  );
}

"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  Clock,
  Loader,
  Pause,
  Play,
  RefreshCw,
  RotateCcw,
  Search,
  Users,
  X,
} from "lucide-react";
import { Card, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Input, InputWithIcon, Label, Select } from "@/components/ui/Field";
import { StatCard } from "@/components/ui/StatCard";
import { TableSkeleton } from "@/components/ui/Skeleton";
import { Pagination } from "@/components/ui/Pagination";
import { EmptyState, ErrorState } from "@/components/feedback/States";
import { cn } from "@/lib/cn";
import { useDebounce } from "@/lib/useDebounce";
import { useAsyncData } from "@/lib/useAsyncData";
import { formatDate, formatDurasi, formatJam } from "@/lib/format";
import {
  ANTREAN_STATUS_LABEL,
  TASK_META,
  type AntreanBpjs,
  type AntreanStatus,
} from "@/lib/types";
import { completedCount, getAntreanBpjs, POLI_BPJS, TODAY_STR } from "@/lib/mock/bpjs";
import { TaskTracker } from "./TaskTracker";
import { TaskTimeline } from "./TaskTimeline";
import { AntreanPipeline } from "./AntreanPipeline";

const REFRESH_MS = 15000;

const STATUS_TONE: Record<AntreanStatus, "success" | "accent" | "danger"> = {
  SELESAI: "success",
  BERLANGSUNG: "accent",
  TERLAMBAT: "danger",
};

export function AntreanBpjsView() {
  const [tanggal, setTanggal] = useState(TODAY_STR);
  const [searchInput, setSearchInput] = useState("");
  const [poli, setPoli] = useState<string>("ALL");
  const [status, setStatus] = useState<AntreanStatus | "ALL">("ALL");
  const [tahap, setTahap] = useState<number | "ALL">("ALL");
  const [page, setPage] = useState(1);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const search = useDebounce(searchInput, 350);

  const filter = useMemo(
    () => ({ tanggal, search, poli, status, tahap, page, pageSize: 10 }),
    [tanggal, search, poli, status, tahap, page],
  );

  const { result, loading, error, reload } = useAsyncData(
    () => getAntreanBpjs(filter),
    [filter],
  );

  const data = result?.data ?? [];
  const meta = result?.meta ?? null;
  const summary = result?.summary ?? null;
  const pipeline = result?.pipeline ?? [];
  const updatedAt = result?.updatedAt ?? null;

  // Reset ke halaman 1 (dan tutup baris) saat filter selain page berubah — pola render-phase.
  const filterKey = `${tanggal}|${search}|${poli}|${status}|${tahap}`;
  const [prevKey, setPrevKey] = useState(filterKey);
  if (prevKey !== filterKey) {
    setPrevKey(filterKey);
    setPage(1);
    setExpandedId(null);
  }

  // Auto-refresh berkala (reload dipanggil di callback timer → aman).
  useEffect(() => {
    if (!autoRefresh) return;
    const id = setInterval(() => reload(), REFRESH_MS);
    return () => clearInterval(id);
  }, [autoRefresh, reload]);

  const hasFilter =
    tanggal !== TODAY_STR ||
    !!search ||
    poli !== "ALL" ||
    status !== "ALL" ||
    tahap !== "ALL";

  function resetFilters() {
    setTanggal(TODAY_STR);
    setSearchInput("");
    setPoli("ALL");
    setStatus("ALL");
    setTahap("ALL");
  }

  function toggleTahap(t: number) {
    setTahap((cur) => (cur === t ? "ALL" : t));
  }

  return (
    <div className="space-y-5">
      {/* Bar status refresh */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm text-fg-muted">
          <span className="relative flex size-2">
            <span className={cn("absolute inline-flex size-full rounded-full", autoRefresh ? "animate-ping bg-success/60" : "bg-fg-subtle")} />
            <span className={cn("relative inline-flex size-2 rounded-full", autoRefresh ? "bg-success" : "bg-fg-subtle")} />
          </span>
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
            icon={autoRefresh ? <Pause className="size-4" /> : <Play className="size-4" />}
            onClick={() => setAutoRefresh((v) => !v)}
          >
            {autoRefresh ? "Jeda auto-refresh" : "Auto-refresh"}
          </Button>
          <Button
            variant="primary"
            size="sm"
            icon={<RefreshCw className={cn("size-4", loading && "animate-spin")} />}
            onClick={() => reload()}
          >
            Refresh
          </Button>
        </div>
      </div>

      {/* Ringkasan */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Total Antrean" value={summary?.total ?? 0} icon={Users} tone="brand" loading={loading} />
        <StatCard label="Selesai (T7)" value={summary?.selesai ?? 0} icon={CheckCircle2} tone="success" loading={loading} />
        <StatCard label="Berlangsung" value={summary?.berlangsung ?? 0} icon={Loader} tone="accent" loading={loading} />
        <StatCard label="Terlambat" value={summary?.terlambat ?? 0} icon={AlertTriangle} tone="danger" loading={loading} />
      </div>

      {/* Pipeline */}
      <Card>
        <CardHeader
          title="Posisi Antrean Saat Ini"
          subtitle="Jumlah pasien per tahap (berdasarkan task terakhir yang tercatat). Klik tahap untuk memfilter."
          action={
            <div className="flex items-center gap-1.5 rounded-md bg-surface-2 px-2.5 py-1 text-xs text-fg-muted">
              <Clock className="size-3.5" />
              Rata-rata layanan:{" "}
              <span className="font-medium text-fg tabular">{formatDurasi(summary?.rataMenit)}</span>
            </div>
          }
        />
        <div className="p-4">
          <AntreanPipeline pipeline={pipeline} activeTahap={tahap} onSelect={toggleTahap} loading={loading} />
        </div>
      </Card>

      {/* Filter */}
      <Card className="p-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <div>
            <Label htmlFor="tanggal">Tanggal</Label>
            <Input
              id="tanggal"
              type="date"
              value={tanggal}
              max={TODAY_STR}
              onChange={(e) => setTanggal(e.target.value)}
            />
          </div>
          <div className="lg:col-span-2">
            <Label htmlFor="cari">Cari</Label>
            <InputWithIcon
              id="cari"
              icon={<Search className="size-4" />}
              placeholder="Nama / No. antrean / Kode booking / No. kartu"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="poli">Poli</Label>
            <Select id="poli" value={poli} onChange={(e) => setPoli(e.target.value)}>
              <option value="ALL">Semua poli</option>
              {POLI_BPJS.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="status">Status</Label>
            <Select id="status" value={status} onChange={(e) => setStatus(e.target.value as AntreanStatus | "ALL")}>
              <option value="ALL">Semua status</option>
              <option value="BERLANGSUNG">Berlangsung</option>
              <option value="TERLAMBAT">Terlambat</option>
              <option value="SELESAI">Selesai</option>
            </Select>
          </div>
        </div>

        {/* Chip filter aktif */}
        {hasFilter && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {tanggal !== TODAY_STR && (
              <FilterChip
                label={`Tanggal: ${formatDate(tanggal)}`}
                onClear={() => setTanggal(TODAY_STR)}
              />
            )}
            {tahap !== "ALL" && (
              <FilterChip
                label={`Tahap: ${TASK_META[(tahap as number) - 1].kode} ${(tahap as number) === 7 ? "Selesai" : TASK_META[(tahap as number) - 1].nama}`}
                onClear={() => setTahap("ALL")}
              />
            )}
            {poli !== "ALL" && <FilterChip label={poli} onClear={() => setPoli("ALL")} />}
            {status !== "ALL" && <FilterChip label={ANTREAN_STATUS_LABEL[status]} onClear={() => setStatus("ALL")} />}
            {!!search && <FilterChip label={`"${search}"`} onClear={() => setSearchInput("")} />}
            <Button variant="ghost" size="sm" icon={<RotateCcw className="size-4" />} onClick={resetFilters}>
              Reset
            </Button>
          </div>
        )}
      </Card>

      {/* Tabel antrean */}
      <Card className="overflow-hidden">
        <CardHeader
          title="Daftar Antrean"
          subtitle={!loading && meta ? `${meta.total} antrean pada tanggal terpilih` : undefined}
        />
        {loading ? (
          <TableSkeleton rows={8} cols={5} />
        ) : error ? (
          <ErrorState onRetry={reload} />
        ) : data.length === 0 ? (
          <EmptyState title="Tidak ada antrean" description="Tidak ada antrean yang cocok dengan filter." />
        ) : (
          <>
            <div className="w-full overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead className="bg-surface-2/60">
                <tr className="border-b border-border text-left text-xs font-semibold uppercase tracking-wide text-fg-muted">
                  <th className="px-4 py-3">No. Antrean</th>
                  <th className="px-4 py-3">Pasien</th>
                  <th className="px-4 py-3">Poli / Dokter</th>
                  <th className="px-4 py-3">Progres Task 1–7</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="w-10 px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {data.map((a) => (
                  <AntreanRow
                    key={a.id}
                    antrean={a}
                    expanded={expandedId === a.id}
                    onToggle={() => setExpandedId((cur) => (cur === a.id ? null : a.id))}
                  />
                ))}
              </tbody>
            </table>
            </div>
            {meta && <Pagination meta={meta} onPageChange={setPage} />}
          </>
        )}
      </Card>
    </div>
  );
}

function AntreanRow({
  antrean,
  expanded,
  onToggle,
}: {
  antrean: AntreanBpjs;
  expanded: boolean;
  onToggle: () => void;
}) {
  const done = completedCount(antrean);
  return (
    <>
      <tr
        onClick={onToggle}
        className={cn(
          "cursor-pointer border-b border-border transition-colors hover:bg-surface-2/50",
          expanded && "bg-surface-2/40",
        )}
      >
        <td className="px-4 py-3">
          <span className="font-semibold text-fg tabular">{antrean.noAntrean}</span>
          <span className="mt-0.5 block font-mono text-[11px] text-fg-subtle">{antrean.kodeBooking}</span>
        </td>
        <td className="px-4 py-3">
          <span className="font-medium text-fg">{antrean.namaPasien}</span>
          <span className="mt-0.5 block text-xs text-fg-muted tabular">{antrean.noKartu}</span>
        </td>
        <td className="px-4 py-3">
          <span className="text-fg">{antrean.poli}</span>
          <span className="mt-0.5 block text-xs text-fg-muted">{antrean.dokter}</span>
        </td>
        <td className="px-4 py-3">
          <div className="flex items-center gap-3">
            <TaskTracker antrean={antrean} />
            <span className="text-xs text-fg-muted tabular">{done}/7</span>
          </div>
        </td>
        <td className="px-4 py-3">
          <Badge tone={STATUS_TONE[antrean.status]} dot>
            {ANTREAN_STATUS_LABEL[antrean.status]}
          </Badge>
        </td>
        <td className="px-4 py-3 text-fg-subtle">
          <ChevronDown className={cn("size-4 transition-transform", expanded && "rotate-180")} />
        </td>
      </tr>
      {expanded && (
          <tr>
            <td colSpan={6} className="border-b border-border bg-surface-2/20 p-0">
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                className="overflow-hidden"
              >
                <div className="grid grid-cols-1 gap-6 p-5 lg:grid-cols-[1fr_1.4fr]">
                  {/* Info booking */}
                  <div className="space-y-3">
                    <h4 className="text-xs font-semibold uppercase tracking-wide text-fg-muted">Detail Antrean</h4>
                    <dl className="space-y-2 text-sm">
                      <InfoRow label="Kode Booking" value={<span className="font-mono">{antrean.kodeBooking}</span>} />
                      <InfoRow label="No. Antrean" value={antrean.noAntrean} />
                      <InfoRow label="No. Kartu BPJS" value={<span className="tabular">{antrean.noKartu}</span>} />
                      <InfoRow label="Poli" value={antrean.poli} />
                      <InfoRow label="Dokter" value={antrean.dokter} />
                      <InfoRow
                        label="Status"
                        value={
                          <Badge tone={STATUS_TONE[antrean.status]} dot>
                            {ANTREAN_STATUS_LABEL[antrean.status]}
                          </Badge>
                        }
                      />
                    </dl>
                  </div>
                  {/* Timeline task */}
                  <div>
                    <h4 className="mb-3 text-xs font-semibold uppercase tracking-wide text-fg-muted">
                      Riwayat Task (dikirim ke BPJS)
                    </h4>
                    <TaskTimeline antrean={antrean} />
                  </div>
                </div>
              </motion.div>
            </td>
          </tr>
        )}
    </>
  );
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-fg-muted">{label}</dt>
      <dd className="text-right font-medium text-fg">{value}</dd>
    </div>
  );
}

function FilterChip({ label, onClear }: { label: string; onClear: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-brand-soft px-2.5 py-1 text-xs font-medium text-brand-soft-fg">
      {label}
      <button onClick={onClear} className="rounded-full hover:bg-brand/20" aria-label={`Hapus filter ${label}`}>
        <X className="size-3" />
      </button>
    </span>
  );
}

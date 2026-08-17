"use client";

import { useState } from "react";
import { AnimatePresence, motion, type Variants } from "framer-motion";
import {
  AlertCircle,
  ArrowUpRight,
  Building2,
  CalendarDays,
  Clock,
  FileSpreadsheet,
  FileText,
  RefreshCw,
  RotateCcw,
  Search,
  Share2,
  Stethoscope,
  User,
} from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { InputWithIcon, Label } from "@/components/ui/Field";
import { DatePicker } from "@/components/ui/DatePicker";
import { StatCard } from "@/components/ui/StatCard";
import { Skeleton } from "@/components/ui/Skeleton";
import { Pagination } from "@/components/ui/Pagination";
import { EmptyState, ErrorState } from "@/components/feedback/States";
import { cn } from "@/lib/cn";
import { useDebounce } from "@/lib/useDebounce";
import { useAsyncData } from "@/lib/useAsyncData";
import { formatDate, formatJam } from "@/lib/format";
import type { RujukanKeluarItem, RujukanKeluarResult } from "@/server/modules/rujukan/rujukan.types";

const PAGE_SIZE = 10;

type JenisFilter = "" | "1" | "2";

async function fetchRujukan(args: {
  from: string;
  to: string;
  jenis: JenisFilter;
  search: string;
  page: number;
}): Promise<RujukanKeluarResult> {
  const p = new URLSearchParams({ page: String(args.page), pageSize: String(PAGE_SIZE) });
  if (args.from) p.set("from", args.from);
  if (args.to) p.set("to", args.to);
  if (args.jenis) p.set("jnsPelayanan", args.jenis);
  if (args.search) p.set("search", args.search);
  const res = await fetch(`/api/laporan/rujukan-keluar?${p.toString()}`);
  if (!res.ok) throw new Error("Gagal memuat data");
  const json = (await res.json()) as { data: RujukanKeluarResult };
  return json.data;
}

export function RujukanKeluarView() {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [jenis, setJenis] = useState<JenisFilter>("");
  const [searchInput, setSearchInput] = useState("");
  const [page, setPage] = useState(1);
  const search = useDebounce(searchInput, 350);

  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const rangeInvalid = !!from && !!to && from > to;

  const filterKey = `${from}|${to}|${jenis}|${search}`;
  const [prevKey, setPrevKey] = useState(filterKey);
  if (prevKey !== filterKey) {
    setPrevKey(filterKey);
    setPage(1);
  }

  const { result, loading, error, reload } = useAsyncData<RujukanKeluarResult>(
    () => fetchRujukan({ from, to, jenis, search, page }),
    [from, to, jenis, search, page],
  );

  const items = result?.data ?? [];
  const meta = result?.meta ?? null;
  const counts = result?.counts ?? null;
  const updatedAt = result?.updatedAt ?? null;
  const hasFilter = !!(from || to || jenis || search);

  const jenisTabs: { key: JenisFilter; label: string; count?: number }[] = [
    { key: "", label: "Semua", count: counts?.semua },
    { key: "1", label: "Rawat Inap", count: counts?.rawatInap },
    { key: "2", label: "Rawat Jalan", count: counts?.rawatJalan },
  ];

  function resetFilter() {
    setFrom("");
    setTo("");
    setJenis("");
    setSearchInput("");
  }

  async function doExport() {
    setExporting(true);
    setExportError(null);
    try {
      const p = new URLSearchParams();
      if (from) p.set("from", from);
      if (to) p.set("to", to);
      if (jenis) p.set("jnsPelayanan", jenis);
      if (search) p.set("search", search);
      const res = await fetch(`/api/laporan/rujukan-keluar/export?${p.toString()}`);
      if (!res.ok) {
        const j = await res.json().catch(() => null);
        throw new Error(j?.error?.message ?? "Gagal mengekspor data.");
      }
      const blob = await res.blob();
      const cd = res.headers.get("Content-Disposition") ?? "";
      const m = /filename="?([^"]+)"?/.exec(cd);
      const filename = m ? m[1] : "Rujukan-Keluar.xlsx";
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      setExportError(e instanceof Error ? e.message : "Gagal mengekspor data.");
    } finally {
      setExporting(false);
    }
  }

  const total = meta?.total ?? 0;
  const canExport = !rangeInvalid && !loading && total > 0;

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
            icon={<FileSpreadsheet className="size-4" />}
            loading={exporting}
            disabled={!canExport}
            onClick={doExport}
            title={total > 0 ? "Unduh sesuai filter" : "Tidak ada data untuk diekspor"}
          >
            Export Excel
          </Button>
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

      {exportError && (
        <div className="flex items-center gap-2 rounded-[var(--radius-md)] border border-danger/30 bg-danger-soft px-3 py-2 text-sm text-danger">
          <AlertCircle className="size-4 shrink-0" />
          {exportError}
        </div>
      )}

      {/* Ringkasan */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Total Rujukan" value={counts?.semua ?? 0} icon={Share2} tone="brand" loading={loading} />
        <StatCard label="Rawat Inap" value={counts?.rawatInap ?? 0} icon={ArrowUpRight} tone="accent" loading={loading} />
        <StatCard label="Rawat Jalan" value={counts?.rawatJalan ?? 0} icon={ArrowUpRight} tone="neutral" loading={loading} />
      </div>

      {/* Filter */}
      <Card className="p-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <Label>Dari tanggal</Label>
            <DatePicker value={from} onChange={setFrom} max={to || undefined} placeholder="Semua" />
          </div>
          <div>
            <Label>Sampai tanggal</Label>
            <DatePicker value={to} onChange={setTo} min={from || undefined} placeholder="Semua" />
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="cari">Cari</Label>
            <InputWithIcon
              id="cari"
              icon={<Search className="size-4" />}
              placeholder="Nama pasien / No. SEP / No. rujukan / faskes"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
            />
          </div>
        </div>

        {rangeInvalid && (
          <p className="mt-2 text-xs text-danger">Tanggal awal melebihi tanggal akhir.</p>
        )}

        {/* Chip jenis + reset */}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {jenisTabs.map((t) => {
            const active = jenis === t.key;
            return (
              <button
                key={t.key || "all"}
                type="button"
                onClick={() => setJenis(t.key)}
                className={cn(
                  "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[13px] font-medium transition-colors",
                  active
                    ? "border-brand bg-brand-soft text-brand-soft-fg"
                    : "border-border bg-surface text-fg-muted hover:bg-surface-2 hover:text-fg",
                )}
              >
                {t.label}
                <span
                  className={cn(
                    "rounded-full px-1.5 text-[11px] tabular-nums",
                    active ? "bg-brand/15 text-brand-soft-fg" : "bg-surface-2 text-fg-subtle",
                  )}
                >
                  {t.count ?? "—"}
                </span>
              </button>
            );
          })}
          {hasFilter && (
            <button
              type="button"
              onClick={resetFilter}
              className="ml-auto inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-medium text-fg-muted transition-colors hover:bg-surface-2 hover:text-fg"
            >
              <RotateCcw className="size-3.5" />
              Reset filter
            </button>
          )}
        </div>
      </Card>

      {/* Daftar */}
      {loading ? (
        <ListSkeleton />
      ) : error ? (
        <Card>
          <ErrorState onRetry={reload} />
        </Card>
      ) : items.length === 0 ? (
        <Card>
          <EmptyState
            title="Tidak ada rujukan"
            description={hasFilter ? "Tidak ada rujukan keluar untuk filter ini." : "Belum ada data rujukan keluar."}
          />
        </Card>
      ) : (
        <>
          <p className="text-xs text-fg-subtle">
            {hasFilter ? `${meta?.total ?? 0} rujukan cocok` : "Menampilkan 10 rujukan terakhir"}
          </p>
          <AnimatePresence mode="wait">
            <motion.div
              key={`${page}|${filterKey}`}
              variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.04 } } }}
              initial="hidden"
              animate="visible"
              className="space-y-3"
            >
              {items.map((it) => (
                <RujukanCard key={it.noRujukan} item={it} />
              ))}
            </motion.div>
          </AnimatePresence>

          {meta && meta.total > PAGE_SIZE && (
            <Card className="overflow-hidden">
              <Pagination meta={meta} onPageChange={setPage} />
            </Card>
          )}
        </>
      )}
    </div>
  );
}

const cardVariants: Variants = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.22, ease: [0.16, 1, 0.3, 1] } },
};

function RujukanCard({ item }: { item: RujukanKeluarItem }) {
  const ri = item.jnsPelayanan === 1;
  return (
    <motion.div
      variants={cardVariants}
      className={cn(
        "rounded-[var(--radius-lg)] border border-border bg-surface p-4 shadow-xs transition-colors hover:border-brand/40",
        "border-l-[3px]",
        ri ? "border-l-brand" : "border-l-accent",
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        {/* Kiri: pasien */}
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand-soft-fg">
            <User className="size-4.5" />
          </span>
          <div className="min-w-0">
            <p className="truncate font-semibold text-fg">{item.pasienNama}</p>
            <p className="truncate font-mono text-[11px] text-fg-subtle">
              SEP {item.noSep}
              {item.pasienNik ? ` · NIK ${item.pasienNik}` : ""}
            </p>
          </div>
        </div>
        {/* Kanan: jenis + tanggal */}
        <div className="flex flex-col items-end gap-1.5">
          <Badge tone={ri ? "brand" : "accent"}>{item.jenisLabel}</Badge>
          <span className="inline-flex items-center gap-1 text-xs text-fg-muted">
            <CalendarDays className="size-3.5" />
            {formatDate(item.tglRujukan)}
          </span>
        </div>
      </div>

      {/* Detail */}
      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
        <InfoRow icon={<Building2 className="size-4" />} label="Faskes tujuan" value={item.tujuanNama} />
        <InfoRow
          icon={<Stethoscope className="size-4" />}
          label="Diagnosa"
          value={
            item.diagRujukan ? (
              <span className="inline-flex items-center gap-2">
                <span className="rounded-md bg-surface-2 px-1.5 py-0.5 font-mono text-xs text-fg">
                  {item.diagRujukan}
                </span>
                {item.poliNama && <span className="text-fg-muted">· {item.poliNama}</span>}
              </span>
            ) : (
              "—"
            )
          }
        />
      </div>

      {item.catatan && (
        <div className="mt-2 flex items-start gap-2 rounded-[var(--radius-md)] bg-surface-2/50 px-3 py-2 text-xs text-fg-muted">
          <FileText className="mt-0.5 size-3.5 shrink-0 text-fg-subtle" />
          <span className="line-clamp-2">{item.catatan}</span>
        </div>
      )}
    </motion.div>
  );
}

function InfoRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-2 text-sm">
      <span className="mt-0.5 shrink-0 text-fg-subtle">{icon}</span>
      <div className="min-w-0">
        <span className="text-[11px] uppercase tracking-wide text-fg-subtle">{label}</span>
        <div className="truncate text-fg">{value}</div>
      </div>
    </div>
  );
}

function ListSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="rounded-[var(--radius-lg)] border border-border bg-surface p-4">
          <div className="flex items-start gap-3">
            <Skeleton className="size-9 rounded-full" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-4 w-48 rounded" />
              <Skeleton className="h-3 w-64 rounded" />
            </div>
            <Skeleton className="h-5 w-20 rounded-full" />
          </div>
          <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
            <Skeleton className="h-8 w-full rounded" />
            <Skeleton className="h-8 w-full rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}

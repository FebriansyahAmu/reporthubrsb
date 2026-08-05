"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion, type Variants } from "framer-motion";
import {
  CalendarCheck,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  Clock,
  DoorOpen,
  FileWarning,
  RefreshCw,
  Search,
} from "lucide-react";
import { Card, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Input, InputWithIcon, Label } from "@/components/ui/Field";
import { StatCard } from "@/components/ui/StatCard";
import { Skeleton } from "@/components/ui/Skeleton";
import { Pagination } from "@/components/ui/Pagination";
import { EmptyState, ErrorState } from "@/components/feedback/States";
import { cn } from "@/lib/cn";
import { useDebounce } from "@/lib/useDebounce";
import { useAsyncData } from "@/lib/useAsyncData";
import { addDays, formatDate, formatDateTime, formatJam, toLocalDateInput } from "@/lib/format";
import {
  RESUME_STATUS_META,
  RESUME_STATUS_ORDER,
  type KategoriKunjungan,
  type ResumeItem,
  type ResumeResult,
  type ResumeStatus,
} from "@/server/modules/pelayanan/pelayanan.types";
import type { RuanganOption } from "@/server/modules/kunjungan/kunjungan.types";

const KATEGORI: KategoriKunjungan[] = ["Rawat Inap", "Rawat Jalan Klinik", "IGD"];
const PAGE_SIZE = 12;

type StatusFilter = "Semua" | ResumeStatus;

const CARD_TONE: Record<"danger" | "warning" | "success", string> = {
  danger: "border-danger/40 bg-danger-soft hover:border-danger/60",
  warning: "border-warning/40 bg-warning-soft hover:border-warning/60",
  success: "border-success/40 bg-success-soft hover:border-success/60",
};

const KATEGORI_TONE: Record<KategoriKunjungan, "brand" | "accent" | "warning"> = {
  "Rawat Inap": "brand",
  "Rawat Jalan Klinik": "accent",
  IGD: "warning",
};

async function fetchResume(args: {
  from: string;
  toExclusive: string;
  ruanganId: string;
  kategori: "Semua" | KategoriKunjungan;
  status: StatusFilter;
  search: string;
  page: number;
}): Promise<ResumeResult> {
  const p = new URLSearchParams({
    from: args.from,
    to: args.toExclusive,
    page: String(args.page),
    pageSize: String(PAGE_SIZE),
  });
  if (args.ruanganId) p.set("ruangan", args.ruanganId);
  if (args.kategori !== "Semua") p.set("kategori", args.kategori);
  if (args.status !== "Semua") p.set("status", args.status);
  if (args.search) p.set("search", args.search);
  const res = await fetch(`/api/monitoring/pelayanan/resume?${p.toString()}`);
  if (!res.ok) throw new Error("Gagal memuat data");
  const json = (await res.json()) as { data: ResumeResult };
  return json.data;
}

export function ResumeView({
  ruanganOptions,
  nowIso,
}: {
  ruanganOptions: RuanganOption[];
  nowIso: string;
}) {
  const today = useMemo(() => toLocalDateInput(new Date(nowIso)), [nowIso]);
  const weekAgo = useMemo(() => toLocalDateInput(addDays(new Date(nowIso), -6)), [nowIso]);

  const [from, setFrom] = useState(weekAgo);
  const [to, setTo] = useState(today);
  const [ruanganId, setRuanganId] = useState("");
  const [kategori, setKategori] = useState<"Semua" | KategoriKunjungan>("Semua");
  const [status, setStatus] = useState<StatusFilter>("Semua");
  const [searchInput, setSearchInput] = useState("");
  const [page, setPage] = useState(1);
  const search = useDebounce(searchInput, 350);

  const toExclusive = useMemo(
    () => toLocalDateInput(addDays(new Date(`${to}T00:00:00`), 1)),
    [to],
  );

  const filterKey = `${from}|${toExclusive}|${ruanganId}|${kategori}|${status}|${search}`;
  const [prevKey, setPrevKey] = useState(filterKey);
  if (prevKey !== filterKey) {
    setPrevKey(filterKey);
    setPage(1);
  }

  const { result, loading, error, reload } = useAsyncData<ResumeResult>(
    () => fetchResume({ from, toExclusive, ruanganId, kategori, status, search, page }),
    [from, toExclusive, ruanganId, kategori, status, search, page],
  );

  const counts = result?.counts ?? null;
  const meta = result?.meta ?? null;
  const updatedAt = result?.updatedAt ?? null;
  const items = result?.data ?? [];
  const rangeInvalid = from > to;

  const ruanganByKategori = useMemo(() => {
    const g: Record<KategoriKunjungan, RuanganOption[]> = {
      "Rawat Inap": [],
      "Rawat Jalan Klinik": [],
      IGD: [],
    };
    for (const r of ruanganOptions) g[r.kategori]?.push(r);
    return g;
  }, [ruanganOptions]);

  const statusTabs: { key: StatusFilter; label: string }[] = [
    { key: "Semua", label: "Semua" },
    ...RESUME_STATUS_ORDER.map((s) => ({ key: s as StatusFilter, label: RESUME_STATUS_META[s].label })),
  ];

  return (
    <div className="space-y-5">
      {/* Bar status */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm text-fg-muted">
          <Clock className="size-4" />
          {updatedAt ? (
            <span className="tabular">Diperbarui pukul {formatJam(updatedAt)}</span>
          ) : (
            <span>Memuat…</span>
          )}
        </div>
        <Button
          variant="secondary"
          size="sm"
          icon={<RefreshCw className={cn("size-4", loading && "animate-spin")} />}
          onClick={() => reload()}
        >
          Refresh
        </Button>
      </div>

      {/* Ringkasan */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Total Final" value={counts?.Semua ?? 0} icon={CheckCircle2} tone="brand" loading={loading} />
        <StatCard label="Tanpa Resume" value={counts?.TANPA_RESUME ?? 0} icon={FileWarning} tone="danger" loading={loading} />
        <StatCard label="Resume Lengkap" value={counts?.LENGKAP ?? 0} icon={ClipboardList} tone="success" loading={loading} />
      </div>

      {/* Filter */}
      <Card className="p-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <Label htmlFor="from">Dari tanggal</Label>
            <Input id="from" type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="to">Sampai tanggal</Label>
            <Input id="to" type="date" value={to} max={today} min={from} onChange={(e) => setTo(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="cari">Cari</Label>
            <InputWithIcon
              id="cari"
              icon={<Search className="size-4" />}
              placeholder="Nama / No. RM / ruang"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="kategori">Kategori</Label>
            <select
              id="kategori"
              value={kategori}
              onChange={(e) => setKategori(e.target.value as "Semua" | KategoriKunjungan)}
              className="h-10 w-full rounded-[var(--radius-md)] border border-border bg-surface px-3 text-sm text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring"
            >
              <option value="Semua">Semua kategori</option>
              {KATEGORI.map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
            </select>
          </div>
          <div className="lg:col-span-2">
            <Label htmlFor="ruangan">Ruangan</Label>
            <select
              id="ruangan"
              value={ruanganId}
              onChange={(e) => setRuanganId(e.target.value)}
              className="h-10 w-full rounded-[var(--radius-md)] border border-border bg-surface px-3 text-sm text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring"
            >
              <option value="">Semua ruangan</option>
              {KATEGORI.map((k) =>
                ruanganByKategori[k].length ? (
                  <optgroup key={k} label={k}>
                    {ruanganByKategori[k].map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.nama}
                      </option>
                    ))}
                  </optgroup>
                ) : null,
              )}
            </select>
          </div>
        </div>

        {rangeInvalid && (
          <p className="mt-2 text-xs text-danger">Tanggal awal melebihi tanggal akhir.</p>
        )}

        {/* Tab status kelengkapan */}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {statusTabs.map((t) => {
            const active = status === t.key;
            const jumlah = counts ? counts[t.key] : undefined;
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => setStatus(t.key)}
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
                  {jumlah ?? "—"}
                </span>
              </button>
            );
          })}
        </div>
      </Card>

      {/* Daftar kartu */}
      <Card className="overflow-hidden">
        <CardHeader
          title="Kunjungan Final"
          subtitle={
            !loading && meta
              ? `${meta.total} kunjungan · rentang ${formatDate(from)} – ${formatDate(to)}`
              : undefined
          }
        />
        <div className="p-4">
          {loading ? (
            <CardGridSkeleton />
          ) : error ? (
            <ErrorState onRetry={reload} />
          ) : items.length === 0 ? (
            <EmptyState title="Tidak ada data" description="Tidak ada kunjungan final untuk filter ini." />
          ) : (
            <AnimatePresence mode="wait">
              <motion.div
                key={`${page}|${status}|${kategori}|${search}`}
                variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.035 } } }}
                initial="hidden"
                animate="visible"
                className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3"
              >
                {items.map((it) => (
                  <ResumeCard key={it.nomor} item={it} />
                ))}
              </motion.div>
            </AnimatePresence>
          )}
        </div>

        {!loading && !error && meta && meta.total > 0 && (
          <Pagination meta={meta} onPageChange={setPage} />
        )}
      </Card>
    </div>
  );
}

const cardVariants: Variants = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.22, ease: [0.16, 1, 0.3, 1] } },
};

function ResumeCard({ item }: { item: ResumeItem }) {
  const meta = RESUME_STATUS_META[item.status];
  // Surat Kontrol hanya relevan untuk Rawat Inap & Rawat Jalan Klinik (IGD nyaris tak ada).
  const showKontrol = item.kategori === "Rawat Inap" || item.kategori === "Rawat Jalan Klinik";
  return (
    <motion.div
      variants={cardVariants}
      className={cn(
        "flex flex-col rounded-[var(--radius-lg)] border p-4 shadow-xs transition-colors",
        CARD_TONE[meta.tone],
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-semibold text-fg">{item.nama}</p>
          <p className="font-mono text-xs text-fg-muted">
            {item.norm} · {item.jenisKelamin}
            {item.umur ? ` · ${item.umur}` : ""}
          </p>
        </div>
        <Badge tone={KATEGORI_TONE[item.kategori]}>{item.kategori}</Badge>
      </div>

      <div className="mt-3 space-y-1.5 text-[13px]">
        <Row icon={<DoorOpen className="size-3.5" />} value={item.ruang} />
        <Row
          icon={<Clock className="size-3.5" />}
          value={<>Keluar {formatDateTime(item.keluar ?? item.masuk)}</>}
        />
        <Row
          icon={<ClipboardList className="size-3.5" />}
          value={
            item.status === "TANPA_RESUME" ? (
              <span className="font-medium text-danger">Belum ada resume medis</span>
            ) : item.status === "RESUME_MINIM" ? (
              <span>
                Resume dibuat {formatDateTime(item.resumeTanggal ?? item.keluar ?? item.masuk)}
                <span className="mt-0.5 block text-xs text-warning">
                  Belum: {item.komponenKurang.join(", ")}
                </span>
              </span>
            ) : (
              <span>Resume dibuat {formatDateTime(item.resumeTanggal ?? item.keluar ?? item.masuk)}</span>
            )
          }
        />
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-border/70 pt-3">
        {showKontrol ? (
          item.kontrolTerbit ? (
            <Badge tone="success">
              <CalendarCheck className="size-3.5" />
              Kontrol {formatDate(item.kontrolTanggal)}
            </Badge>
          ) : (
            <Badge tone="warning" dot>
              <CalendarClock className="size-3.5" />
              Surat Kontrol belum terbit
            </Badge>
          )
        ) : (
          <span />
        )}
        <Badge tone={meta.tone} dot>
          {meta.label}
        </Badge>
      </div>
    </motion.div>
  );
}

function Row({ icon, value }: { icon: React.ReactNode; value: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2 text-fg-muted">
      <span className="mt-0.5 shrink-0 text-fg-subtle">{icon}</span>
      <span className="min-w-0 text-fg">{value}</span>
    </div>
  );
}

function CardGridSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="flex flex-col rounded-[var(--radius-lg)] border border-border bg-surface p-4"
        >
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1 space-y-1.5">
              <Skeleton className="h-4 w-3/4 rounded" />
              <Skeleton className="h-3 w-1/2 rounded" />
            </div>
            <Skeleton className="h-5 w-16 rounded-full" />
          </div>
          <div className="mt-3 space-y-2">
            <Skeleton className="h-3 w-2/3 rounded" />
            <Skeleton className="h-3 w-5/6 rounded" />
            <Skeleton className="h-3 w-4/6 rounded" />
          </div>
          <div className="mt-4 flex items-center justify-end border-t border-border/70 pt-3">
            <Skeleton className="h-5 w-24 rounded-full" />
          </div>
        </div>
      ))}
    </div>
  );
}

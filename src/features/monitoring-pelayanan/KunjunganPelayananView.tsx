"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion, type Variants } from "framer-motion";
import {
  CheckCircle2,
  Clock,
  DoorOpen,
  RefreshCw,
  Search,
  TriangleAlert,
  Users,
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
import {
  addDays,
  formatDate,
  formatDateTime,
  formatJam,
  formatLama,
  toLocalDateInput,
} from "@/lib/format";
import type {
  KategoriKunjungan,
  KunjunganPelayananItem,
  KunjunganPelayananResult,
} from "@/server/modules/pelayanan/pelayanan.types";
import type { RuanganOption } from "@/server/modules/kunjungan/kunjungan.types";

type Filter = "Semua" | KategoriKunjungan;
const KATEGORI: KategoriKunjungan[] = ["Rawat Inap", "Rawat Jalan Klinik", "IGD"];
const PAGE_SIZE = 12;

const KATEGORI_TONE: Record<KategoriKunjungan, "brand" | "accent" | "warning"> = {
  "Rawat Inap": "brand",
  "Rawat Jalan Klinik": "accent",
  IGD: "warning",
};

async function fetchKunjungan(args: {
  from: string;
  toExclusive: string;
  ruanganId: string;
  kategori: Filter;
  search: string;
  page: number;
}): Promise<KunjunganPelayananResult> {
  const p = new URLSearchParams({
    from: args.from,
    to: args.toExclusive,
    page: String(args.page),
    pageSize: String(PAGE_SIZE),
  });
  if (args.ruanganId) p.set("ruangan", args.ruanganId);
  if (args.kategori !== "Semua") p.set("kategori", args.kategori);
  if (args.search) p.set("search", args.search);
  const res = await fetch(`/api/monitoring/pelayanan/kunjungan?${p.toString()}`);
  if (!res.ok) throw new Error("Gagal memuat kunjungan");
  const json = (await res.json()) as { data: KunjunganPelayananResult };
  return json.data;
}

export function KunjunganPelayananView({
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
  const [kategori, setKategori] = useState<Filter>("Semua");
  const [searchInput, setSearchInput] = useState("");
  const [page, setPage] = useState(1);
  const search = useDebounce(searchInput, 350);

  // `to` inklusif untuk user → eksklusif untuk API (tambah 1 hari).
  const toExclusive = useMemo(
    () => toLocalDateInput(addDays(new Date(`${to}T00:00:00`), 1)),
    [to],
  );

  // Reset halaman saat filter berubah (pola render-phase).
  const filterKey = `${from}|${toExclusive}|${ruanganId}|${kategori}|${search}`;
  const [prevKey, setPrevKey] = useState(filterKey);
  if (prevKey !== filterKey) {
    setPrevKey(filterKey);
    setPage(1);
  }

  const { result, loading, error, reload } = useAsyncData<KunjunganPelayananResult>(
    () => fetchKunjungan({ from, toExclusive, ruanganId, kategori, search, page }),
    [from, toExclusive, ruanganId, kategori, search, page],
  );

  const summary = result?.summary ?? null;
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
        <StatCard label="Total Kunjungan" value={summary?.total ?? 0} icon={Users} tone="brand" loading={loading} />
        <StatCard label="Sudah Final" value={summary?.final ?? 0} icon={CheckCircle2} tone="success" loading={loading} />
        <StatCard label="Belum Final" value={summary?.belumFinal ?? 0} icon={TriangleAlert} tone="danger" loading={loading} />
      </div>

      {/* Filter */}
      <Card className="p-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <Label htmlFor="from">Dari tanggal</Label>
            <Input id="from" type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="to">Sampai tanggal</Label>
            <Input id="to" type="date" value={to} max={today} min={from} onChange={(e) => setTo(e.target.value)} />
          </div>
          <div>
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
        </div>

        {rangeInvalid && (
          <p className="mt-2 text-xs text-danger">Tanggal awal melebihi tanggal akhir.</p>
        )}

        {/* Tab kategori */}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {(["Semua", ...KATEGORI] as Filter[]).map((k) => {
            const active = kategori === k;
            return (
              <button
                key={k}
                type="button"
                onClick={() => setKategori(k)}
                className={cn(
                  "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[13px] font-medium transition-colors",
                  active
                    ? "border-brand bg-brand-soft text-brand-soft-fg"
                    : "border-border bg-surface text-fg-muted hover:bg-surface-2 hover:text-fg",
                )}
              >
                {k}
                <span
                  className={cn(
                    "rounded-full px-1.5 text-[11px] tabular-nums",
                    active ? "bg-brand/15 text-brand-soft-fg" : "bg-surface-2 text-fg-subtle",
                  )}
                >
                  {counts ? counts[k] : "—"}
                </span>
              </button>
            );
          })}
        </div>
      </Card>

      {/* Daftar kartu */}
      <Card className="overflow-hidden">
        <CardHeader
          title="Daftar Kunjungan"
          subtitle={
            !loading && meta
              ? `${meta.total} kunjungan · rentang ${formatDate(from)} – ${formatDate(to)}`
              : undefined
          }
          action={
            <div className="flex items-center gap-1.5 rounded-md bg-surface-2 px-2.5 py-1 text-xs text-fg-muted">
              <Clock className="size-3.5" />
              Rata-rata lama rawat (final):{" "}
              <span className="font-medium text-fg tabular">{formatLama(summary?.rataLamaMenit)}</span>
            </div>
          }
        />

        <div className="p-4">
          {loading ? (
            <CardGridSkeleton />
          ) : error ? (
            <ErrorState onRetry={reload} />
          ) : items.length === 0 ? (
            <EmptyState title="Tidak ada kunjungan" description="Tidak ada data untuk rentang / filter ini." />
          ) : (
            <AnimatePresence mode="wait">
              <motion.div
                key={`${page}|${kategori}|${search}`}
                variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.035 } } }}
                initial="hidden"
                animate="visible"
                className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3"
              >
                {items.map((it) => (
                  <KunjunganCard key={it.nomor} item={it} />
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

function KunjunganCard({ item }: { item: KunjunganPelayananItem }) {
  const final = item.final;
  return (
    <motion.div
      variants={cardVariants}
      className={cn(
        "flex flex-col rounded-[var(--radius-lg)] border p-4 shadow-xs transition-colors",
        final
          ? "border-success/40 bg-success-soft hover:border-success/60"
          : "border-danger/40 bg-danger-soft hover:border-danger/60",
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
          value={
            <>
              Masuk {formatDateTime(item.masuk)}
              {final ? (
                <> · Keluar {formatDateTime(item.keluar!)}</>
              ) : (
                <span className="font-medium text-danger"> · belum keluar</span>
              )}
            </>
          }
        />
      </div>

      <div className="mt-4 flex items-center justify-between gap-2 border-t border-border/70 pt-3">
        <div className="flex items-baseline gap-1.5">
          <span className="text-xs text-fg-muted">Lama rawat</span>
          <span className={cn("text-sm font-semibold tabular", final ? "text-fg" : "text-danger")}>
            {formatLama(item.lamaMenit)}
          </span>
        </div>
        {final ? (
          <Badge tone="success" dot>
            Final
          </Badge>
        ) : (
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-danger">
            <TriangleAlert className="size-3.5" />
            berjalan
          </span>
        )}
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
          </div>
          <div className="mt-4 flex items-center justify-between border-t border-border/70 pt-3">
            <Skeleton className="h-4 w-24 rounded" />
            <Skeleton className="h-5 w-14 rounded-full" />
          </div>
        </div>
      ))}
    </div>
  );
}

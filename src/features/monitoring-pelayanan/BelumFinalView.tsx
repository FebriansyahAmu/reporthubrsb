"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion, type Variants } from "framer-motion";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  Clock,
  DoorOpen,
  Hourglass,
  Layers,
  RefreshCw,
  Search,
  TriangleAlert,
} from "lucide-react";
import { Card, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { InputWithIcon, Label } from "@/components/ui/Field";
import { StatCard } from "@/components/ui/StatCard";
import { Skeleton } from "@/components/ui/Skeleton";
import { Pagination } from "@/components/ui/Pagination";
import { EmptyState, ErrorState } from "@/components/feedback/States";
import { cn } from "@/lib/cn";
import { useDebounce } from "@/lib/useDebounce";
import { useAsyncData } from "@/lib/useAsyncData";
import { formatDateTime, formatJam, formatLama } from "@/lib/format";
import {
  AGING_BUCKETS,
  type AgingBucket,
  type BelumFinalItem,
  type BelumFinalResult,
  type KategoriKunjungan,
  type TurunanLayananItem,
} from "@/server/modules/pelayanan/pelayanan.types";
import type { RuanganOption } from "@/server/modules/kunjungan/kunjungan.types";

const KATEGORI: KategoriKunjungan[] = ["Rawat Inap", "Rawat Jalan Klinik", "IGD"];
const PAGE_SIZE = 12;

const BUCKET_META: Record<AgingBucket, { label: string; tone: "warning" | "danger" }> =
  Object.fromEntries(AGING_BUCKETS.map((b) => [b.key, { label: b.label, tone: b.tone }])) as Record<
    AgingBucket,
    { label: string; tone: "warning" | "danger" }
  >;

type BucketFilter = "Semua" | AgingBucket;

async function fetchBelumFinal(args: {
  ruanganId: string;
  kategori: "Semua" | KategoriKunjungan;
  bucket: BucketFilter;
  search: string;
  page: number;
}): Promise<BelumFinalResult> {
  const p = new URLSearchParams({ page: String(args.page), pageSize: String(PAGE_SIZE) });
  if (args.ruanganId) p.set("ruangan", args.ruanganId);
  if (args.kategori !== "Semua") p.set("kategori", args.kategori);
  if (args.bucket !== "Semua") p.set("bucket", args.bucket);
  if (args.search) p.set("search", args.search);
  const res = await fetch(`/api/monitoring/pelayanan/belum-final?${p.toString()}`);
  if (!res.ok) throw new Error("Gagal memuat data");
  const json = (await res.json()) as { data: BelumFinalResult };
  return json.data;
}

export function BelumFinalView({ ruanganOptions }: { ruanganOptions: RuanganOption[] }) {
  const [ruanganId, setRuanganId] = useState("");
  const [kategori, setKategori] = useState<"Semua" | KategoriKunjungan>("Semua");
  const [bucket, setBucket] = useState<BucketFilter>("Semua");
  const [searchInput, setSearchInput] = useState("");
  const [page, setPage] = useState(1);
  const search = useDebounce(searchInput, 350);

  const filterKey = `${ruanganId}|${kategori}|${bucket}|${search}`;
  const [prevKey, setPrevKey] = useState(filterKey);
  if (prevKey !== filterKey) {
    setPrevKey(filterKey);
    setPage(1);
  }

  const { result, loading, error, reload } = useAsyncData<BelumFinalResult>(
    () => fetchBelumFinal({ ruanganId, kategori, bucket, search, page }),
    [ruanganId, kategori, bucket, search, page],
  );

  const counts = result?.counts ?? null;
  const meta = result?.meta ?? null;
  const updatedAt = result?.updatedAt ?? null;
  const items = result?.data ?? [];

  const ruanganByKategori = useMemo(() => {
    const g: Record<KategoriKunjungan, RuanganOption[]> = {
      "Rawat Inap": [],
      "Rawat Jalan Klinik": [],
      IGD: [],
    };
    for (const r of ruanganOptions) g[r.kategori]?.push(r);
    return g;
  }, [ruanganOptions]);

  const bucketTabs: { key: BucketFilter; label: string }[] = [
    { key: "Semua", label: "Semua" },
    ...AGING_BUCKETS.map((b) => ({ key: b.key as BucketFilter, label: b.label })),
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
        <StatCard label="Belum Difinalkan" value={counts?.Semua ?? 0} icon={Hourglass} tone="danger" loading={loading} />
        <StatCard label="Terbuka 2–7 hari" value={counts?.b3 ?? 0} icon={AlertTriangle} tone="accent" loading={loading} />
        <StatCard label="Terbuka > 7 hari" value={counts?.b4 ?? 0} icon={TriangleAlert} tone="danger" loading={loading} />
      </div>

      {/* Filter */}
      <Card className="p-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
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

        {/* Tab bucket umur tunggakan */}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {bucketTabs.map((t) => {
            const active = bucket === t.key;
            const jumlah = counts ? counts[t.key] : undefined;
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => setBucket(t.key)}
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
          title="Kunjungan Belum Difinalkan"
          subtitle={
            !loading && meta ? `${meta.total} kunjungan · diurut paling lama terbuka` : undefined
          }
        />
        <div className="p-4">
          {loading ? (
            <CardGridSkeleton />
          ) : error ? (
            <ErrorState onRetry={reload} />
          ) : items.length === 0 ? (
            <EmptyState
              title="Tidak ada tunggakan"
              description="Semua kunjungan pada filter ini sudah difinalkan. 🎉"
            />
          ) : (
            <AnimatePresence mode="wait">
              <motion.div
                key={`${page}|${bucket}|${kategori}|${search}`}
                variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.035 } } }}
                initial="hidden"
                animate="visible"
                className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3"
              >
                {items.map((it) => (
                  <BelumFinalCard key={it.nomor} item={it} />
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

const KATEGORI_TONE: Record<KategoriKunjungan, "brand" | "accent" | "warning"> = {
  "Rawat Inap": "brand",
  "Rawat Jalan Klinik": "accent",
  IGD: "warning",
};

function BelumFinalCard({ item }: { item: BelumFinalItem }) {
  const meta = BUCKET_META[item.bucket];
  return (
    <motion.div
      variants={cardVariants}
      className="flex flex-col rounded-[var(--radius-lg)] border border-danger/40 bg-danger-soft p-4 shadow-xs transition-colors hover:border-danger/60"
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
              <span className="font-medium text-danger"> · belum keluar</span>
            </>
          }
        />
      </div>

      {item.turunan.length > 0 ? (
        <TurunanCollapse turunan={item.turunan} />
      ) : (
        <p className="mt-3 text-xs text-fg-subtle">Tidak ada layanan turunan.</p>
      )}

      <div className="mt-4 flex items-center justify-between gap-2 border-t border-border/70 pt-3">
        <div className="flex items-baseline gap-1.5">
          <span className="text-xs text-fg-muted">Sudah terbuka</span>
          <span className="text-sm font-semibold text-danger tabular">{formatLama(item.lamaMenit)}</span>
        </div>
        <Badge tone={meta.tone} dot>
          {meta.label}
        </Badge>
      </div>
    </motion.div>
  );
}

/**
 * Rincian turunan layanan (leg lain di NOPEN yang sama) dalam collapse.
 * Header HIJAU bila semua leg sudah final, KUNING bila ada yang belum final.
 */
function TurunanCollapse({ turunan }: { turunan: TurunanLayananItem[] }) {
  const [open, setOpen] = useState(false);
  const belum = turunan.filter((t) => !t.final).length;
  const allFinal = belum === 0;

  return (
    <div
      className={cn(
        "mt-3 overflow-hidden rounded-[var(--radius-md)] border",
        allFinal ? "border-success/40 bg-success-soft" : "border-warning/50 bg-warning-soft",
      )}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left"
      >
        <span className="flex min-w-0 items-center gap-1.5 text-[13px] font-medium text-fg">
          <Layers className="size-3.5 shrink-0 text-fg-subtle" />
          {turunan.length} layanan turunan
          <span className={cn("truncate text-xs font-normal", allFinal ? "text-success" : "text-warning")}>
            · {allFinal ? "semua final" : `${belum} belum final`}
          </span>
        </span>
        <ChevronDown
          className={cn("size-4 shrink-0 text-fg-subtle transition-transform", open && "rotate-180")}
        />
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden"
          >
            <ul className="space-y-1.5 border-t border-border/50 px-3 py-2">
              {turunan.map((t) => (
                <li key={t.nomor} className="flex items-center justify-between gap-2 text-xs">
                  <span className="flex min-w-0 items-center gap-1.5">
                    {t.final ? (
                      <CheckCircle2 className="size-3.5 shrink-0 text-success" />
                    ) : (
                      <Clock className="size-3.5 shrink-0 text-warning" />
                    )}
                    <span className="truncate text-fg">{t.ruang}</span>
                    <span className="shrink-0 rounded bg-surface-2 px-1.5 py-0.5 text-[10px] font-medium text-fg-muted">
                      {t.jenisLabel}
                    </span>
                  </span>
                  <span className="shrink-0 tabular text-fg-muted">
                    {t.final ? formatDateTime(t.keluar as string) : "belum"}
                  </span>
                </li>
              ))}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
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

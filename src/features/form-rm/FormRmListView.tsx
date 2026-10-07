"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion, type Variants } from "framer-motion";
import {
  ArrowRight,
  Check,
  CheckCircle2,
  ClipboardCheck,
  ClipboardList,
  Clock,
  DoorOpen,
  PencilLine,
  RefreshCw,
  Search,
  Users,
} from "lucide-react";
import { Card, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { InputWithIcon, Label } from "@/components/ui/Field";
import { DatePicker } from "@/components/ui/DatePicker";
import { Select, type SelectOption } from "@/components/ui/Select";
import { StatCard } from "@/components/ui/StatCard";
import { Skeleton } from "@/components/ui/Skeleton";
import { Pagination } from "@/components/ui/Pagination";
import { EmptyState, ErrorState } from "@/components/feedback/States";
import { cn } from "@/lib/cn";
import { useDebounce } from "@/lib/useDebounce";
import { useAsyncData } from "@/lib/useAsyncData";
import { apiGet } from "@/lib/api-client";
import { addDays, formatDate, formatDateTime, formatJam, toLocalDateInput } from "@/lib/format";
import type { JenisKunjungan } from "@/features/form-rm/registry";
import { TAMPILAN_FORM } from "@/features/form-rm/tampilan";
import type {
  FormRmKelengkapan,
  FormRmListResult,
  FormRmPatient,
  StatusFormPasien,
} from "@/server/modules/form-rm/form-rm.types";

const LABEL_JENIS: Record<JenisKunjungan, string> = { 1: "Rawat Jalan", 2: "IGD", 3: "Rawat Inap" };
const NADA_JENIS: Record<JenisKunjungan, "neutral" | "warning" | "brand"> = { 1: "neutral", 2: "warning", 3: "brand" };

/** Opsi ruangan + jenis kunjungannya (untuk menyaring ruangan per jenis). */
export type RuanganJenis = { id: string; nama: string; jenis: JenisKunjungan };

function fetchList(args: {
  from: string;
  toExclusive: string;
  jenis: JenisKunjungan | 0;
  ruanganId: string;
  search: string;
  page: number;
}): Promise<FormRmListResult> {
  const p = new URLSearchParams({ from: args.from, to: args.toExclusive, page: String(args.page) });
  if (args.jenis) p.set("jenis", String(args.jenis));
  if (args.ruanganId) p.set("ruangan", args.ruanganId);
  if (args.search) p.set("search", args.search);
  return apiGet<FormRmListResult>(`/api/form-rm/list?${p.toString()}`);
}

/**
 * Daftar per pasien (alur pasien lebih dulu, PRD §6.2): episode sasaran form
 * yang boleh dilihat, masuk dalam rentang, dengan kelengkapan form wajibnya.
 */
export function FormRmListView({
  ruanganOptions,
  jenisOptions,
  nowIso,
}: {
  ruanganOptions: RuanganJenis[];
  /** Jenis kunjungan sasaran form yang boleh dilihat (mis. IGD & Rawat Inap). */
  jenisOptions: JenisKunjungan[];
  nowIso: string;
}) {
  const today = useMemo(() => toLocalDateInput(new Date(nowIso)), [nowIso]);
  const weekAgo = useMemo(() => toLocalDateInput(addDays(new Date(nowIso), -6)), [nowIso]);

  const [from, setFrom] = useState(weekAgo);
  const [to, setTo] = useState(today);
  const [jenis, setJenis] = useState<JenisKunjungan | 0>(0);
  const [ruanganId, setRuanganId] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [page, setPage] = useState(1);
  const search = useDebounce(searchInput, 350);

  const toExclusive = useMemo(
    () => toLocalDateInput(addDays(new Date(`${to}T00:00:00`), 1)),
    [to],
  );

  const filterKey = `${from}|${toExclusive}|${jenis}|${ruanganId}|${search}`;
  const [prevKey, setPrevKey] = useState(filterKey);
  if (prevKey !== filterKey) {
    setPrevKey(filterKey);
    setPage(1);
  }

  const { result, loading, error, reload } = useAsyncData<FormRmListResult>(
    () => fetchList({ from, toExclusive, jenis, ruanganId, search, page }),
    [from, toExclusive, jenis, ruanganId, search, page],
  );

  const meta = result?.meta ?? null;
  const updatedAt = result?.updatedAt ?? null;
  const items = result?.data ?? [];
  const rangeInvalid = from > to;

  const pilihJenis = (j: JenisKunjungan | 0) => {
    setJenis(j);
    // Ruangan terpilih harus milik jenis yang dipilih.
    if (j && ruanganOptions.find((r) => r.id === ruanganId)?.jenis !== j) setRuanganId("");
  };

  const ruanganSelectOptions = useMemo<SelectOption[]>(
    () => [
      { value: "", label: "Semua ruangan" },
      ...ruanganOptions.filter((r) => !jenis || r.jenis === jenis).map((r) => ({ value: r.id, label: r.nama })),
    ],
    [ruanganOptions, jenis],
  );

  return (
    <div className="space-y-5">
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

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Pasien" value={meta?.total ?? 0} icon={Users} tone="accent" loading={loading} />
        <StatCard
          label="RM Lengkap (Final)"
          value={result?.lengkapCount ?? 0}
          icon={ClipboardCheck}
          tone="success"
          loading={loading}
        />
        <StatCard
          label="Belum Lengkap"
          value={result?.belumLengkapCount ?? 0}
          icon={ClipboardList}
          tone="warning"
          loading={loading}
        />
      </div>

      <Card className="p-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <Label htmlFor="from">Dari tanggal</Label>
            <DatePicker id="from" value={from} max={to} clearable={false} onChange={setFrom} />
          </div>
          <div>
            <Label htmlFor="to">Sampai tanggal</Label>
            <DatePicker id="to" value={to} min={from} max={today} clearable={false} onChange={setTo} />
          </div>
          <div>
            <Label htmlFor="cari">Cari</Label>
            <InputWithIcon
              id="cari"
              icon={<Search className="size-4" />}
              placeholder="Nama / No. RM / NOPEN / ruang"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
            />
          </div>
          {jenisOptions.length > 1 && (
            <div>
              <span className="mb-1.5 block text-sm font-medium text-fg">Jenis kunjungan</span>
              <div role="group" aria-label="Jenis kunjungan" className="flex flex-wrap gap-1.5">
                {([0, ...jenisOptions] as const).map((j) => (
                  <button
                    key={j}
                    type="button"
                    aria-pressed={jenis === j}
                    onClick={() => pilihJenis(j)}
                    className={cn(
                      "inline-flex min-h-10 items-center rounded-full border px-3.5 text-[13px] font-medium transition-colors",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring",
                      jenis === j
                        ? "border-brand bg-brand-soft text-brand-soft-fg"
                        : "border-border bg-surface text-fg-muted hover:bg-surface-2 hover:text-fg",
                    )}
                  >
                    {j === 0 ? "Semua" : LABEL_JENIS[j]}
                  </button>
                ))}
              </div>
            </div>
          )}
          {ruanganOptions.length > 0 && (
            <div className={jenisOptions.length > 1 ? "lg:col-span-2" : "lg:col-span-3"}>
              <Label htmlFor="ruangan">Ruangan</Label>
              <Select
                id="ruangan"
                value={ruanganId}
                onChange={setRuanganId}
                options={ruanganSelectOptions}
                placeholder="Semua ruangan"
              />
            </div>
          )}
        </div>
        {rangeInvalid && (
          <p className="mt-2 text-xs text-danger">Tanggal awal melebihi tanggal akhir.</p>
        )}
      </Card>

      <Card className="overflow-hidden">
        <CardHeader
          title="Pasien"
          subtitle={
            !loading && meta
              ? `${meta.total} episode · masuk ${formatDate(from)} – ${formatDate(to)}`
              : undefined
          }
        />
        <div className="p-4">
          {loading ? (
            <CardGridSkeleton />
          ) : error ? (
            <ErrorState onRetry={reload} />
          ) : items.length === 0 ? (
            <EmptyState title="Tidak ada pasien" description="Tidak ada kunjungan untuk filter ini." />
          ) : (
            <AnimatePresence mode="wait">
              <motion.div
                key={`${page}|${search}`}
                variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.035 } } }}
                initial="hidden"
                animate="visible"
                className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3"
              >
                {items.map((it) => (
                  <PatientCard key={it.nopen} item={it} />
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

function PatientCard({ item }: { item: FormRmPatient }) {
  const href = `/form-rm/pasien/${item.nopen}`;
  return (
    <motion.div
      variants={cardVariants}
      className="flex flex-col rounded-[var(--radius-lg)] border border-border bg-surface p-4 shadow-xs transition-colors hover:border-brand/50"
    >
      <Link
        href={href}
        prefetch={false}
        className="block rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring"
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate font-semibold text-fg">{item.nama}</p>
            <p className="font-mono text-xs text-fg-muted">
              {item.norm} · {item.jenisKelamin}
              {item.umur ? ` · ${item.umur}` : ""}
            </p>
          </div>
          <Badge tone={item.dirawat ? "success" : "neutral"} dot>
            {item.dirawat ? "Dilayani" : "Keluar"}
          </Badge>
        </div>
        <div className="mt-3 space-y-1.5 text-[13px]">
          <div className="flex items-start gap-2 text-fg-muted">
            <DoorOpen className="mt-0.5 size-3.5 shrink-0 text-fg-subtle" />
            <span className="min-w-0 text-fg">
              <Badge tone={NADA_JENIS[item.jenis]} className="mr-1.5 align-middle">
                {LABEL_JENIS[item.jenis]}
              </Badge>
              {item.ruang}
            </span>
          </div>
          <div className="flex items-start gap-2 text-fg-muted">
            <Clock className="mt-0.5 size-3.5 shrink-0 text-fg-subtle" />
            <span className="min-w-0 text-fg">Masuk {formatDateTime(item.masuk)}</span>
          </div>
        </div>
      </Link>

      {/* Penanda kelengkapan form RM */}
      <div className="mt-3 border-t border-border/60 pt-3">
        <div className="mb-2 flex items-center justify-between gap-2">
          <span className="text-xs font-medium text-fg-muted">Kelengkapan RM</span>
          <KelengkapanBadge k={item.kelengkapan} />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {item.kelengkapan.formulir.map((f) => (
            <FormChip key={f.kode} kode={f.kode} nama={TAMPILAN_FORM[f.kode].singkat} status={f.status} wajib={f.wajib} />
          ))}
        </div>
      </div>

      <Link
        href={href}
        prefetch={false}
        className="mt-4 inline-flex min-h-10 items-center justify-center gap-1.5 rounded-[var(--radius-md)] border border-brand bg-brand-soft px-3 py-2 text-sm font-medium text-brand-soft-fg transition-colors hover:bg-brand/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring"
      >
        {item.kelengkapan.lengkap ? "Lihat Form RM" : "Isi Form RM"}
        <ArrowRight className="size-4" />
      </Link>
    </motion.div>
  );
}

/** Ringkasan kelengkapan form WAJIB (teks + warna + ikon — tak hanya warna). */
function KelengkapanBadge({ k }: { k: FormRmKelengkapan }) {
  if (k.total === 0) return <Badge tone="neutral">Tidak ada form wajib</Badge>;
  if (k.lengkap) {
    return (
      <Badge tone="success">
        <CheckCircle2 className="size-3.5" /> Lengkap
      </Badge>
    );
  }
  if (k.terisi === 0) return <Badge tone="danger">Belum diisi</Badge>;
  return (
    <Badge tone="warning">
      {k.final}/{k.total} final
    </Badge>
  );
}

const CHIP: Record<StatusFormPasien, { kelas: string; teks: string }> = {
  FINAL: { kelas: "border-success/30 bg-success-soft text-success", teks: "final" },
  DRAF: { kelas: "border-warning/40 bg-warning-soft text-warning", teks: "draf" },
  KOSONG: { kelas: "border-dashed border-border bg-surface-2/60 text-fg-subtle", teks: "belum diisi" },
};

/** Chip satu form: final (centang) / draf (pensil) / belum (garis putus); form tak wajib dipudarkan. */
function FormChip({ kode, nama, status, wajib }: { kode: string; nama: string; status: StatusFormPasien; wajib: boolean }) {
  return (
    <span
      title={`${kode} · ${nama} — ${CHIP[status].teks}${wajib ? "" : " (tidak wajib untuk episode ini)"}`}
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium",
        CHIP[status].kelas,
        !wajib && "opacity-60",
      )}
    >
      {status === "FINAL" ? (
        <Check className="size-3" />
      ) : status === "DRAF" ? (
        <PencilLine className="size-3" />
      ) : (
        <span className="size-1.5 rounded-full bg-fg-subtle/50" aria-hidden />
      )}
      {kode}
      {!wajib && <span className="sr-only">(tidak wajib)</span>}
    </span>
  );
}

function CardGridSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="flex flex-col rounded-[var(--radius-lg)] border border-border bg-surface p-4">
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
          <Skeleton className="mt-4 h-9 w-full rounded-[var(--radius-md)]" />
        </div>
      ))}
    </div>
  );
}

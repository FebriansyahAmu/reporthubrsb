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
  RefreshCw,
  Search,
  Siren,
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
import { addDays, formatDate, formatDateTime, formatJam, toLocalDateInput } from "@/lib/format";
import type {
  FormRmKelengkapan,
  FormRmListResult,
  FormRmPatient,
} from "@/server/modules/form-rm/form-rm.types";
import type { RuanganOption } from "@/server/modules/kunjungan/kunjungan.types";

async function fetchList(args: {
  from: string;
  toExclusive: string;
  ruanganId: string;
  search: string;
  page: number;
}): Promise<FormRmListResult> {
  const p = new URLSearchParams({ from: args.from, to: args.toExclusive, page: String(args.page) });
  if (args.ruanganId) p.set("ruangan", args.ruanganId);
  if (args.search) p.set("search", args.search);
  const res = await fetch(`/api/form-rm/list?${p.toString()}`);
  if (!res.ok) throw new Error("Gagal memuat data");
  const json = (await res.json()) as { data: FormRmListResult };
  return json.data;
}

export function FormRmListView({
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
  const [searchInput, setSearchInput] = useState("");
  const [page, setPage] = useState(1);
  const search = useDebounce(searchInput, 350);

  const toExclusive = useMemo(
    () => toLocalDateInput(addDays(new Date(`${to}T00:00:00`), 1)),
    [to],
  );

  const filterKey = `${from}|${toExclusive}|${ruanganId}|${search}`;
  const [prevKey, setPrevKey] = useState(filterKey);
  if (prevKey !== filterKey) {
    setPrevKey(filterKey);
    setPage(1);
  }

  const { result, loading, error, reload } = useAsyncData<FormRmListResult>(
    () => fetchList({ from, toExclusive, ruanganId, search, page }),
    [from, toExclusive, ruanganId, search, page],
  );

  const meta = result?.meta ?? null;
  const updatedAt = result?.updatedAt ?? null;
  const items = result?.data ?? [];
  const rangeInvalid = from > to;
  const lengkapCount = result?.lengkapCount ?? 0;
  const belumLengkap = Math.max(0, (meta?.total ?? 0) - lengkapCount);

  // Opsi ruangan IGD (datar) untuk <Select>: "Semua ruangan IGD" + daftar ruangan.
  const ruanganSelectOptions = useMemo<SelectOption[]>(
    () => [
      { value: "", label: "Semua ruangan IGD" },
      ...ruanganOptions.map((r) => ({ value: r.id, label: r.nama })),
    ],
    [ruanganOptions],
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
        <StatCard
          label="Pasien IGD"
          value={meta?.total ?? 0}
          icon={Siren}
          tone="accent"
          loading={loading}
        />
        <StatCard
          label="RM Lengkap"
          value={lengkapCount}
          icon={ClipboardCheck}
          tone="success"
          loading={loading}
        />
        <StatCard
          label="Belum Lengkap"
          value={belumLengkap}
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
              placeholder="Nama / No. RM / ruang"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
            />
          </div>
          {ruanganOptions.length > 0 && (
            <div className="lg:col-span-3">
              <Label htmlFor="ruangan">Ruangan IGD</Label>
              <Select
                id="ruangan"
                value={ruanganId}
                onChange={setRuanganId}
                options={ruanganSelectOptions}
                placeholder="Semua ruangan IGD"
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
          title="Pasien IGD"
          subtitle={
            !loading && meta
              ? `${meta.total} pasien · rentang ${formatDate(from)} – ${formatDate(to)}`
              : undefined
          }
        />
        <div className="p-4">
          {loading ? (
            <CardGridSkeleton />
          ) : error ? (
            <ErrorState onRetry={reload} />
          ) : items.length === 0 ? (
            <EmptyState title="Tidak ada pasien IGD" description="Tidak ada kunjungan IGD untuk filter ini." />
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
                  <PatientCard key={it.nomor} item={it} />
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
  const href = `/form-rm/${item.nopen}`;
  const berjalan = item.keluar == null;
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
          <Badge tone={berjalan ? "warning" : "brand"} dot>
            {berjalan ? "Dirawat" : "Selesai"}
          </Badge>
        </div>
        <div className="mt-3 space-y-1.5 text-[13px]">
          <div className="flex items-start gap-2 text-fg-muted">
            <DoorOpen className="mt-0.5 size-3.5 shrink-0 text-fg-subtle" />
            <span className="min-w-0 text-fg">{item.ruang}</span>
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
          <FormChip kode="RM.01" nama="Ringkasan" filled={item.kelengkapan.ringkasan} />
          <FormChip kode="RM.21" nama="Edukasi" filled={item.kelengkapan.edukasi} />
          <FormChip kode="RM.03" nama="Consent" filled={item.kelengkapan.consent} />
        </div>
      </div>

      <Link
        href={href}
        prefetch={false}
        className="mt-4 inline-flex items-center justify-center gap-1.5 rounded-[var(--radius-md)] border border-brand bg-brand-soft px-3 py-2 text-sm font-medium text-brand-soft-fg transition-colors hover:bg-brand/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring"
      >
        {item.kelengkapan.lengkap ? "Lihat Form RM" : "Isi Form RM"}
        <ArrowRight className="size-4" />
      </Link>
    </motion.div>
  );
}

/** Ringkasan status kelengkapan RM (teks + warna + ikon — tak hanya warna). */
function KelengkapanBadge({ k }: { k: FormRmKelengkapan }) {
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
      {k.terisi}/{k.total} terisi
    </Badge>
  );
}

/** Chip satu form RM: terisi (hijau + centang) vs belum (garis putus, redup). */
function FormChip({ kode, nama, filled }: { kode: string; nama: string; filled: boolean }) {
  return (
    <span
      title={`${kode} · ${nama} — ${filled ? "terisi" : "belum diisi"}`}
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium",
        filled
          ? "border-success/30 bg-success-soft text-success"
          : "border-dashed border-border bg-surface-2/60 text-fg-subtle",
      )}
    >
      {filled ? (
        <Check className="size-3" />
      ) : (
        <span className="size-1.5 rounded-full bg-fg-subtle/50" aria-hidden />
      )}
      {kode}
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

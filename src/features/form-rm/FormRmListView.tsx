"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion, type Variants } from "framer-motion";
import { ArrowRight, Clock, DoorOpen, RefreshCw, Search, Siren } from "lucide-react";
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
import type { FormRmListResult, FormRmPatient } from "@/server/modules/form-rm/form-rm.types";
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
      </div>

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
          {ruanganOptions.length > 0 && (
            <div className="lg:col-span-3">
              <Label htmlFor="ruangan">Ruangan IGD</Label>
              <select
                id="ruangan"
                value={ruanganId}
                onChange={(e) => setRuanganId(e.target.value)}
                className="h-10 w-full rounded-[var(--radius-md)] border border-border bg-surface px-3 text-sm text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring"
              >
                <option value="">Semua ruangan IGD</option>
                {ruanganOptions.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.nama}
                  </option>
                ))}
              </select>
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
      <Link
        href={href}
        className="mt-4 inline-flex items-center justify-center gap-1.5 rounded-[var(--radius-md)] border border-brand bg-brand-soft px-3 py-2 text-sm font-medium text-brand-soft-fg transition-colors hover:bg-brand/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring"
      >
        Isi Form RM
        <ArrowRight className="size-4" />
      </Link>
    </motion.div>
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

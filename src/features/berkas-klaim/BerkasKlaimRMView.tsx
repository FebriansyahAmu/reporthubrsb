"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion, type Variants } from "framer-motion";
import {
  ArrowRight,
  Clock,
  DoorOpen,
  Filter,
  FolderCheck,
  History,
  Hospital,
  RefreshCw,
  RotateCcw,
  Search,
  X,
} from "lucide-react";
import { Card, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { InputWithIcon, Label } from "@/components/ui/Field";
import { DatePicker } from "@/components/ui/DatePicker";
import { Select, type SelectGroup } from "@/components/ui/Select";
import { StatCard } from "@/components/ui/StatCard";
import { Skeleton } from "@/components/ui/Skeleton";
import { Pagination } from "@/components/ui/Pagination";
import { EmptyState, ErrorState } from "@/components/feedback/States";
import { TurunanCollapse } from "@/components/report/TurunanCollapse";
import { cn } from "@/lib/cn";
import { useDebounce } from "@/lib/useDebounce";
import { useAsyncData } from "@/lib/useAsyncData";
import { addDays, formatDate, formatDateTime, formatJam, toLocalDateInput } from "@/lib/format";
import type {
  BerkasKlaimItem,
  BerkasKlaimResult,
  KategoriKunjungan,
} from "@/server/modules/berkas-klaim/berkas-klaim.types";
import type { RuanganOption } from "@/server/modules/kunjungan/kunjungan.types";
import {
  CARI_MAKS,
  COOKIE_FILTER_RM,
  filterAktif,
  filterBawaan,
  keQueryRm,
  PATH_FILTER_RM,
  UMUR_FILTER_RM_DETIK,
  type FilterAktif,
  type FilterRm,
  type KategoriFilter,
} from "./filter-rm";

const KATEGORI: KategoriKunjungan[] = ["Rawat Inap", "Rawat Jalan Klinik", "IGD"];
const PAGE_SIZE = 12;
/** Sorotan kolom filter yang berbeda dari bawaan. */
const SOROT = "rounded-[var(--radius-md)] ring-2 ring-brand/40 ring-offset-2 ring-offset-surface";

const KATEGORI_TONE: Record<KategoriKunjungan, "brand" | "accent" | "warning"> = {
  "Rawat Inap": "brand",
  "Rawat Jalan Klinik": "accent",
  IGD: "warning",
};

async function fetchBerkas(args: {
  from: string;
  toExclusive: string;
  ruanganId: string;
  kategori: KategoriFilter;
  search: string;
  page: number;
}): Promise<BerkasKlaimResult> {
  const p = new URLSearchParams({
    from: args.from,
    to: args.toExclusive,
    page: String(args.page),
    pageSize: String(PAGE_SIZE),
  });
  if (args.ruanganId) p.set("ruangan", args.ruanganId);
  if (args.kategori !== "Semua") p.set("kategori", args.kategori);
  if (args.search) p.set("search", args.search);
  const res = await fetch(`/api/berkas-klaim/rm?${p.toString()}`);
  if (!res.ok) throw new Error("Gagal memuat data");
  const json = (await res.json()) as { data: BerkasKlaimResult };
  return json.data;
}

export function BerkasKlaimRMView({
  ruanganOptions,
  hariIni,
  awal,
  dipulihkan,
}: {
  ruanganOptions: RuanganOption[];
  /** Hari ini WITA `YYYY-MM-DD` (dari server). */
  hariIni: string;
  /** Filter awal: dari URL, atau dipulihkan dari cookie sesi (lihat filter-rm.ts). */
  awal: FilterRm;
  /** True bila `awal` dipulihkan dari filter terakhir (URL tanpa parameter). */
  dipulihkan: boolean;
}) {
  const today = hariIni;

  const [from, setFrom] = useState(awal.from);
  const [to, setTo] = useState(awal.to);
  const [ruanganId, setRuanganId] = useState(awal.ruangan);
  const [kategori, setKategori] = useState<KategoriFilter>(awal.kategori);
  const [searchInput, setSearchInput] = useState(awal.q);
  const [page, setPage] = useState(awal.page);
  const search = useDebounce(searchInput, 350);

  // Simpan filter ke URL (Back browser memulihkannya) + cookie sesi (tautan
  // "Kembali ke daftar" / menu samping memulihkannya lewat server).
  const filterSaatIni = useMemo<FilterRm>(
    () => ({ from, to, ruangan: ruanganId, kategori, q: search, page }),
    [from, to, ruanganId, kategori, search, page],
  );
  useEffect(() => {
    const qs = keQueryRm(filterSaatIni);
    if (window.location.search !== `?${qs}`) window.history.replaceState(null, "", `?${qs}`);
    const aman = window.location.protocol === "https:" ? "; Secure" : "";
    document.cookie = `${COOKIE_FILTER_RM}=${encodeURIComponent(qs)}; Path=${PATH_FILTER_RM}; Max-Age=${UMUR_FILTER_RM_DETIK}; SameSite=Strict${aman}`;
  }, [filterSaatIni]);

  const aktif = filterAktif({ ...filterSaatIni, q: searchInput }, hariIni);
  const sorot = (k: FilterAktif) => aktif.includes(k);
  function aturUlang() {
    const b = filterBawaan(hariIni);
    setFrom(b.from);
    setTo(b.to);
    setRuanganId("");
    setKategori("Semua");
    setSearchInput("");
  }

  const toExclusive = useMemo(
    () => toLocalDateInput(addDays(new Date(`${to}T00:00:00`), 1)),
    [to],
  );

  const filterKey = `${from}|${toExclusive}|${ruanganId}|${kategori}|${search}`;
  const [prevKey, setPrevKey] = useState(filterKey);
  if (prevKey !== filterKey) {
    setPrevKey(filterKey);
    setPage(1);
  }

  const { result, loading, error, reload } = useAsyncData<BerkasKlaimResult>(
    () => fetchBerkas({ from, toExclusive, ruanganId, kategori, search, page }),
    [from, toExclusive, ruanganId, kategori, search, page],
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

  // Opsi ruangan berkelompok (RI/RJ/IGD) untuk Select ter-style. Grup berlabel
  // kosong = opsi "Semua ruangan" tanpa header.
  const ruanganGroups = useMemo<SelectGroup[]>(
    () => [
      { label: "", options: [{ value: "", label: "Semua ruangan" }] },
      ...KATEGORI.filter((k) => ruanganByKategori[k].length).map((k) => ({
        label: k,
        options: ruanganByKategori[k].map((r) => ({ value: r.id, label: r.nama })),
      })),
    ],
    [ruanganByKategori],
  );

  const kategoriTabs: { key: KategoriFilter; label: string }[] = [
    { key: "Semua", label: "Semua" },
    ...KATEGORI.map((k) => ({ key: k as KategoriFilter, label: k })),
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
        <StatCard label="Total Final" value={counts?.Semua ?? 0} icon={FolderCheck} tone="brand" loading={loading} />
        <StatCard label="Rawat Inap" value={counts?.["Rawat Inap"] ?? 0} icon={Hospital} tone="accent" loading={loading} />
        <StatCard label="IGD" value={counts?.IGD ?? 0} icon={Clock} tone="neutral" loading={loading} />
      </div>

      {/* Filter — kolom yang berbeda dari bawaan disorot */}
      <Card className={cn("p-4 transition-colors", aktif.length > 0 && "border-brand/40")}>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <LabelFilter htmlFor="from" aktif={sorot("tanggal")}>Dari tanggal</LabelFilter>
            <div className={cn(sorot("tanggal") && SOROT)}>
              <DatePicker id="from" value={from} max={to} onChange={setFrom} clearable={false} />
            </div>
          </div>
          <div>
            <LabelFilter htmlFor="to" aktif={sorot("tanggal")}>Sampai tanggal</LabelFilter>
            <div className={cn(sorot("tanggal") && SOROT)}>
              <DatePicker id="to" value={to} min={from} max={today} onChange={setTo} clearable={false} />
            </div>
          </div>
          <div>
            <LabelFilter htmlFor="cari" aktif={sorot("q")}>Cari</LabelFilter>
            <div className={cn(sorot("q") && SOROT)}>
              <InputWithIcon
                id="cari"
                icon={<Search className="size-4" />}
                placeholder="Nama / No. RM / ruang"
                value={searchInput}
                maxLength={CARI_MAKS}
                onChange={(e) => setSearchInput(e.target.value)}
              />
            </div>
          </div>
          <div className="lg:col-span-3">
            <LabelFilter htmlFor="ruangan" aktif={sorot("ruangan")}>Ruangan</LabelFilter>
            <div className={cn(sorot("ruangan") && SOROT)}>
              <Select
                id="ruangan"
                value={ruanganId}
                onChange={setRuanganId}
                options={ruanganGroups}
                placeholder="Semua ruangan"
              />
            </div>
          </div>
        </div>

        {rangeInvalid && (
          <p className="mt-2 text-xs text-danger">Tanggal awal melebihi tanggal akhir.</p>
        )}

        {/* Tab kategori */}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {kategoriTabs.map((t) => {
            const active = kategori === t.key;
            const jumlah = counts ? counts[t.key] : undefined;
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => setKategori(t.key)}
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

        {/* Ringkasan filter aktif (tetap tersimpan saat bolak-balik ke detail pasien) */}
        {aktif.length > 0 && (
          <div
            role="region"
            aria-label="Filter aktif"
            className="mt-3 flex flex-wrap items-center gap-2 rounded-[var(--radius-md)] border border-brand/25 bg-brand-soft/60 px-3 py-2"
          >
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand-soft-fg">
              <Filter className="size-3.5" aria-hidden /> Filter aktif
            </span>
            {sorot("tanggal") && (
              <ChipFilter label={`${formatDate(from)} – ${formatDate(to)}`} onHapus={() => { const b = filterBawaan(hariIni); setFrom(b.from); setTo(b.to); }} hapusLabel="Kembalikan rentang 7 hari terakhir" />
            )}
            {sorot("kategori") && <ChipFilter label={kategori} onHapus={() => setKategori("Semua")} hapusLabel="Hapus filter jenis" />}
            {sorot("ruangan") && (
              <ChipFilter label={ruanganOptions.find((r) => r.id === ruanganId)?.nama ?? `Ruangan ${ruanganId}`} onHapus={() => setRuanganId("")} hapusLabel="Hapus filter ruangan" />
            )}
            {sorot("q") && <ChipFilter label={`“${searchInput.trim()}”`} onHapus={() => setSearchInput("")} hapusLabel="Hapus pencarian" />}
            {dipulihkan && (
              <span className="inline-flex items-center gap-1 text-[11px] text-fg-muted">
                <History className="size-3.5" aria-hidden /> dipulihkan dari pencarian terakhir
              </span>
            )}
            <button
              type="button"
              onClick={aturUlang}
              className="ml-auto inline-flex items-center gap-1 rounded-[var(--radius-sm)] px-2 py-1 text-xs font-medium text-brand hover:bg-brand/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring"
            >
              <RotateCcw className="size-3.5" aria-hidden /> Atur ulang filter
            </button>
          </div>
        )}
      </Card>

      {/* Daftar kartu */}
      <Card className="overflow-hidden">
        <CardHeader
          title="Pasien Final"
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
            <EmptyState title="Tidak ada data" description="Tidak ada pasien final untuk filter ini." />
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
                  <BerkasCard key={it.nomor} item={it} />
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

function BerkasCard({ item }: { item: BerkasKlaimItem }) {
  const href = `/berkas-klaim/rm/${item.nopen}`;
  return (
    <motion.div
      variants={cardVariants}
      className="flex flex-col rounded-[var(--radius-lg)] border border-border bg-surface p-4 shadow-xs transition-colors hover:border-brand/50"
    >
      <Link href={href} prefetch={false} className="block rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring">
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
        </div>
      </Link>

      {item.turunan.length > 0 && (
        <div className="mt-3">
          <TurunanCollapse turunan={item.turunan} />
        </div>
      )}

      <Link
        href={href}
        prefetch={false}
        className="mt-4 inline-flex items-center justify-center gap-1.5 rounded-[var(--radius-md)] border border-brand bg-brand-soft px-3 py-2 text-sm font-medium text-brand-soft-fg transition-colors hover:bg-brand/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring"
      >
        Buka Berkas
        <ArrowRight className="size-4" />
      </Link>
    </motion.div>
  );
}

/** Label kolom filter; titik brand menandai filter yang sedang dipakai. */
function LabelFilter({ htmlFor, aktif, children }: { htmlFor: string; aktif: boolean; children: React.ReactNode }) {
  return (
    <Label htmlFor={htmlFor} className={cn(aktif && "text-brand-soft-fg")}>
      <span className="inline-flex items-center gap-1.5">
        {children}
        {aktif && (
          <>
            <span className="size-1.5 rounded-full bg-brand" aria-hidden />
            <span className="sr-only">(filter aktif)</span>
          </>
        )}
      </span>
    </Label>
  );
}

function ChipFilter({ label, onHapus, hapusLabel }: { label: string; onHapus: () => void; hapusLabel: string }) {
  return (
    <span className="inline-flex max-w-full items-center gap-1 rounded-full border border-brand/40 bg-surface py-0.5 pr-1 pl-2.5 text-xs font-medium text-fg">
      <span className="truncate">{label}</span>
      <button
        type="button"
        onClick={onHapus}
        aria-label={hapusLabel}
        title={hapusLabel}
        className="rounded-full p-0.5 text-fg-subtle hover:bg-surface-2 hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring"
      >
        <X className="size-3" />
      </button>
    </span>
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
          <Skeleton className="mt-4 h-9 w-full rounded-[var(--radius-md)]" />
        </div>
      ))}
    </div>
  );
}

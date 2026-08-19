"use client";

import { useMemo, useState } from "react";
import {
  AnimatePresence,
  motion,
  useReducedMotion,
  type Variants,
} from "framer-motion";
import {
  BadgeCheck,
  Check,
  Clock,
  Coins,
  Crown,
  Layers,
  Package,
  Pill,
  RefreshCw,
  RotateCcw,
  Search,
  SlidersHorizontal,
  Tag,
  X,
} from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { DatePicker } from "@/components/ui/DatePicker";
import { Label, InputWithIcon } from "@/components/ui/Field";
import { Skeleton } from "@/components/ui/Skeleton";
import { PopoverPanel } from "@/components/ui/Popover";
import { EmptyState, ErrorState } from "@/components/feedback/States";
import { cn } from "@/lib/cn";
import { useAsyncData } from "@/lib/useAsyncData";
import { formatDate, formatJam, formatNumber, formatRupiah, formatRupiahRingkas } from "@/lib/format";
import type {
  CaraBayar,
  KategoriOption,
  ObatTerbanyakItem,
  ObatTerbanyakResult,
  UrutMetric,
} from "@/server/modules/farmasi/farmasi.types";

/* ------------------------------------------------------------------ helpers */

const p2 = (n: number) => String(n).padStart(2, "0");
const ymd = (d: Date) => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;

type PresetKey = "bulan-ini" | "30-hari" | "bulan-lalu" | "tahun-ini";

function presetRange(key: PresetKey): { from: string; to: string } {
  const now = new Date();
  const today = ymd(now);
  if (key === "30-hari") {
    const f = new Date(now);
    f.setDate(f.getDate() - 29);
    return { from: ymd(f), to: today };
  }
  if (key === "bulan-lalu") {
    const first = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const last = new Date(now.getFullYear(), now.getMonth(), 0);
    return { from: ymd(first), to: ymd(last) };
  }
  if (key === "tahun-ini") {
    return { from: ymd(new Date(now.getFullYear(), 0, 1)), to: today };
  }
  // bulan-ini (default)
  return { from: ymd(new Date(now.getFullYear(), now.getMonth(), 1)), to: today };
}

const PRESETS: { key: PresetKey; label: string }[] = [
  { key: "bulan-ini", label: "Bulan ini" },
  { key: "30-hari", label: "30 hari" },
  { key: "bulan-lalu", label: "Bulan lalu" },
  { key: "tahun-ini", label: "Tahun ini" },
];

const CARA_BAYAR: { key: CaraBayar; label: string }[] = [
  { key: 0, label: "Semua" },
  { key: 2, label: "BPJS" },
  { key: 1, label: "Umum" },
];

const METRICS: { key: UrutMetric; label: string }[] = [
  { key: "qty", label: "Kuantitas" },
  { key: "nilai", label: "Nilai (Rp)" },
];

async function fetchObat(args: {
  from: string;
  to: string;
  caraBayar: CaraBayar;
  kategori: string[];
  metric: UrutMetric;
}): Promise<ObatTerbanyakResult> {
  const p = new URLSearchParams({
    from: args.from,
    to: args.to,
    caraBayar: String(args.caraBayar),
    metric: args.metric,
  });
  if (args.kategori.length) p.set("kategori", args.kategori.join(","));
  const res = await fetch(`/api/laporan/farmasi-obat?${p.toString()}`);
  if (!res.ok) throw new Error("Gagal memuat data");
  const json = (await res.json()) as { data: ObatTerbanyakResult };
  return json.data;
}

async function fetchKategori(): Promise<KategoriOption[]> {
  const res = await fetch(`/api/laporan/farmasi-obat/kategori`);
  if (!res.ok) throw new Error("Gagal memuat kategori");
  const json = (await res.json()) as { data: KategoriOption[] };
  return json.data;
}

/* -------------------------------------------------------------------- view */

export function FarmasiObatView() {
  const initial = useMemo(() => presetRange("bulan-ini"), []);
  const [from, setFrom] = useState(initial.from);
  const [to, setTo] = useState(initial.to);
  const [preset, setPreset] = useState<PresetKey | "">("bulan-ini");
  const [caraBayar, setCaraBayar] = useState<CaraBayar>(0);
  const [kategori, setKategori] = useState<string[]>([]);
  const [metric, setMetric] = useState<UrutMetric>("qty");

  const rangeInvalid = !!from && !!to && from > to;

  const { result, loading, error, reload } = useAsyncData<ObatTerbanyakResult>(
    () => fetchObat({ from, to, caraBayar, kategori, metric }),
    [from, to, caraBayar, kategori.join(","), metric],
  );
  const kat = useAsyncData<KategoriOption[]>(fetchKategori, []);

  const items = result?.data ?? [];
  const summary = result?.summary ?? null;
  const updatedAt = result?.updatedAt ?? null;
  const hasFilter = caraBayar !== 0 || kategori.length > 0 || preset !== "bulan-ini";

  function applyPreset(key: PresetKey) {
    const r = presetRange(key);
    setFrom(r.from);
    setTo(r.to);
    setPreset(key);
  }
  function onFrom(v: string) {
    setFrom(v);
    setPreset("");
  }
  function onTo(v: string) {
    setTo(v);
    setPreset("");
  }
  function resetFilter() {
    applyPreset("bulan-ini");
    setCaraBayar(0);
    setKategori([]);
    setMetric("qty");
  }

  const leader = items[0] ?? null;
  const maxVal = leader ? (metric === "qty" ? leader.qty : leader.nilai) : 0;
  const share =
    summary && (metric === "qty" ? summary.totalQty : summary.totalNilai) > 0
      ? metric === "qty"
        ? summary.top10Qty / summary.totalQty
        : summary.top10Nilai / summary.totalNilai
      : 0;

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
        <Button
          variant="secondary"
          size="sm"
          icon={<RefreshCw className={cn("size-4", loading && "animate-spin")} />}
          onClick={() => reload()}
        >
          Refresh
        </Button>
      </div>

      {/* Filter */}
      <Card className="p-4">
        {/* Periode */}
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-0 grow">
            <Label>Periode</Label>
            <div className="flex flex-wrap items-center gap-2">
              {PRESETS.map((pr) => (
                <Chip key={pr.key} active={preset === pr.key} onClick={() => applyPreset(pr.key)}>
                  {pr.label}
                </Chip>
              ))}
              <span className="mx-1 hidden h-5 w-px bg-border sm:block" />
              <div className="w-[10.5rem]">
                <DatePicker value={from} onChange={onFrom} max={to || undefined} clearable={false} />
              </div>
              <span className="text-fg-subtle">–</span>
              <div className="w-[10.5rem]">
                <DatePicker value={to} onChange={onTo} min={from || undefined} clearable={false} />
              </div>
            </div>
          </div>
        </div>

        {rangeInvalid && (
          <p className="mt-2 text-xs text-danger">Tanggal awal melebihi tanggal akhir.</p>
        )}

        {/* Kategori + Cara bayar + reset */}
        <div className="mt-4 flex flex-wrap items-end gap-x-6 gap-y-3">
          <div>
            <Label>Kategori</Label>
            <KategoriFilter
              value={kategori}
              onChange={setKategori}
              options={kat.result ?? []}
              loading={kat.loading}
            />
          </div>
          <div>
            <Label>Cara bayar</Label>
            <Segmented
              options={CARA_BAYAR.map((c) => ({ key: String(c.key), label: c.label }))}
              value={String(caraBayar)}
              onChange={(v) => setCaraBayar(Number(v) as CaraBayar)}
            />
          </div>
          {hasFilter && (
            <button
              type="button"
              onClick={resetFilter}
              className="mb-0.5 ml-auto inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-medium text-fg-muted transition-colors hover:bg-surface-2 hover:text-fg"
            >
              <RotateCcw className="size-3.5" />
              Reset
            </button>
          )}
        </div>
      </Card>

      {/* Ringkasan */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.15fr_1fr]">
        <LeaderCard item={leader} metric={metric} loading={loading} />
        <div className="grid grid-cols-2 gap-4">
          <MiniStat
            icon={Package}
            label="Jenis obat"
            value={summary ? formatNumber(summary.jenisObat) : "—"}
            hint="pada filter ini"
            loading={loading}
          />
          <MiniStat
            icon={Layers}
            label="Total kuantitas"
            value={summary ? formatNumber(summary.totalQty) : "—"}
            hint="seluruh obat"
            loading={loading}
          />
          <MiniStat
            icon={Coins}
            label="Total nilai"
            value={summary ? formatRupiahRingkas(summary.totalNilai) : "—"}
            hint={summary ? formatRupiah(summary.totalNilai) : ""}
            loading={loading}
          />
          <ShareStat share={share} metric={metric} loading={loading} />
        </div>
      </div>

      {/* Leaderboard */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="flex size-7 items-center justify-center rounded-[var(--radius-md)] bg-brand-soft text-brand">
            <Pill className="size-4" />
          </span>
          <div>
            <h3 className="text-sm font-semibold text-fg">Peringkat 10 besar</h3>
            <p className="text-[11px] text-fg-subtle">
              {formatDate(from)} – {formatDate(to)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="hidden text-xs text-fg-subtle sm:inline">Urutkan</span>
          <Segmented
            options={METRICS.map((m) => ({ key: m.key, label: m.label }))}
            value={metric}
            onChange={(v) => setMetric(v as UrutMetric)}
          />
        </div>
      </div>

      {loading ? (
        <BoardSkeleton />
      ) : error ? (
        <Card>
          <ErrorState onRetry={reload} />
        </Card>
      ) : items.length === 0 ? (
        <Card>
          <EmptyState
            title="Tidak ada data farmasi"
            description="Tidak ada pemakaian obat untuk periode & filter ini. Coba perlebar periode atau ubah kategori."
          />
        </Card>
      ) : (
        <Board items={items} metric={metric} maxVal={maxVal} />
      )}
    </div>
  );
}

/* --------------------------------------------------------------- leaderboard */

function Board({
  items,
  metric,
  maxVal,
}: {
  items: ObatTerbanyakItem[];
  metric: UrutMetric;
  maxVal: number;
}) {
  const reduce = useReducedMotion();
  const container: Variants = {
    hidden: {},
    visible: { transition: { staggerChildren: reduce ? 0 : 0.05 } },
  };
  return (
    <AnimatePresence mode="wait">
      <motion.ul
        key={metric}
        variants={container}
        initial="hidden"
        animate="visible"
        className="space-y-2"
      >
        {items.map((it) => (
          <ObatRow key={it.farmasiId} item={it} metric={metric} maxVal={maxVal} reduce={!!reduce} />
        ))}
      </motion.ul>
    </AnimatePresence>
  );
}

const rowVariants: Variants = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.24, ease: [0.16, 1, 0.3, 1] } },
};

function ObatRow({
  item,
  metric,
  maxVal,
  reduce,
}: {
  item: ObatTerbanyakItem;
  metric: UrutMetric;
  maxVal: number;
  reduce: boolean;
}) {
  const value = metric === "qty" ? item.qty : item.nilai;
  const pct = maxVal > 0 ? Math.max(3, (value / maxVal) * 100) : 3;
  const top = item.rank === 1;

  return (
    <motion.li
      variants={rowVariants}
      className={cn(
        "group relative overflow-hidden rounded-[var(--radius-lg)] border bg-surface p-3.5 shadow-xs transition-colors sm:p-4",
        top ? "border-brand/40" : "border-border hover:border-brand/30",
      )}
    >
      <div className="flex items-center gap-3 sm:gap-4">
        <RankBadge rank={item.rank} />

        <div className="min-w-0 flex-1">
          {/* Baris atas: nama + nilai metrik */}
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate font-semibold leading-tight text-fg" title={item.nama}>
                {item.nama}
              </p>
              <div className="mt-1 flex flex-wrap items-center gap-1.5">
                <span className="inline-flex items-center gap-1 rounded-full bg-surface-2 px-2 py-0.5 text-[11px] font-medium text-fg-muted">
                  <Tag className="size-3" />
                  {item.kategoriLeaf}
                </span>
                <GenerikTag generik={item.generik} />
                {item.merk && (
                  <span className="truncate text-[11px] text-fg-subtle" title={item.merk}>
                    {item.merk}
                  </span>
                )}
              </div>
            </div>

            <div className="shrink-0 text-right">
              <p
                className={cn(
                  "font-semibold tabular leading-none",
                  metric === "qty" ? "text-xl text-fg" : "text-lg text-fg",
                )}
              >
                {metric === "qty" ? formatNumber(item.qty) : formatRupiah(item.nilai)}
                {metric === "qty" && (
                  <span className="ml-1 text-[11px] font-normal text-fg-subtle">unit</span>
                )}
              </p>
              <p className="mt-1 text-[11px] text-fg-subtle tabular">
                {metric === "qty"
                  ? formatRupiahRingkas(item.nilai)
                  : `${formatNumber(item.qty)} unit`}
                <span className="mx-1">·</span>
                {formatNumber(item.resep)} resep
              </p>
            </div>
          </div>

          {/* Bar kuantitas/nilai relatif ke #1 */}
          <div className="mt-2.5 h-2 w-full overflow-hidden rounded-full bg-surface-2">
            <motion.div
              className={cn("h-full rounded-full", top ? "bg-brand" : "bg-brand/55")}
              initial={reduce ? false : { width: 0 }}
              animate={{ width: `${pct}%` }}
              transition={{ duration: reduce ? 0 : 0.6, ease: [0.16, 1, 0.3, 1] }}
            />
          </div>
        </div>
      </div>
    </motion.li>
  );
}

function RankBadge({ rank }: { rank: number }) {
  const top3 = rank <= 3;
  return (
    <div
      className={cn(
        "flex size-9 shrink-0 items-center justify-center rounded-[var(--radius-md)] text-sm font-bold tabular sm:size-10",
        rank === 1 && "bg-brand text-brand-fg",
        rank === 2 && "bg-brand-soft text-brand-soft-fg",
        rank === 3 && "bg-accent-soft text-accent",
        !top3 && "bg-surface-2 text-fg-muted",
      )}
    >
      {rank}
    </div>
  );
}

function GenerikTag({ generik }: { generik: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium",
        generik ? "bg-success-soft text-success" : "bg-warning-soft text-warning",
      )}
    >
      <BadgeCheck className="size-3" />
      {generik ? "Generik" : "Non-generik"}
    </span>
  );
}

/* ------------------------------------------------------------- summary cards */

function LeaderCard({
  item,
  metric,
  loading,
}: {
  item: ObatTerbanyakItem | null;
  metric: UrutMetric;
  loading: boolean;
}) {
  return (
    <Card className="relative overflow-hidden p-5">
      <div
        className="pointer-events-none absolute -right-8 -top-10 size-40 rounded-full bg-brand-soft/60 blur-2xl"
        aria-hidden
      />
      <div className="relative">
        <div className="flex items-center gap-2 text-xs font-medium text-brand">
          <Crown className="size-4" />
          Obat teratas
        </div>
        {loading ? (
          <div className="mt-3 space-y-2">
            <Skeleton className="h-6 w-56 rounded" />
            <Skeleton className="h-4 w-40 rounded" />
            <Skeleton className="mt-3 h-9 w-32 rounded" />
          </div>
        ) : item ? (
          <>
            <p className="mt-2 text-lg font-semibold leading-tight text-fg" title={item.nama}>
              {item.nama}
            </p>
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              <span className="inline-flex items-center gap-1 rounded-full bg-surface-2 px-2 py-0.5 text-[11px] font-medium text-fg-muted">
                <Tag className="size-3" />
                {item.kategoriLeaf}
              </span>
              <GenerikTag generik={item.generik} />
            </div>
            <div className="mt-4 flex items-end gap-5">
              <div>
                <p className="text-[11px] uppercase tracking-wide text-fg-subtle">Kuantitas</p>
                <p className="text-2xl font-semibold tabular text-fg">
                  {formatNumber(item.qty)}
                  <span className="ml-1 text-xs font-normal text-fg-subtle">unit</span>
                </p>
              </div>
              <div className="h-9 w-px bg-border" />
              <div>
                <p className="text-[11px] uppercase tracking-wide text-fg-subtle">Nilai</p>
                <p className="text-2xl font-semibold tabular text-fg">{formatRupiah(item.nilai)}</p>
              </div>
            </div>
            {metric && (
              <p className="mt-3 text-[11px] text-fg-subtle">
                {formatNumber(item.resep)} baris resep pada periode terpilih
              </p>
            )}
          </>
        ) : (
          <p className="mt-3 text-sm text-fg-muted">Belum ada data.</p>
        )}
      </div>
    </Card>
  );
}

function MiniStat({
  icon: Icon,
  label,
  value,
  hint,
  loading,
}: {
  icon: typeof Package;
  label: string;
  value: string;
  hint?: string;
  loading: boolean;
}) {
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-fg-muted">{label}</p>
        <span className="flex size-7 items-center justify-center rounded-[var(--radius-md)] bg-surface-2 text-fg-muted">
          <Icon className="size-3.5" />
        </span>
      </div>
      <p className="mt-2 text-xl font-semibold tabular text-fg">
        {loading ? <span className="text-fg-subtle">—</span> : value}
      </p>
      {hint && !loading && <p className="mt-0.5 truncate text-[11px] text-fg-subtle">{hint}</p>}
    </Card>
  );
}

function ShareStat({
  share,
  metric,
  loading,
}: {
  share: number;
  metric: UrutMetric;
  loading: boolean;
}) {
  const pct = Math.round(share * 100);
  const r = 15.5;
  const c = 2 * Math.PI * r;
  return (
    <Card className="flex items-center gap-3 p-4">
      <div className="relative shrink-0">
        <svg viewBox="0 0 40 40" className="size-12 -rotate-90">
          <circle cx="20" cy="20" r={r} fill="none" stroke="var(--surface-2)" strokeWidth="4" />
          {!loading && (
            <circle
              cx="20"
              cy="20"
              r={r}
              fill="none"
              stroke="var(--brand)"
              strokeWidth="4"
              strokeLinecap="round"
              strokeDasharray={c}
              strokeDashoffset={c * (1 - share)}
            />
          )}
        </svg>
        <span className="absolute inset-0 flex items-center justify-center text-[11px] font-semibold tabular text-fg">
          {loading ? "—" : `${pct}%`}
        </span>
      </div>
      <div className="min-w-0">
        <p className="text-xs font-medium text-fg-muted">Kontribusi 10 besar</p>
        <p className="mt-0.5 text-[11px] text-fg-subtle">
          dari total {metric === "qty" ? "kuantitas" : "nilai"}
        </p>
      </div>
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

function Segmented({
  options,
  value,
  onChange,
}: {
  options: { key: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="inline-flex items-center gap-0.5 rounded-[var(--radius-md)] border border-border bg-surface-2/60 p-0.5">
      {options.map((o) => {
        const active = o.key === value;
        return (
          <button
            key={o.key}
            type="button"
            onClick={() => onChange(o.key)}
            className={cn(
              "relative rounded-[calc(var(--radius-md)-2px)] px-3 py-1.5 text-[13px] font-medium transition-colors",
              active ? "text-fg" : "text-fg-muted hover:text-fg",
            )}
          >
            {active && (
              <motion.span
                layoutId={`seg-${options.map((x) => x.key).join()}`}
                className="absolute inset-0 rounded-[calc(var(--radius-md)-2px)] bg-surface shadow-xs ring-1 ring-border"
                transition={{ type: "spring", stiffness: 400, damping: 32 }}
              />
            )}
            <span className="relative">{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}

/* -------------------------------------------------------------- multi-select */

function KategoriFilter({
  value,
  onChange,
  options,
  loading,
}: {
  value: string[];
  onChange: (v: string[]) => void;
  options: KategoriOption[];
  loading: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [anchorEl, setAnchorEl] = useState<HTMLButtonElement | null>(null);
  const [draft, setDraft] = useState<string[]>(value);
  const [q, setQ] = useState("");

  const grouped = useMemo(() => {
    const map = new Map<string, { grup: string; items: KategoriOption[] }>();
    const needle = q.trim().toLowerCase();
    for (const o of options) {
      if (needle && !o.nama.toLowerCase().includes(needle) && !o.grup.toLowerCase().includes(needle))
        continue;
      const g = map.get(o.grupId) ?? { grup: o.grup, items: [] };
      g.items.push(o);
      map.set(o.grupId, g);
    }
    return [...map.values()];
  }, [options, q]);

  function openPanel() {
    setDraft(value);
    setQ("");
    setOpen(true);
  }
  function commit() {
    onChange(draft);
    setOpen(false);
  }
  function toggle(id: string) {
    setDraft((d) => (d.includes(id) ? d.filter((x) => x !== id) : [...d, id]));
  }
  function toggleGroup(items: KategoriOption[]) {
    const ids = items.map((i) => i.id);
    const allOn = ids.every((id) => draft.includes(id));
    setDraft((d) => (allOn ? d.filter((x) => !ids.includes(x)) : [...new Set([...d, ...ids])]));
  }

  const count = value.length;
  const label = count === 0 ? "Semua kategori" : `${count} kategori`;

  return (
    <>
      <button
        ref={setAnchorEl}
        type="button"
        onClick={() => (open ? commit() : openPanel())}
        disabled={loading}
        className={cn(
          "flex h-10 w-[13.5rem] items-center gap-2 rounded-[var(--radius-md)] border bg-surface px-3 text-sm transition-colors",
          "hover:border-border-strong focus-visible:outline-none focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-brand-ring/40",
          "disabled:opacity-50 disabled:pointer-events-none",
          open ? "border-brand ring-2 ring-brand-ring/40" : "border-border",
          count > 0 ? "text-fg" : "text-fg-subtle",
        )}
      >
        <SlidersHorizontal className="size-4 shrink-0 text-fg-subtle" />
        <span className="flex-1 truncate text-left">{label}</span>
        {count > 0 && (
          <span
            role="button"
            tabIndex={-1}
            aria-label="Kosongkan kategori"
            onClick={(e) => {
              e.stopPropagation();
              onChange([]);
            }}
            className="shrink-0 rounded-full p-0.5 text-fg-subtle transition-colors hover:bg-surface-2 hover:text-fg"
          >
            <X className="size-3.5" />
          </span>
        )}
      </button>

      <PopoverPanel anchor={anchorEl} open={open} onClose={commit} matchWidth={false} className="p-0">
        <div className="w-[19rem]">
          <div className="border-b border-border p-2">
            <InputWithIcon
              icon={<Search className="size-4" />}
              placeholder="Cari kategori…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="h-9"
              autoFocus
            />
          </div>
          <div className="max-h-72 overflow-auto p-1.5">
            {grouped.length === 0 ? (
              <p className="px-2 py-6 text-center text-xs text-fg-subtle">Tak ada kategori cocok.</p>
            ) : (
              grouped.map((g) => {
                const ids = g.items.map((i) => i.id);
                const allOn = ids.every((id) => draft.includes(id));
                const someOn = !allOn && ids.some((id) => draft.includes(id));
                return (
                  <div key={g.grup} className="mb-1">
                    <button
                      type="button"
                      onClick={() => toggleGroup(g.items)}
                      className="flex w-full items-center gap-2 rounded-[var(--radius-sm)] px-2 py-1 text-left text-[11px] font-semibold uppercase tracking-wide text-fg-subtle transition-colors hover:bg-surface-2"
                    >
                      <CheckBox state={allOn ? "on" : someOn ? "mixed" : "off"} />
                      {g.grup}
                    </button>
                    {g.items.map((o) => {
                      const on = draft.includes(o.id);
                      return (
                        <button
                          key={o.id}
                          type="button"
                          onClick={() => toggle(o.id)}
                          className={cn(
                            "flex w-full items-center gap-2 rounded-[var(--radius-sm)] py-1.5 pl-6 pr-2 text-left text-sm transition-colors",
                            on ? "text-fg" : "text-fg-muted hover:bg-surface-2 hover:text-fg",
                          )}
                        >
                          <CheckBox state={on ? "on" : "off"} />
                          <span className="truncate">{o.nama}</span>
                        </button>
                      );
                    })}
                  </div>
                );
              })
            )}
          </div>
          <div className="flex items-center justify-between border-t border-border px-2 py-2">
            <button
              type="button"
              onClick={() => setDraft([])}
              className="rounded-[var(--radius-sm)] px-2 py-1 text-xs font-medium text-fg-muted transition-colors hover:bg-surface-2 hover:text-fg"
            >
              Kosongkan
            </button>
            <span className="text-[11px] text-fg-subtle">{draft.length} dipilih</span>
            <button
              type="button"
              onClick={commit}
              className="rounded-[var(--radius-sm)] bg-brand px-3 py-1 text-xs font-medium text-brand-fg transition-colors hover:bg-brand-hover"
            >
              Terapkan
            </button>
          </div>
        </div>
      </PopoverPanel>
    </>
  );
}

function CheckBox({ state }: { state: "on" | "off" | "mixed" }) {
  return (
    <span
      className={cn(
        "flex size-4 shrink-0 items-center justify-center rounded-[4px] border transition-colors",
        state === "off" ? "border-border-strong bg-surface" : "border-brand bg-brand text-brand-fg",
      )}
    >
      {state === "on" && <Check className="size-3" strokeWidth={3} />}
      {state === "mixed" && <span className="size-1.5 rounded-[1px] bg-brand-fg" />}
    </span>
  );
}

/* ------------------------------------------------------------------ skeleton */

function BoardSkeleton() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="rounded-[var(--radius-lg)] border border-border bg-surface p-4">
          <div className="flex items-center gap-4">
            <Skeleton className="size-10 rounded-[var(--radius-md)]" />
            <div className="flex-1 space-y-2">
              <div className="flex justify-between">
                <Skeleton className="h-4 w-48 rounded" />
                <Skeleton className="h-5 w-16 rounded" />
              </div>
              <Skeleton className="h-2 w-full rounded-full" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

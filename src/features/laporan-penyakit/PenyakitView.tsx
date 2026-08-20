"use client";

import { useMemo, useState } from "react";
import {
  AnimatePresence,
  motion,
  useReducedMotion,
  type Variants,
} from "framer-motion";
import {
  Activity,
  ClipboardList,
  Clock,
  Crown,
  Hash,
  RefreshCw,
  RotateCcw,
  Stethoscope,
  Users,
} from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { DatePicker } from "@/components/ui/DatePicker";
import { Label } from "@/components/ui/Field";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState, ErrorState } from "@/components/feedback/States";
import { cn } from "@/lib/cn";
import { useAsyncData } from "@/lib/useAsyncData";
import { formatDate, formatJam, formatNumber } from "@/lib/format";
import type {
  CaraBayar,
  JenisLayanan,
  PenyakitItem,
  PenyakitResult,
  UrutMetric,
} from "@/server/modules/penyakit/penyakit.types";

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
  return { from: ymd(new Date(now.getFullYear(), now.getMonth(), 1)), to: today };
}

const PRESETS: { key: PresetKey; label: string }[] = [
  { key: "bulan-ini", label: "Bulan ini" },
  { key: "30-hari", label: "30 hari" },
  { key: "bulan-lalu", label: "Bulan lalu" },
  { key: "tahun-ini", label: "Tahun ini" },
];

const JENIS: { key: JenisLayanan; label: string; short: string }[] = [
  { key: 1, label: "Rawat Jalan", short: "RJ" },
  { key: 2, label: "Gawat Darurat", short: "IGD" },
  { key: 3, label: "Rawat Inap", short: "RI" },
];

const CARA_BAYAR: { key: CaraBayar; label: string }[] = [
  { key: 0, label: "Semua" },
  { key: 2, label: "BPJS" },
  { key: 1, label: "Umum" },
];

const METRICS: { key: UrutMetric; label: string }[] = [
  { key: "kasus", label: "Kasus" },
  { key: "pasien", label: "Pasien" },
];

const jenisLabel = (j: JenisLayanan) => JENIS.find((x) => x.key === j)?.label ?? "—";

async function fetchPenyakit(args: {
  from: string;
  to: string;
  jenis: JenisLayanan;
  caraBayar: CaraBayar;
  utama: boolean;
  metric: UrutMetric;
}): Promise<PenyakitResult> {
  const p = new URLSearchParams({
    from: args.from,
    to: args.to,
    jenis: String(args.jenis),
    caraBayar: String(args.caraBayar),
    utama: args.utama ? "1" : "0",
    metric: args.metric,
  });
  const res = await fetch(`/api/laporan/penyakit?${p.toString()}`);
  if (!res.ok) throw new Error("Gagal memuat data");
  const json = (await res.json()) as { data: PenyakitResult };
  return json.data;
}

/* -------------------------------------------------------------------- view */

export function PenyakitView() {
  const initial = useMemo(() => presetRange("bulan-ini"), []);
  const [from, setFrom] = useState(initial.from);
  const [to, setTo] = useState(initial.to);
  const [preset, setPreset] = useState<PresetKey | "">("bulan-ini");
  const [jenis, setJenis] = useState<JenisLayanan>(3);
  const [caraBayar, setCaraBayar] = useState<CaraBayar>(0);
  const [utama, setUtama] = useState(true);
  const [metric, setMetric] = useState<UrutMetric>("kasus");

  const rangeInvalid = !!from && !!to && from > to;

  const { result, loading, error, reload } = useAsyncData<PenyakitResult>(
    () => fetchPenyakit({ from, to, jenis, caraBayar, utama, metric }),
    [from, to, jenis, caraBayar, utama, metric],
  );

  const items = result?.data ?? [];
  const summary = result?.summary ?? null;
  const updatedAt = result?.updatedAt ?? null;
  const hasFilter =
    jenis !== 3 || caraBayar !== 0 || !utama || preset !== "bulan-ini";

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
    setJenis(3);
    setCaraBayar(0);
    setUtama(true);
    setMetric("kasus");
  }

  const leader = items[0] ?? null;
  const maxVal = leader ? (metric === "kasus" ? leader.kasus : leader.pasien) : 0;
  const share = summary?.kasusShare ?? 0;

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

        {/* Jenis layanan */}
        <div className="mt-4">
          <Label>Jenis layanan</Label>
          <Segmented
            options={JENIS.map((jn) => ({ key: String(jn.key), label: jn.label }))}
            value={String(jenis)}
            onChange={(v) => setJenis(Number(v) as JenisLayanan)}
          />
        </div>

        {/* Cara bayar + diagnosa utama + reset */}
        <div className="mt-4 flex flex-wrap items-end gap-x-6 gap-y-3">
          <div>
            <Label>Cara bayar</Label>
            <Segmented
              options={CARA_BAYAR.map((c) => ({ key: String(c.key), label: c.label }))}
              value={String(caraBayar)}
              onChange={(v) => setCaraBayar(Number(v) as CaraBayar)}
            />
          </div>
          <div>
            <Label>Cakupan diagnosa</Label>
            <Switch
              checked={utama}
              onChange={setUtama}
              on="Diagnosa utama"
              off="Semua diagnosa"
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
        <LeaderCard item={leader} jenis={jenis} loading={loading} />
        <div className="grid grid-cols-2 gap-4">
          <MiniStat
            icon={Stethoscope}
            label="Jenis diagnosis"
            value={summary ? formatNumber(summary.jenisDiag) : "—"}
            hint="kode ICD-10 berbeda"
            loading={loading}
          />
          <MiniStat
            icon={ClipboardList}
            label="Total kasus"
            value={summary ? formatNumber(summary.totalKasus) : "—"}
            hint="seluruh diagnosa"
            loading={loading}
          />
          <MiniStat
            icon={Users}
            label="Total pasien"
            value={summary ? formatNumber(summary.totalPasien) : "—"}
            hint="pasien unik"
            loading={loading}
          />
          <ShareStat share={share} loading={loading} />
        </div>
      </div>

      {/* Leaderboard */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="flex size-7 items-center justify-center rounded-[var(--radius-md)] bg-brand-soft text-brand">
            <Activity className="size-4" />
          </span>
          <div>
            <h3 className="text-sm font-semibold text-fg">
              Peringkat 10 besar · {jenisLabel(jenis)}
            </h3>
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
            title="Tidak ada data diagnosa"
            description="Tidak ada diagnosa untuk periode & filter ini. Coba perlebar periode, ganti jenis layanan, atau nonaktifkan 'Diagnosa utama'."
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
  items: PenyakitItem[];
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
          <PenyakitRow key={it.kode} item={it} metric={metric} maxVal={maxVal} reduce={!!reduce} />
        ))}
      </motion.ul>
    </AnimatePresence>
  );
}

const rowVariants: Variants = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.24, ease: [0.16, 1, 0.3, 1] } },
};

function PenyakitRow({
  item,
  metric,
  maxVal,
  reduce,
}: {
  item: PenyakitItem;
  metric: UrutMetric;
  maxVal: number;
  reduce: boolean;
}) {
  const value = metric === "kasus" ? item.kasus : item.pasien;
  const secondary = metric === "kasus" ? item.pasien : item.kasus;
  const secondaryLabel = metric === "kasus" ? "pasien" : "kasus";
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
          {/* Baris atas: kode + nama + nilai metrik */}
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <KodeBadge kode={item.kode} />
                <p className="truncate font-semibold leading-tight text-fg" title={item.nama}>
                  {item.nama}
                </p>
              </div>
              <div className="mt-1.5 max-w-[15rem]">
                <GenderBar lk={item.lk} pr={item.pr} />
              </div>
            </div>

            <div className="shrink-0 text-right">
              <p className="text-xl font-semibold tabular leading-none text-fg">
                {formatNumber(value)}
                <span className="ml-1 text-[11px] font-normal text-fg-subtle">
                  {metric === "kasus" ? "kasus" : "pasien"}
                </span>
              </p>
              <p className="mt-1 text-[11px] text-fg-subtle tabular">
                {formatNumber(secondary)} {secondaryLabel}
              </p>
            </div>
          </div>

          {/* Bar kasus/pasien relatif ke #1 */}
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

function KodeBadge({ kode }: { kode: string }) {
  return (
    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-accent-soft px-2 py-0.5 font-mono text-[11px] font-semibold text-accent">
      <Hash className="size-3" />
      {kode}
    </span>
  );
}

/** Bar proporsi jenis kelamin: L (teal) · P (terracotta). */
function GenderBar({ lk, pr }: { lk: number; pr: number }) {
  const total = lk + pr;
  if (total === 0) {
    return <p className="text-[11px] text-fg-subtle">Jenis kelamin tak tercatat</p>;
  }
  const lkPct = (lk / total) * 100;
  return (
    <div className="space-y-1">
      <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
        <span className="h-full bg-accent" style={{ width: `${lkPct}%` }} />
        <span className="h-full bg-brand" style={{ width: `${100 - lkPct}%` }} />
      </div>
      <div className="flex items-center gap-3 text-[11px] text-fg-subtle tabular">
        <span className="inline-flex items-center gap-1">
          <span className="size-1.5 rounded-full bg-accent" />L {formatNumber(lk)}
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="size-1.5 rounded-full bg-brand" />P {formatNumber(pr)}
        </span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------- summary cards */

function LeaderCard({
  item,
  jenis,
  loading,
}: {
  item: PenyakitItem | null;
  jenis: JenisLayanan;
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
          Penyakit teratas · {jenisLabel(jenis)}
        </div>
        {loading ? (
          <div className="mt-3 space-y-2">
            <Skeleton className="h-6 w-56 rounded" />
            <Skeleton className="h-4 w-40 rounded" />
            <Skeleton className="mt-3 h-9 w-32 rounded" />
          </div>
        ) : item ? (
          <>
            <div className="mt-2 flex items-center gap-2">
              <KodeBadge kode={item.kode} />
            </div>
            <p className="mt-2 text-lg font-semibold leading-tight text-fg" title={item.nama}>
              {item.nama}
            </p>
            <div className="mt-4 flex items-end gap-5">
              <div>
                <p className="text-[11px] uppercase tracking-wide text-fg-subtle">Kasus</p>
                <p className="text-2xl font-semibold tabular text-fg">{formatNumber(item.kasus)}</p>
              </div>
              <div className="h-9 w-px bg-border" />
              <div>
                <p className="text-[11px] uppercase tracking-wide text-fg-subtle">Pasien</p>
                <p className="text-2xl font-semibold tabular text-fg">
                  {formatNumber(item.pasien)}
                </p>
              </div>
            </div>
            <div className="mt-4 max-w-xs">
              <GenderBar lk={item.lk} pr={item.pr} />
            </div>
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
  icon: typeof Activity;
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

function ShareStat({ share, loading }: { share: number; loading: boolean }) {
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
        <p className="mt-0.5 text-[11px] text-fg-subtle">dari total kasus</p>
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
                layoutId={`penyakit-seg-${options.map((x) => x.key).join()}`}
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

function Switch({
  checked,
  onChange,
  on,
  off,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  on: string;
  off: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={cn(
        "inline-flex h-10 items-center gap-2.5 rounded-[var(--radius-md)] border px-3 text-[13px] font-medium transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring/40",
        checked
          ? "border-brand/40 bg-brand-soft/50 text-fg"
          : "border-border bg-surface text-fg-muted hover:bg-surface-2",
      )}
    >
      <span
        className={cn(
          "relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors",
          checked ? "bg-brand" : "bg-fg-muted/30",
        )}
      >
        <motion.span
          animate={{ x: checked ? 18 : 2 }}
          transition={{ type: "spring", stiffness: 500, damping: 34 }}
          className="size-4 rounded-full bg-white shadow-sm"
        />
      </span>
      {checked ? on : off}
    </button>
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

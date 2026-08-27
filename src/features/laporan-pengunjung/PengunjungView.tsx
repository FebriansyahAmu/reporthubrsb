"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  AlertCircle,
  ArrowRightLeft,
  Clock,
  FileSpreadsheet,
  RefreshCw,
  RotateCcw,
  UserPlus,
  Users,
} from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { DatePicker } from "@/components/ui/DatePicker";
import { Label } from "@/components/ui/Field";
import { Select } from "@/components/ui/Select";
import { Skeleton } from "@/components/ui/Skeleton";
import { Table, THead, TH, TBody, TR, TD } from "@/components/ui/Table";
import { Pagination } from "@/components/ui/Pagination";
import { EmptyState, ErrorState } from "@/components/feedback/States";
import { cn } from "@/lib/cn";
import { useAsyncData } from "@/lib/useAsyncData";
import { downloadFromEndpoint } from "@/lib/download";
import { formatDate, formatJam, formatNumber } from "@/lib/format";
import type { PageMeta } from "@/lib/types";
import type {
  CaraBayar,
  JenisLayanan,
  PengunjungResult,
  RuanganOption,
  TindakLanjut,
} from "@/server/modules/pengunjung/pengunjung.types";

/* ------------------------------------------------------------------ helpers */

const PAGE_SIZE = 25;
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
  if (key === "tahun-ini") return { from: ymd(new Date(now.getFullYear(), 0, 1)), to: today };
  return { from: ymd(new Date(now.getFullYear(), now.getMonth(), 1)), to: today };
}

const PRESETS: { key: PresetKey; label: string }[] = [
  { key: "bulan-ini", label: "Bulan ini" },
  { key: "30-hari", label: "30 hari" },
  { key: "bulan-lalu", label: "Bulan lalu" },
  { key: "tahun-ini", label: "Tahun ini" },
];

const JENIS: { key: JenisLayanan; label: string }[] = [
  { key: 1, label: "Rawat Jalan" },
  { key: 2, label: "Gawat Darurat" },
  { key: 3, label: "Rawat Inap" },
];
const CARA_BAYAR: { key: CaraBayar; label: string }[] = [
  { key: 0, label: "Semua" },
  { key: 2, label: "BPJS" },
  { key: 1, label: "Umum" },
];
const TINDAK: { key: TindakLanjut; label: string }[] = [
  { key: "all", label: "Semua" },
  { key: "rajal", label: "Rawat Jalan" },
  { key: "ranap", label: "Lanjut Ranap" },
];
const jenisLabel = (j: JenisLayanan) => JENIS.find((x) => x.key === j)?.label ?? "—";

async function fetchPengunjung(args: {
  from: string;
  to: string;
  jenis: JenisLayanan;
  ruangan: string;
  caraBayar: CaraBayar;
  tindak: TindakLanjut;
  page: number;
}): Promise<PengunjungResult> {
  const p = new URLSearchParams({
    from: args.from,
    to: args.to,
    jenis: String(args.jenis),
    ruangan: args.ruangan,
    caraBayar: String(args.caraBayar),
    tindak: args.tindak,
    page: String(args.page),
    pageSize: String(PAGE_SIZE),
  });
  const res = await fetch(`/api/laporan/pengunjung?${p.toString()}`);
  if (!res.ok) throw new Error("Gagal memuat data");
  return ((await res.json()) as { data: PengunjungResult }).data;
}

async function fetchRuangan(): Promise<RuanganOption[]> {
  const res = await fetch(`/api/laporan/pengunjung/ruangan`);
  if (!res.ok) throw new Error("Gagal memuat ruangan");
  return ((await res.json()) as { data: RuanganOption[] }).data;
}

/* -------------------------------------------------------------------- view */

export function PengunjungView() {
  const initial = useMemo(() => presetRange("bulan-ini"), []);
  const [from, setFrom] = useState(initial.from);
  const [to, setTo] = useState(initial.to);
  const [preset, setPreset] = useState<PresetKey | "">("bulan-ini");
  const [jenis, setJenis] = useState<JenisLayanan>(2);
  const [ruangan, setRuangan] = useState("");
  const [caraBayar, setCaraBayar] = useState<CaraBayar>(0);
  const [tindak, setTindak] = useState<TindakLanjut>("all");
  const [page, setPage] = useState(1);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const rangeInvalid = !!from && !!to && from > to;

  // Reset ke halaman 1 saat filter (selain page) berubah.
  const filterKey = `${from}|${to}|${jenis}|${ruangan}|${caraBayar}|${tindak}`;
  const [prevKey, setPrevKey] = useState(filterKey);
  if (prevKey !== filterKey) {
    setPrevKey(filterKey);
    setPage(1);
  }

  const { result, loading, error, reload } = useAsyncData<PengunjungResult>(
    () => fetchPengunjung({ from, to, jenis, ruangan, caraBayar, tindak, page }),
    [from, to, jenis, ruangan, caraBayar, tindak, page],
  );
  const ruang = useAsyncData<RuanganOption[]>(fetchRuangan, []);

  const items = result?.data ?? [];
  const summary = result?.summary ?? null;
  const meta = result?.meta ?? null;
  const updatedAt = result?.updatedAt ?? null;
  const isIgd = jenis === 2;
  const hasFilter =
    jenis !== 2 || ruangan !== "" || caraBayar !== 0 || tindak !== "all" || preset !== "bulan-ini";

  const roomOptions = useMemo(() => {
    const rooms = (ruang.result ?? [])
      .filter((r) => r.jenis === jenis)
      .map((r) => ({ value: r.id, label: r.nama }));
    return [{ value: "", label: "Semua ruangan" }, ...rooms];
  }, [ruang.result, jenis]);

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
  function changeJenis(j: JenisLayanan) {
    setJenis(j);
    setRuangan("");
    setTindak("all");
  }
  function resetFilter() {
    applyPreset("bulan-ini");
    changeJenis(2);
    setCaraBayar(0);
  }

  async function doExport() {
    setExporting(true);
    setExportError(null);
    try {
      const p = new URLSearchParams({
        from,
        to,
        jenis: String(jenis),
        ruangan,
        caraBayar: String(caraBayar),
        tindak,
      });
      await downloadFromEndpoint(
        `/api/laporan/pengunjung/export?${p.toString()}`,
        "Laporan-Pengunjung.xlsx",
      );
    } catch (e) {
      setExportError(e instanceof Error ? e.message : "Gagal mengekspor data.");
    } finally {
      setExporting(false);
    }
  }

  const total = summary?.total ?? 0;
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
            icon={<RefreshCw className={cn("size-4", loading && "animate-spin")} />}
            onClick={() => reload()}
          >
            Refresh
          </Button>
          <Button
            size="sm"
            icon={<FileSpreadsheet className="size-4" />}
            loading={exporting}
            disabled={!canExport}
            onClick={doExport}
            title={total > 0 ? "Unduh Excel sesuai filter" : "Tidak ada data untuk diekspor"}
          >
            Export Excel
          </Button>
        </div>
      </div>

      {exportError && (
        <div className="flex items-center gap-2 rounded-[var(--radius-md)] border border-danger/30 bg-danger-soft px-3 py-2 text-sm text-danger">
          <AlertCircle className="size-4 shrink-0" />
          {exportError}
        </div>
      )}

      {/* Filter */}
      <Card className="p-4">
        {/* Periode */}
        <div>
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

        {rangeInvalid && (
          <p className="mt-2 text-xs text-danger">Tanggal awal melebihi tanggal akhir.</p>
        )}

        {/* Jenis layanan + ruangan */}
        <div className="mt-4 flex flex-wrap items-end gap-x-6 gap-y-3">
          <div>
            <Label>Jenis layanan</Label>
            <Segmented
              options={JENIS.map((jn) => ({ key: String(jn.key), label: jn.label }))}
              value={String(jenis)}
              onChange={(v) => changeJenis(Number(v) as JenisLayanan)}
            />
          </div>
          <div className="min-w-[13rem]">
            <Label>Ruangan</Label>
            <Select
              value={ruangan}
              onChange={setRuangan}
              options={roomOptions}
              placeholder="Semua ruangan"
            />
          </div>
        </div>

        {/* Cara bayar + tindak lanjut (IGD) + reset */}
        <div className="mt-4 flex flex-wrap items-end gap-x-6 gap-y-3">
          <div>
            <Label>Cara bayar</Label>
            <Segmented
              options={CARA_BAYAR.map((c) => ({ key: String(c.key), label: c.label }))}
              value={String(caraBayar)}
              onChange={(v) => setCaraBayar(Number(v) as CaraBayar)}
            />
          </div>
          {isIgd && (
            <div>
              <Label>Tindak lanjut IGD</Label>
              <Segmented
                options={TINDAK.map((t) => ({ key: t.key, label: t.label }))}
                value={tindak}
                onChange={(v) => setTindak(v as TindakLanjut)}
              />
            </div>
          )}
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
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          icon={Users}
          label="Total kunjungan"
          value={summary ? formatNumber(summary.total) : "—"}
          hint={summary ? `${formatNumber(summary.baru)} baru · ${formatNumber(summary.lama)} lama` : ""}
          loading={loading}
          accent
        />
        <StatTile
          icon={UserPlus}
          label="Pasien baru"
          value={summary ? formatNumber(summary.baru) : "—"}
          hint={summary && summary.total > 0 ? `${Math.round((summary.baru / summary.total) * 100)}% dari total` : ""}
          loading={loading}
        />
        <SplitTile
          label="Komposisi L / P"
          aLabel="L"
          bLabel="P"
          a={summary?.lk ?? 0}
          b={summary?.pr ?? 0}
          loading={loading}
        />
        {isIgd ? (
          <SplitTile
            icon={ArrowRightLeft}
            label="Tindak lanjut IGD"
            aLabel="Rawat Jalan"
            bLabel="Rawat Inap"
            a={summary?.igdRajal ?? 0}
            b={summary?.igdRanap ?? 0}
            loading={loading}
          />
        ) : (
          <StatTile
            icon={Clock}
            label="Pasien lama"
            value={summary ? formatNumber(summary.lama) : "—"}
            hint={summary && summary.total > 0 ? `${Math.round((summary.lama / summary.total) * 100)}% dari total` : ""}
            loading={loading}
          />
        )}
      </div>

      {/* Tabel */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-fg">
            Daftar kunjungan · {jenisLabel(jenis)}
          </h3>
          <p className="text-[11px] text-fg-subtle">
            {formatDate(from)} – {formatDate(to)}
          </p>
        </div>
        {meta && !loading && (
          <span className="text-xs text-fg-subtle tabular">{formatNumber(meta.total)} kunjungan</span>
        )}
      </div>

      <Card className="overflow-hidden p-0">
        {loading ? (
          <TableSkeleton igd={isIgd} />
        ) : error ? (
          <ErrorState onRetry={reload} />
        ) : items.length === 0 ? (
          <EmptyState
            title="Tidak ada kunjungan"
            description="Tidak ada data untuk periode & filter ini. Coba perlebar periode, ganti jenis layanan, atau ubah ruangan."
          />
        ) : (
          <>
            <Table>
              <THead>
                <TH className="w-10 text-center">No</TH>
                <TH>Pasien</TH>
                <TH className="text-center">JK</TH>
                <TH className="text-center">Umur</TH>
                <TH className="text-center">Status</TH>
                <TH className="hidden md:table-cell">NOPEN</TH>
                <TH className="hidden lg:table-cell">Tgl Registrasi</TH>
                <TH>Unit Pelayanan</TH>
                <TH className="hidden xl:table-cell">Cara Bayar</TH>
                <TH className="hidden xl:table-cell">Dokter</TH>
                {isIgd && <TH className="text-center">Tindak Lanjut</TH>}
              </THead>
              <TBody>
                {items.map((it, i) => (
                  <TR key={it.nopen}>
                    <TD className="text-center text-xs text-fg-subtle tabular">
                      {(meta ? (meta.page - 1) * meta.pageSize : 0) + i + 1}
                    </TD>
                    <TD>
                      <div className="min-w-0">
                        <p className="truncate font-medium text-fg" title={it.nama}>
                          {it.nama}
                        </p>
                        <p className="font-mono text-[11px] text-fg-subtle">{it.norm}</p>
                      </div>
                    </TD>
                    <TD align="center">
                      <span
                        className={cn(
                          "text-xs font-semibold",
                          it.jk === "L" ? "text-accent" : "text-brand",
                        )}
                      >
                        {it.jk}
                      </span>
                    </TD>
                    <TD align="center" className="tabular text-fg-muted">
                      {it.umur} th
                    </TD>
                    <TD align="center">
                      <Badge tone={it.baru ? "success" : "neutral"}>{it.baru ? "Baru" : "Lama"}</Badge>
                    </TD>
                    <TD className="hidden font-mono text-xs text-fg-muted md:table-cell">
                      {it.nopen}
                    </TD>
                    <TD className="hidden text-xs text-fg-muted lg:table-cell tabular">
                      {it.tglReg}
                    </TD>
                    <TD className="text-fg-muted">{it.unit}</TD>
                    <TD className="hidden text-fg-muted xl:table-cell">{it.caraBayar}</TD>
                    <TD className="hidden text-fg-muted xl:table-cell">{it.dokter}</TD>
                    {isIgd && (
                      <TD align="center">
                        <Badge tone={it.tindakLanjut === "ranap" ? "brand" : "accent"}>
                          {it.tindakLanjut === "ranap" ? "→ Rawat Inap" : "Rawat Jalan"}
                        </Badge>
                      </TD>
                    )}
                  </TR>
                ))}
              </TBody>
            </Table>
            {meta && meta.total > 0 && (
              <Pagination meta={meta as PageMeta} onPageChange={setPage} />
            )}
          </>
        )}
      </Card>
    </div>
  );
}

/* --------------------------------------------------------------- stat tiles */

function StatTile({
  icon: Icon,
  label,
  value,
  hint,
  loading,
  accent,
}: {
  icon: typeof Users;
  label: string;
  value: string;
  hint?: string;
  loading: boolean;
  accent?: boolean;
}) {
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-fg-muted">{label}</p>
        <span
          className={cn(
            "flex size-7 items-center justify-center rounded-[var(--radius-md)]",
            accent ? "bg-brand-soft text-brand" : "bg-surface-2 text-fg-muted",
          )}
        >
          <Icon className="size-3.5" />
        </span>
      </div>
      <p className="mt-2 text-2xl font-semibold tabular text-fg">
        {loading ? <span className="text-fg-subtle">—</span> : value}
      </p>
      {hint && !loading && <p className="mt-0.5 truncate text-[11px] text-fg-subtle">{hint}</p>}
    </Card>
  );
}

function SplitTile({
  icon: Icon,
  label,
  aLabel,
  bLabel,
  a,
  b,
  loading,
}: {
  icon?: typeof Users;
  label: string;
  aLabel: string;
  bLabel: string;
  a: number;
  b: number;
  loading: boolean;
}) {
  const total = a + b;
  const aPct = total > 0 ? (a / total) * 100 : 50;
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-fg-muted">{label}</p>
        {Icon && (
          <span className="flex size-7 items-center justify-center rounded-[var(--radius-md)] bg-surface-2 text-fg-muted">
            <Icon className="size-3.5" />
          </span>
        )}
      </div>
      {loading ? (
        <div className="mt-3 space-y-2">
          <Skeleton className="h-2 w-full rounded-full" />
          <Skeleton className="h-3 w-24 rounded" />
        </div>
      ) : (
        <>
          <div className="mt-3 flex h-2.5 w-full overflow-hidden rounded-full bg-surface-2">
            <span className="h-full bg-accent" style={{ width: `${aPct}%` }} />
            <span className="h-full bg-brand" style={{ width: `${100 - aPct}%` }} />
          </div>
          <div className="mt-2 flex items-center justify-between text-[11px] text-fg-muted tabular">
            <span className="inline-flex items-center gap-1">
              <span className="size-1.5 rounded-full bg-accent" />
              {aLabel} {formatNumber(a)}
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="size-1.5 rounded-full bg-brand" />
              {bLabel} {formatNumber(b)}
            </span>
          </div>
        </>
      )}
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
                layoutId={`pengunjung-seg-${options.map((x) => x.key).join()}`}
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

/* ------------------------------------------------------------------ skeleton */

function TableSkeleton({ igd }: { igd: boolean }) {
  return (
    <div className="divide-y divide-border">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 px-4 py-3.5">
          <Skeleton className="size-5 rounded" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-3.5 w-44 rounded" />
            <Skeleton className="h-3 w-20 rounded" />
          </div>
          <Skeleton className="hidden h-5 w-14 rounded-full sm:block" />
          <Skeleton className="hidden h-4 w-28 rounded md:block" />
          {igd && <Skeleton className="hidden h-5 w-20 rounded-full lg:block" />}
        </div>
      ))}
    </div>
  );
}

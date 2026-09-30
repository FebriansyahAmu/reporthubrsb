"use client";

import { useMemo, useState } from "react";
import {
  AlertCircle,
  AlertTriangle,
  Ban,
  BadgeCheck,
  Building2,
  Check,
  Clock,
  FileSpreadsheet,
  FileText,
  HandCoins,
  Hourglass,
  Info,
  RefreshCw,
  RotateCcw,
  type LucideIcon,
} from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { DatePicker } from "@/components/ui/DatePicker";
import { Label } from "@/components/ui/Field";
import { Select } from "@/components/ui/Select";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState, ErrorState } from "@/components/feedback/States";
import { cn } from "@/lib/cn";
import { downloadFromEndpoint } from "@/lib/download";
import { formatJam, formatNumber, formatRupiah } from "@/lib/format";
import { useAsyncData } from "@/lib/useAsyncData";
import {
  BATAS,
  CAKUPAN_DEFAULT,
  infoCakupan,
  LABEL_NILAI,
  LAYANAN,
  STATUS_DEFAULT,
  STATUS_TAGIHAN,
  type CakupanKey,
  type StatusTagihanKey,
} from "@/server/modules/pendapatan-unit/pendapatan.constants";
import type { PendapatanUnitResult, UnitPendapatan } from "@/server/modules/pendapatan-unit/pendapatan.types";
import { LayananTabs } from "./LayananTabs";

/* ------------------------------------------------------------------ periode */

const p2 = (n: number) => String(n).padStart(2, "0");
const ymd = (d: Date) => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
const selisihHari = (a: string, b: string) =>
  Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);

type PresetKey = "bulan-ini" | "bulan-lalu" | "triwulan" | "tahun-ini";

const PRESETS: { key: PresetKey; label: string }[] = [
  { key: "bulan-ini", label: "Bulan ini" },
  { key: "bulan-lalu", label: "Bulan lalu" },
  { key: "triwulan", label: "Triwulan" },
  { key: "tahun-ini", label: "Tahun ini" },
];

function presetRange(key: PresetKey): { from: string; to: string } {
  const now = new Date();
  const today = ymd(now);
  if (key === "bulan-lalu") {
    return {
      from: ymd(new Date(now.getFullYear(), now.getMonth() - 1, 1)),
      to: ymd(new Date(now.getFullYear(), now.getMonth(), 0)),
    };
  }
  if (key === "triwulan") return { from: ymd(new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1)), to: today };
  if (key === "tahun-ini") return { from: ymd(new Date(now.getFullYear(), 0, 1)), to: today };
  return { from: ymd(new Date(now.getFullYear(), now.getMonth(), 1)), to: today };
}

/* ----------------------------------------------------------------- data API */

type Filter = {
  layanan: CakupanKey;
  from: string;
  to: string;
  status: StatusTagihanKey[];
  caraBayar: string;
  ruangan: string;
};

function paramsDari(f: Filter): URLSearchParams {
  const p = new URLSearchParams({ layanan: f.layanan, from: f.from, to: f.to, status: f.status.join(",") });
  if (f.caraBayar !== "0") p.set("caraBayar", f.caraBayar);
  if (f.ruangan) p.set("ruangan", f.ruangan);
  return p;
}

async function fetchPendapatan(f: Filter): Promise<PendapatanUnitResult> {
  const res = await fetch(`/api/laporan/pendapatan-unit?${paramsDari(f).toString()}`);
  if (!res.ok) throw new Error("Gagal memuat data");
  return ((await res.json()) as { data: PendapatanUnitResult }).data;
}

const STATUS_UI: Record<StatusTagihanKey, { icon: LucideIcon; tone: string; soft: string }> = {
  final: { icon: BadgeCheck, tone: "text-success", soft: "bg-success-soft" },
  belum: { icon: Hourglass, tone: "text-warning", soft: "bg-warning-soft" },
  batal: { icon: Ban, tone: "text-danger", soft: "bg-danger-soft" },
};

/* --------------------------------------------------------------------- view */

/** Label unit untuk cakupan: "Semua unit Rawat Inap" / "Semua unit". */
const semuaUnit = (l: CakupanKey) => (l === "semua" ? "Semua unit" : `Semua unit ${infoCakupan(l).label}`);

export function PendapatanUnitView({ bolehEkspor, layananAwal }: { bolehEkspor: boolean; layananAwal: CakupanKey }) {
  const awal = useMemo(() => presetRange("bulan-ini"), []);
  const [layanan, setLayanan] = useState<CakupanKey>(layananAwal);
  const [from, setFrom] = useState(awal.from);
  const [to, setTo] = useState(awal.to);
  const [preset, setPreset] = useState<PresetKey | "">("bulan-ini");
  const [status, setStatus] = useState<StatusTagihanKey[]>([...STATUS_DEFAULT]);
  const [caraBayar, setCaraBayar] = useState("0");
  const [ruangan, setRuangan] = useState("");
  const [exporting, setExporting] = useState<"" | "xlsx" | "pdf">("");
  const [exportError, setExportError] = useState<string | null>(null);

  const rentangSalah =
    from > to
      ? "Tanggal awal melebihi tanggal akhir."
      : selisihHari(from, to) >= BATAS.RENTANG_MAKS_HARI
        ? `Rentang maksimal ${BATAS.RENTANG_MAKS_HARI} hari.`
        : null;

  const filter: Filter = { layanan, from, to, status, caraBayar, ruangan };
  const { result, loading, error, reload } = useAsyncData<PendapatanUnitResult | null>(
    () => (rentangSalah ? Promise.resolve(null) : fetchPendapatan(filter)),
    [layanan, from, to, status.join(","), caraBayar, ruangan],
  );

  function pilihLayanan(key: CakupanKey) {
    if (key === layanan) return;
    setLayanan(key);
    setRuangan(""); // unit milik satu layanan → filter unit dilepas
    // Tautan langsung (?layanan=…) tanpa memicu render ulang server.
    const url = new URL(window.location.href);
    if (key === CAKUPAN_DEFAULT) url.searchParams.delete("layanan");
    else url.searchParams.set("layanan", key);
    window.history.replaceState(window.history.state, "", url);
  }

  const ubahFilter =
    preset !== "bulan-ini" || caraBayar !== "0" || ruangan !== "" || status.join(",") !== STATUS_DEFAULT.join(",");

  function pilihPreset(key: PresetKey) {
    const r = presetRange(key);
    setFrom(r.from);
    setTo(r.to);
    setPreset(key);
  }

  function reset() {
    pilihPreset("bulan-ini");
    setStatus([...STATUS_DEFAULT]);
    setCaraBayar("0");
    setRuangan("");
  }

  function toggleStatus(key: StatusTagihanKey) {
    setStatus((cur) => {
      if (cur.includes(key)) return cur.length > 1 ? cur.filter((s) => s !== key) : cur; // minimal satu status
      return STATUS_TAGIHAN.map((s) => s.key).filter((s) => s === key || cur.includes(s));
    });
  }

  async function ekspor(format: "xlsx" | "pdf") {
    setExporting(format);
    setExportError(null);
    try {
      const p = paramsDari(filter);
      p.set("format", format);
      await downloadFromEndpoint(
        `/api/laporan/pendapatan-unit/export?${p.toString()}`,
        `Pendapatan-Unit-${infoCakupan(layanan).kode}.${format}`,
      );
    } catch (e) {
      setExportError(e instanceof Error ? e.message : "Gagal mengekspor laporan.");
    } finally {
      setExporting("");
    }
  }

  const bisaEkspor = !!result && !loading && !rentangSalah && result.units.length > 0;

  return (
    <div className="space-y-5">
      {/* Status & aksi */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm text-fg-muted">
          <Clock className="size-4" aria-hidden />
          {result ? (
            <span className="tabular">Data SIMGOS pukul {formatJam(result.meta.dihitungPada)}</span>
          ) : (
            <span>{loading ? "Memuat…" : "—"}</span>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            icon={<RefreshCw className={cn("size-4", loading && "animate-spin")} aria-hidden />}
            onClick={() => reload()}
          >
            Muat ulang
          </Button>
          {bolehEkspor && (
            <>
              <Button
                variant="secondary"
                size="sm"
                icon={<FileText className="size-4" aria-hidden />}
                loading={exporting === "pdf"}
                disabled={!bisaEkspor || exporting !== ""}
                onClick={() => ekspor("pdf")}
              >
                Export PDF
              </Button>
              <Button
                size="sm"
                icon={<FileSpreadsheet className="size-4" aria-hidden />}
                loading={exporting === "xlsx"}
                disabled={!bisaEkspor || exporting !== ""}
                onClick={() => ekspor("xlsx")}
              >
                Export Excel
              </Button>
            </>
          )}
        </div>
      </div>

      {exportError && (
        <div role="alert" className="flex items-center gap-2 rounded-[var(--radius-md)] border border-danger/30 bg-danger-soft px-3 py-2 text-sm text-danger">
          <AlertCircle className="size-4 shrink-0" aria-hidden />
          {exportError}
        </div>
      )}

      {/* Cakupan layanan */}
      <LayananTabs value={layanan} onChange={pilihLayanan} perLayanan={result?.perLayanan ?? null} />

      {/* Filter */}
      <Card className="space-y-4 p-4">
        <div>
          <Label>Periode (tanggal tagihan)</Label>
          <div className="flex flex-wrap items-center gap-2">
            {PRESETS.map((pr) => (
              <Chip key={pr.key} active={preset === pr.key} onClick={() => pilihPreset(pr.key)}>
                {pr.label}
              </Chip>
            ))}
            <span className="mx-1 hidden h-5 w-px bg-border sm:block" aria-hidden />
            <div className="w-[10.5rem]">
              <DatePicker value={from} onChange={(v) => { setFrom(v); setPreset(""); }} max={to || undefined} clearable={false} />
            </div>
            <span className="text-fg-subtle">–</span>
            <div className="w-[10.5rem]">
              <DatePicker value={to} onChange={(v) => { setTo(v); setPreset(""); }} min={from || undefined} clearable={false} />
            </div>
            {ubahFilter && (
              <button
                type="button"
                onClick={reset}
                className="ml-auto inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-medium text-fg-muted transition-colors hover:bg-surface-2 hover:text-fg"
              >
                <RotateCcw className="size-3.5" aria-hidden />
                Reset
              </button>
            )}
          </div>
          {rentangSalah && <p className="mt-2 text-xs text-danger">{rentangSalah}</p>}
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:max-w-2xl">
          <div>
            <Label htmlFor="pu-cara-bayar">Cara bayar</Label>
            <Select
              id="pu-cara-bayar"
              value={caraBayar}
              onChange={setCaraBayar}
              options={[
                { value: "0", label: "Semua cara bayar" },
                ...(result?.opsi.caraBayar ?? []).map((c) => ({ value: String(c.id), label: c.label })),
              ]}
            />
          </div>
          <div>
            <Label htmlFor="pu-unit">Unit</Label>
            <Select
              id="pu-unit"
              value={ruangan}
              onChange={setRuangan}
              // Opsi milik layanan sebelumnya selama memuat → kunci agar tak memilih unit lintas layanan.
              disabled={loading || result?.layanan.key !== layanan}
              options={[
                { value: "", label: semuaUnit(layanan) },
                ...(result?.layanan.key === layanan ? result.opsi.unit : []).map((u) => ({ value: u.id, label: u.nama })),
              ]}
            />
          </div>
        </div>
      </Card>

      {result?.peringatan.map((p) => (
        <div
          key={p}
          role="status"
          className="flex items-start gap-2 rounded-[var(--radius-md)] border border-warning/30 bg-warning-soft px-3 py-2 text-sm text-warning"
        >
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
          {p}
        </div>
      ))}

      {/* Ringkasan: total + status (klik = masuk/keluar perhitungan) */}
      <section aria-label="Ringkasan pendapatan">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-fg-muted">Total pendapatan</p>
              <span className="flex size-7 items-center justify-center rounded-[var(--radius-md)] bg-brand-soft text-brand">
                <HandCoins className="size-3.5" aria-hidden />
              </span>
            </div>
            <p className="mt-2 text-2xl font-semibold tabular text-fg">
              {loading || !result ? <span className="text-fg-subtle">—</span> : formatRupiah(result.total.total)}
            </p>
            {result && !loading && (
              <p className="mt-0.5 text-[11px] text-fg-subtle">
                {formatNumber(result.total.tagihan)} tagihan · {result.units.filter((u) => u.nilai.total > 0).length} unit berpendapatan
              </p>
            )}
          </Card>
          {STATUS_TAGIHAN.map((s) => (
            <StatusTile
              key={s.key}
              label={s.label}
              deskripsi={s.deskripsi}
              ui={STATUS_UI[s.key]}
              dipilih={status.includes(s.key)}
              terakhir={status.length === 1 && status.includes(s.key)}
              ringkas={result?.perStatus[s.key] ?? null}
              loading={loading}
              onToggle={() => toggleStatus(s.key)}
            />
          ))}
        </div>
        <p className="mt-2 text-[11px] text-fg-subtle">
          Klik kartu status untuk memasukkan atau mengeluarkannya dari perhitungan. Angka pada kartu selalu menampilkan semua status.
        </p>
      </section>

      {/* Tabel per unit */}
      <UnitTable
        layanan={layanan}
        result={result}
        loading={loading}
        error={error}
        reload={reload}
        rentangSalah={rentangSalah}
      />

      {result && <CakupanCard result={result} />}
    </div>
  );
}

/* ------------------------------------------------------------- status tile */

function StatusTile({
  label,
  deskripsi,
  ui,
  dipilih,
  terakhir,
  ringkas,
  loading,
  onToggle,
}: {
  label: string;
  deskripsi: string;
  ui: { icon: LucideIcon; tone: string; soft: string };
  dipilih: boolean;
  terakhir: boolean;
  ringkas: { tagihan: number; total: number } | null;
  loading: boolean;
  onToggle: () => void;
}) {
  const Icon = ui.icon;
  return (
    <button
      type="button"
      aria-pressed={dipilih}
      disabled={terakhir}
      onClick={onToggle}
      title={terakhir ? "Minimal satu status harus dihitung" : dipilih ? "Keluarkan dari perhitungan" : "Masukkan ke perhitungan"}
      className={cn(
        "group rounded-[var(--radius-lg)] border bg-surface p-4 text-left shadow-xs transition-all",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring",
        dipilih ? "border-brand/40" : "border-dashed border-border opacity-75 hover:opacity-100",
        !terakhir && "hover:shadow-sm",
        terakhir && "cursor-default",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className={cn("inline-flex items-center gap-1.5 text-xs font-semibold", ui.tone)}>
          <span className={cn("flex size-6 items-center justify-center rounded-[var(--radius-md)]", ui.soft)}>
            <Icon className="size-3.5" aria-hidden />
          </span>
          {label}
        </span>
        <span
          className={cn(
            "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium",
            dipilih ? "bg-brand-soft text-brand-soft-fg" : "bg-surface-2 text-fg-subtle",
          )}
        >
          {dipilih && <Check className="size-3" aria-hidden />}
          {dipilih ? "Dihitung" : "Tidak dihitung"}
        </span>
      </div>
      <p className="mt-2 text-xl font-semibold tabular text-fg">
        {loading || !ringkas ? <span className="text-fg-subtle">—</span> : formatRupiah(ringkas.total)}
      </p>
      <p className="mt-0.5 truncate text-[11px] text-fg-subtle">
        {ringkas && !loading ? `${formatNumber(ringkas.tagihan)} tagihan · ${deskripsi}` : deskripsi}
      </p>
    </button>
  );
}

/* --------------------------------------------------------------- unit table */

/** Unit dikelompokkan per layanan (urutan katalog) — hanya untuk cakupan Semua Layanan. */
function kelompokLayanan(units: readonly UnitPendapatan[]) {
  return LAYANAN.map((l) => ({ layanan: l, units: units.filter((u) => u.layanan === l.key) })).filter(
    (g) => g.units.length > 0,
  );
}

function UnitTable({
  layanan,
  result,
  loading,
  error,
  reload,
  rentangSalah,
}: {
  layanan: CakupanKey;
  result: PendapatanUnitResult | null;
  loading: boolean;
  error: boolean;
  reload: () => void;
  rentangSalah: string | null;
}) {
  return (
    <section aria-labelledby="pu-tabel-judul" className="space-y-3">
      <div>
        <h3 id="pu-tabel-judul" className="text-sm font-semibold text-fg">
          Pendapatan per Unit
        </h3>
        <p className="text-[11px] text-fg-subtle">
          {LABEL_NILAI} (Rp) — gabungan seluruh komponen jasa sesuai tarif master SIMGOS
        </p>
      </div>

      <Card className="overflow-hidden p-0">
        {rentangSalah ? (
          <EmptyState title="Periode belum valid" description={rentangSalah} />
        ) : loading ? (
          <TableSkeleton />
        ) : error || !result ? (
          <ErrorState onRetry={reload} />
        ) : result.units.length === 0 ? (
          <EmptyState
            title="Tidak ada unit"
            description={`Tidak ada unit ${infoCakupan(layanan).label} dalam cakupan untuk filter ini.`}
          />
        ) : (
          <div className="max-h-[64vh] overflow-auto">
            <table className="w-full border-collapse text-sm">
              <thead className="sticky top-0 z-10 bg-surface-2">
                <tr className="border-b border-border text-xs font-semibold uppercase tracking-wide text-fg-muted">
                  <th scope="col" className="sticky left-0 z-10 bg-surface-2 px-4 py-3 text-left">Unit</th>
                  <th scope="col" className="px-3 py-3 text-right">Tagihan</th>
                  <th scope="col" className="px-3 py-3 text-right text-fg">{LABEL_NILAI}</th>
                  <th scope="col" className="min-w-[8rem] px-4 py-3 text-left">Porsi</th>
                </tr>
              </thead>
              {result.layanan.key === "semua" ? (
                kelompokLayanan(result.units).map((g) => (
                  <GrupLayanan
                    key={g.layanan.key}
                    label={g.layanan.label}
                    units={g.units}
                    grandTotal={result.total.total}
                  />
                ))
              ) : (
                <tbody>
                  {result.units.map((u) => (
                    <UnitRow key={u.id} unit={u} />
                  ))}
                </tbody>
              )}
              <tfoot className="sticky bottom-0 z-10 shadow-[0_-1px_0_var(--border)]">
                <tr className="border-t-2 border-border bg-surface-2 font-semibold">
                  <th scope="row" className="sticky left-0 bg-surface-2 px-4 py-3 text-left text-fg">TOTAL</th>
                  <td className="px-3 py-3 text-right tabular">{formatNumber(result.total.tagihan)}</td>
                  <td className="whitespace-nowrap px-3 py-3 text-right tabular text-fg">{formatRupiah(result.total.total)}</td>
                  <td className="px-4 py-3 text-xs text-fg-muted">100%</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </Card>
    </section>
  );
}

const persen = (porsi: number) => Math.round(porsi * 1000) / 10;

/** Satu layanan: baris judul + subtotal (nilai & porsi), lalu baris unitnya. */
function GrupLayanan({
  label,
  units,
  grandTotal,
}: {
  label: string;
  units: readonly UnitPendapatan[];
  grandTotal: number;
}) {
  const subtotal = units.reduce((a, u) => a + u.nilai.total, 0);
  const pct = persen(grandTotal > 0 ? subtotal / grandTotal : 0);
  return (
    <tbody className="border-b border-border last:border-0">
      <tr className="border-b border-border bg-surface-2 text-xs">
        <th
          scope="rowgroup"
          className="sticky left-0 bg-surface-2 px-4 py-2 text-left font-semibold uppercase tracking-wide text-fg-muted"
        >
          {label} <span className="font-normal normal-case tracking-normal text-fg-subtle">· {units.length} unit</span>
        </th>
        <td />
        <td className="whitespace-nowrap px-3 py-2 text-right font-semibold tabular text-fg">{formatRupiah(subtotal)}</td>
        <td className="px-4 py-2 tabular text-fg-muted">{pct.toLocaleString("id-ID")}%</td>
      </tr>
      {units.map((u) => (
        <UnitRow key={u.id} unit={u} />
      ))}
    </tbody>
  );
}

function UnitRow({ unit: u }: { unit: UnitPendapatan }) {
  const pct = persen(u.porsi);
  return (
    <tr className="border-b border-border transition-colors last:border-0 hover:bg-surface-2/50">
      <th scope="row" className="sticky left-0 bg-surface px-4 py-3 text-left font-medium text-fg">
        <span className="block min-w-[10rem]">{u.nama}</span>
        <span className="font-mono text-[11px] font-normal text-fg-subtle">
          {u.id}
          {!u.aktif && " · nonaktif"}
        </span>
      </th>
      <td className="px-3 py-3 text-right tabular text-fg-muted">{u.tagihan ? formatNumber(u.tagihan) : <Nol />}</td>
      <td className="whitespace-nowrap px-3 py-3 text-right font-semibold tabular text-fg">
        {u.nilai.total ? formatRupiah(u.nilai.total) : <Nol />}
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="h-1.5 w-20 overflow-hidden rounded-full bg-surface-2" aria-hidden>
            <div className="h-full rounded-full bg-brand" style={{ width: `${Math.min(100, pct)}%` }} />
          </div>
          <span className="text-xs tabular text-fg-muted">{pct.toLocaleString("id-ID")}%</span>
        </div>
      </td>
    </tr>
  );
}

const Nol = () => <span className="text-fg-subtle">–</span>;

/* ------------------------------------------------------------------ cakupan */

function UnitChips({ units }: { units: readonly { id: string; nama: string }[] }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {units.map((r) => (
        <span key={r.id} className="rounded-full border border-border bg-surface-2 px-2.5 py-0.5 text-xs text-fg-muted">
          {r.nama}
        </span>
      ))}
    </div>
  );
}

function CakupanCard({ result }: { result: PendapatanUnitResult }) {
  const semua = result.layanan.key === "semua";
  const info = LAYANAN.find((l) => l.key === result.layanan.key);
  const dialihkan = result.cakupan.dialihkan.map((d) => `${d.nama} → ${infoCakupan(d.ke).label}`).join(", ");
  return (
    <Card className="space-y-3 p-4 text-sm">
      <div className="flex items-center gap-2 font-semibold text-fg">
        <Building2 className="size-4 text-fg-muted" aria-hidden />
        Cakupan laporan
      </div>
      {semua ? (
        <div className="space-y-2.5">
          {LAYANAN.map((l) => {
            const units = result.cakupan.termasuk.filter((u) => u.layanan === l.key);
            return units.length === 0 ? null : (
              <div key={l.key} className="space-y-1.5">
                <p className="text-xs font-medium text-fg">{l.label}</p>
                <UnitChips units={units} />
              </div>
            );
          })}
        </div>
      ) : (
        <UnitChips units={result.cakupan.termasuk} />
      )}
      <ul className="space-y-1 text-xs text-fg-muted">
        <li className="flex gap-2">
          <Info className="mt-0.5 size-3.5 shrink-0 text-fg-subtle" aria-hidden />
          <span>
            {semua ? (
              <>
                <strong className="font-medium text-fg">Semua layanan</strong>. Setiap unit masuk tepat satu layanan
                menurut jenis kunjungan SIMGOS, sehingga jumlah seluruh layanan sama dengan total ini.
              </>
            ) : (
              <>
                Unit <strong className="font-medium text-fg">{result.layanan.label}</strong>
                {info ? ` — ${info.deskripsi}` : ""}, menurut jenis kunjungan SIMGOS.
                {dialihkan && ` Dialihkan ke layanan lain: ${dialihkan}.`}
              </>
            )}
          </span>
        </li>
        <li className="flex gap-2">
          <Info className="mt-0.5 size-3.5 shrink-0 text-fg-subtle" aria-hidden />
          <span>
            Periode dihitung dari <strong className="font-medium text-fg">tanggal tagihan</strong>. Pendapatan
            diatribusikan ke unit tempat layanan diberikan, dengan tarif master SIMGOS (sama seperti SP{" "}
            <span className="font-mono">LaporanPendapatanPerUnit</span>). SP asli hanya menghitung tagihan yang sudah
            dibayar di kasir; laporan ini mencakup semua status tagihan.
          </span>
        </li>
      </ul>
    </Card>
  );
}

/* ---------------------------------------------------------------- controls */

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "inline-flex items-center rounded-full border px-3 py-1.5 text-[13px] font-medium transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring",
        active
          ? "border-brand bg-brand-soft text-brand-soft-fg"
          : "border-border bg-surface text-fg-muted hover:bg-surface-2 hover:text-fg",
      )}
    >
      {children}
    </button>
  );
}

function TableSkeleton() {
  return (
    <div className="divide-y divide-border">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 px-4 py-3">
          <Skeleton className="h-3.5 w-40 rounded" />
          <Skeleton className="h-3.5 w-10 rounded" />
          <Skeleton className="h-3.5 flex-1 rounded" />
          <Skeleton className="h-3.5 w-24 rounded" />
        </div>
      ))}
    </div>
  );
}

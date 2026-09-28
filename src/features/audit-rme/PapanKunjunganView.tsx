"use client";

import { useMemo, useRef, useState } from "react";
import { Ban, CalendarRange, LayoutGrid, Rows3, Search, Stethoscope, UsersRound, X } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Input, InputWithIcon, Label } from "@/components/ui/Field";
import { Switch } from "@/components/ui/Switch";
import { Skeleton } from "@/components/ui/Skeleton";
import { NumberedPagination } from "@/components/ui/NumberedPagination";
import { EmptyState, ErrorState } from "@/components/feedback/States";
import { useAsyncData } from "@/lib/useAsyncData";
import { useDebounce } from "@/lib/useDebounce";
import { addDays, formatDate, formatNumber, toLocalDateInput } from "@/lib/format";
import { cn } from "@/lib/cn";
import { KELOMPOK_LABEL, RENTANG_MAKS_HARI } from "@/server/modules/audit-rme/kunjungan.constants";
import {
  fetchKunjungan,
  fetchRuanganTree,
  type KunjunganFilter,
  type KunjunganPage,
  type RuanganTree,
} from "./audit.client";
import { KunjunganCardView } from "./KunjunganCardView";
import { JejakKunjunganDrawer } from "./JejakKunjunganDrawer";
import { KunjunganRowList } from "./KunjunganRowList";
import { LOKASI_DEFAULT, RuanganChips, RuanganRail, type LokasiSel } from "./RuanganRail";

const PAGE_SIZE = 24;
const PRESETS = [
  { days: 1, label: "Hari ini" },
  { days: 3, label: "3 hari" },
  { days: 7, label: "7 hari" },
  { days: 14, label: "14 hari" },
  { days: RENTANG_MAKS_HARI, label: `${RENTANG_MAKS_HARI} hari` },
];

const todayIso = () => toLocalDateInput(new Date());
const shiftIso = (iso: string, n: number) => toLocalDateInput(addDays(new Date(`${iso}T00:00:00`), n));

/**
 * Papan Kunjungan (Fase 2 · K1): tiap kartu = satu kunjungan pasien dengan
 * jumlah input AKTUAL per kategori RME. Grid + paginasi bernomor (bukan scroll
 * tak berujung); rail ruangan untuk menyaring per jenis/bangsal/ruang.
 */
export function PapanKunjunganView() {
  const [to, setTo] = useState(todayIso);
  const [from, setFrom] = useState(() => shiftIso(todayIso(), -6));
  const [aktif, setAktif] = useState(false);
  const [batal, setBatal] = useState(false);
  const [qInput, setQInput] = useState("");
  const q = useDebounce(qInput.trim(), 350);
  const [sel, setSel] = useState<LokasiSel>(LOKASI_DEFAULT);
  const [mode, setMode] = useState<"kartu" | "ringkas">("kartu");
  const [jejak, setJejak] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const topRef = useRef<HTMLDivElement>(null);

  // Semua pengubah filter mengembalikan ke halaman 1 (tanpa effect).
  const withReset = <A extends unknown[]>(fn: (...a: A) => void) => (...a: A) => {
    fn(...a);
    setPage(1);
  };

  const qValid = q.length === 0 || q.length >= 2;
  const base: KunjunganFilter = useMemo(
    () => ({ from, to, aktif, batal, q: qValid && q ? q : undefined }),
    [from, to, aktif, batal, q, qValid],
  );
  const filter: KunjunganFilter = useMemo(
    () => ({ ...base, kelompok: sel.kelompok, jenis: sel.jenis, ruangan: sel.ruangan, page, pageSize: PAGE_SIZE }),
    [base, sel, page],
  );

  const board = useAsyncData<KunjunganPage>(() => fetchKunjungan(filter), [JSON.stringify(filter)]);
  const tree = useAsyncData<RuanganTree>(() => fetchRuanganTree(base), [JSON.stringify(base)]);
  const data = board.result;

  const activePreset = PRESETS.find((p) => to === todayIso() && from === shiftIso(to, -(p.days - 1)))?.days;
  const lokasiLabel = useMemo(() => describeLokasi(tree.result, sel), [tree.result, sel]);

  function gotoPage(p: number) {
    setPage(p);
    topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <div ref={topRef} className="scroll-mt-4 space-y-4">
      {/* Toolbar */}
      <Card className="p-4">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-end">
          <div className="min-w-0">
            <Label>Rentang</Label>
            <div className="flex flex-wrap gap-1 rounded-[var(--radius-md)] border border-border bg-surface-2 p-1">
              {PRESETS.map((p) => (
                <button
                  key={p.days}
                  type="button"
                  aria-pressed={activePreset === p.days}
                  onClick={withReset(() => {
                    const t = todayIso();
                    setTo(t);
                    setFrom(shiftIso(t, -(p.days - 1)));
                  })}
                  className={cn(
                    "rounded-[var(--radius-sm)] px-2.5 py-1.5 text-xs font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring",
                    activePreset === p.days ? "bg-surface text-fg shadow-xs" : "text-fg-muted hover:text-fg",
                  )}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:w-[300px]">
            <div>
              <Label htmlFor="pk-from">Dari</Label>
              <Input
                id="pk-from"
                type="date"
                value={from}
                min={shiftIso(to, -(RENTANG_MAKS_HARI - 1))}
                max={to}
                onChange={withReset((e: React.ChangeEvent<HTMLInputElement>) => e.target.value && setFrom(e.target.value))}
              />
            </div>
            <div>
              <Label htmlFor="pk-to">Sampai</Label>
              <Input
                id="pk-to"
                type="date"
                value={to}
                min={from}
                max={todayIso()}
                onChange={withReset((e: React.ChangeEvent<HTMLInputElement>) => {
                  const v = e.target.value;
                  if (!v) return;
                  setTo(v);
                  // Jaga rentang ≤ batas maksimal agar API tidak menolak.
                  if (from < shiftIso(v, -(RENTANG_MAKS_HARI - 1))) setFrom(shiftIso(v, -(RENTANG_MAKS_HARI - 1)));
                  if (from > v) setFrom(v);
                })}
              />
            </div>
          </div>
          <div className="min-w-0 flex-1">
            <Label htmlFor="pk-q">Cari pasien</Label>
            <InputWithIcon
              id="pk-q"
              icon={<Search className="size-4" />}
              placeholder="Nama pasien atau No. RM…"
              value={qInput}
              onChange={withReset((e: React.ChangeEvent<HTMLInputElement>) => setQInput(e.target.value))}
            />
          </div>
          <div className="flex flex-wrap items-center gap-4 xl:pb-2">
            <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-fg">
              <Switch checked={aktif} onChange={withReset(setAktif)} label="Hanya sedang dilayani" />
              Sedang dilayani
            </label>
            <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-fg">
              <Switch checked={batal} onChange={withReset(setBatal)} tone="danger" label="Tampilkan kunjungan batal" />
              Tampilkan batal
            </label>
          </div>
        </div>
      </Card>

      {/* Ringkasan */}
      <div className="flex flex-wrap items-center gap-2">
        <SummaryChip icon={Stethoscope} label="Kunjungan" value={data?.summary.total} />
        <SummaryChip icon={UsersRound} label="Sedang dilayani" value={data?.summary.aktif} tone="accent" />
        {batal && <SummaryChip icon={Ban} label="Batal" value={data?.summary.batal} tone="danger" />}
        <span className="inline-flex items-center gap-1.5 text-xs text-fg-muted">
          <CalendarRange className="size-3.5" />
          {formatDate(from)} – {formatDate(to)}
          {lokasiLabel && (
            <button
              type="button"
              onClick={withReset(() => setSel({}))}
              className="ml-1 inline-flex items-center gap-1 rounded-full bg-brand-soft px-2 py-0.5 font-medium text-brand hover:bg-brand-soft/70"
              aria-label={`Hapus filter lokasi ${lokasiLabel}`}
            >
              {lokasiLabel} <X className="size-3" />
            </button>
          )}
        </span>
        <div className="ml-auto inline-flex rounded-[var(--radius-md)] border border-border bg-surface-2 p-0.5" role="group" aria-label="Mode tampilan">
          {([
            { key: "kartu", label: "Kartu", icon: LayoutGrid },
            { key: "ringkas", label: "Ringkas", icon: Rows3 },
          ] as const).map((m) => (
            <button
              key={m.key}
              type="button"
              aria-pressed={mode === m.key}
              onClick={() => setMode(m.key)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-[var(--radius-sm)] px-2.5 py-1 text-xs font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring",
                mode === m.key ? "bg-surface text-fg shadow-xs" : "text-fg-muted hover:text-fg",
              )}
            >
              <m.icon className="size-3.5" />
              {m.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[264px_minmax(0,1fr)]">
        {/* Rail ruangan */}
        <aside className="hidden lg:block">
          <div className="sticky top-4 max-h-[calc(100vh-2rem)] overflow-y-auto">
            <RuanganRail tree={tree.result} loading={tree.loading} sel={sel} onSelect={withReset(setSel)} />
          </div>
        </aside>
        <div className="lg:hidden">
          <RuanganChips tree={tree.result} sel={sel} onSelect={withReset(setSel)} />
        </div>

        {/* Grid kartu */}
        <section aria-label="Daftar kunjungan" aria-busy={board.loading} className="min-w-0 space-y-4">
          {board.loading && !data ? (
            <BoardSkeleton />
          ) : board.error ? (
            <Card className="overflow-hidden"><ErrorState onRetry={board.reload} /></Card>
          ) : !data || data.items.length === 0 ? (
            <Card className="overflow-hidden">
              <EmptyState
                title="Tidak ada kunjungan"
                description={!qValid ? "Ketik minimal 2 karakter untuk mencari." : "Tidak ada kunjungan pada rentang & filter ini. Coba perlebar rentang atau pilih ruangan lain."}
              />
            </Card>
          ) : (
            <>
              <div className={cn("relative transition-opacity", board.loading && "pointer-events-none opacity-60")}>
                {board.loading && <div className="absolute inset-x-0 -top-2 h-0.5 animate-pulse rounded-full bg-brand" aria-hidden />}
                {mode === "ringkas" ? (
                  <KunjunganRowList items={data.items} onOpen={setJejak} />
                ) : (
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    {data.items.map((k) => <KunjunganCardView key={k.nomor} k={k} onOpen={() => setJejak(k.nomor)} />)}
                  </div>
                )}
              </div>

              <div className="flex flex-col items-center justify-between gap-3 sm:flex-row">
                <p className="text-xs text-fg-muted">
                  Menampilkan{" "}
                  <b className="tabular text-fg">
                    {formatNumber((data.page - 1) * data.pageSize + 1)}–{formatNumber((data.page - 1) * data.pageSize + data.items.length)}
                  </b>{" "}
                  dari <b className="tabular text-fg">{formatNumber(data.summary.total)}</b> kunjungan
                </p>
                <NumberedPagination page={data.page} totalPages={data.totalPages} onPageChange={gotoPage} disabled={board.loading} />
              </div>
              <PipLegend />
            </>
          )}
        </section>
      </div>

      <JejakKunjunganDrawer nomor={jejak} onClose={() => setJejak(null)} />
    </div>
  );
}

function describeLokasi(tree: RuanganTree | null, sel: LokasiSel): string | null {
  if (sel.jenis == null && !sel.ruangan) return sel.kelompok ? KELOMPOK_LABEL[sel.kelompok] : null;
  const j = tree?.jenis.find((x) => x.jenis === sel.jenis);
  if (!sel.ruangan) return j?.label ?? "Jenis terpilih";
  for (const jn of tree?.jenis ?? []) {
    for (const g of jn.grup) {
      if (g.id === sel.ruangan) return g.nama;
      const r = g.ruang.find((x) => x.id === sel.ruangan);
      if (r) return r.nama;
    }
  }
  return sel.ruangan;
}

function SummaryChip({
  icon: Icon,
  label,
  value,
  tone = "neutral",
}: {
  icon: typeof Stethoscope;
  label: string;
  value: number | undefined;
  tone?: "neutral" | "accent" | "danger";
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs",
        tone === "accent" ? "border-accent/25 bg-accent-soft text-accent" : tone === "danger" ? "border-danger/25 bg-danger-soft text-danger" : "border-border bg-surface text-fg-muted",
      )}
    >
      <Icon className="size-3.5" />
      {label}
      <b className="tabular text-sm text-fg">{value == null ? "…" : formatNumber(value)}</b>
    </span>
  );
}

function PipLegend() {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 rounded-[var(--radius-md)] border border-dashed border-border px-3 py-2 text-[11px] text-fg-muted">
      <span className="font-medium text-fg">Keterangan:</span>
      <span className="inline-flex items-center gap-1.5"><span className="size-3 rounded-sm border border-success/25 bg-success-soft" /> terisi (angka = input aktif)</span>
      <span className="inline-flex items-center gap-1.5"><span className="size-3 rounded-sm border border-danger/30 bg-danger-soft" /> wajib, belum diisi (0)</span>
      <span className="inline-flex items-center gap-1.5"><span className="size-3 rounded-sm border border-border bg-surface-2" /> tidak wajib (–)</span>
      <span className="inline-flex items-center gap-1"><Ban className="size-3 text-danger" /> batal/dihapus (STATUS 0)</span>
      <span>
        <b className="text-fg">ASM</b> Asesmen · <b className="text-fg">CPPT</b> · <b className="text-fg">TTV</b> Tanda vital · <b className="text-fg">DX<sup>e</sup></b> Diagnosis (per episode) · <b className="text-fg">TIN</b> Tindakan
      </span>
    </div>
  );
}

function BoardSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <Card key={i} className="space-y-3 p-4">
          <div className="flex items-center gap-3">
            <Skeleton className="size-10 rounded-full" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-3.5 w-40 rounded" />
              <Skeleton className="h-3 w-24 rounded" />
            </div>
          </div>
          <Skeleton className="h-3 w-52 rounded" />
          <div className="grid grid-cols-5 gap-1.5">
            {Array.from({ length: 5 }).map((__, j) => <Skeleton key={j} className="h-14 rounded-md" />)}
          </div>
          <Skeleton className="h-8 rounded" />
        </Card>
      ))}
    </div>
  );
}

"use client";

import { useMemo, useState } from "react";
import { Ban, ChevronRight, Info, MapPinned, Stethoscope, UsersRound } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { Drawer } from "@/components/ui/Drawer";
import { Input, Label } from "@/components/ui/Field";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState, ErrorState } from "@/components/feedback/States";
import { useAsyncData } from "@/lib/useAsyncData";
import { addDays, formatDate, formatNumber, toLocalDateInput } from "@/lib/format";
import { cn } from "@/lib/cn";
import {
  JENIS_DINILAI,
  JENIS_KUNJUNGAN,
  JENIS_RAWAT_INAP,
  KATEGORI,
  RENTANG_MAKS_HARI,
  RENTANG_PETA_DEFAULT_HARI,
  SHIFTS,
  TARGET_RI,
} from "@/server/modules/audit-rme/kunjungan.constants";
import {
  fetchPetaRuangan,
  fetchRuanganTree,
  type PetaBaris,
  type PetaFilter,
  type PetaItem,
  type PetaRuangan,
  type PetaSel,
  type RuanganTree,
} from "./audit.client";
import { EksporMenu } from "./Ekspor";
import { JejakKunjunganDrawer } from "./JejakKunjunganDrawer";
import { fmtWaktu } from "./KunjunganCardView";
import { SEL_LABEL } from "@/server/modules/audit-rme/kepatuhan";
import { SEL_STYLE, StatusIcon } from "./MatriksShiftView";

const PRESETS = [7, RENTANG_PETA_DEFAULT_HARI, RENTANG_MAKS_HARI];
const todayIso = () => toLocalDateInput(new Date());
const shiftIso = (iso: string, n: number) => toLocalDateInput(addDays(new Date(`${iso}T00:00:00`), n));

/**
 * Pita kepatuhan = status (angka % selalu tertulis di sel, bukan warna saja).
 * Batas ≥ 85 selaras target mutu umum; < 30 ditandai paling tegas.
 */
const PITA = [
  { min: 85, cls: "bg-success text-white", label: "≥ 85%" },
  { min: 70, cls: "bg-success-soft text-success", label: "70–84%" },
  { min: 50, cls: "bg-warning-soft text-warning", label: "50–69%" },
  { min: 30, cls: "bg-danger-soft text-danger", label: "30–49%" },
  { min: 0, cls: "bg-danger text-white", label: "< 30%" },
] as const;
const pitaOf = (p: number) => PITA.find((b) => p >= b.min)!.cls;

const hariFmt = new Intl.DateTimeFormat("id-ID", { weekday: "narrow", timeZone: "UTC" });
const tglPanjang = new Intl.DateTimeFormat("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
const utc = (iso: string) => new Date(`${iso}T00:00:00Z`);

type Pilih = { baris: PetaBaris; sel: PetaSel };

/**
 * Peta Ruangan (Fase 2 · K4): heatmap ruang × hari. RI = kepatuhan target
 * harian (logika matriks K2); jenis lain = kelengkapan kunjungan (logika kartu
 * K1). Klik sel → daftar pasien → jejak kunjungan.
 */
export function PetaRuanganView() {
  const [to, setTo] = useState(todayIso);
  const [from, setFrom] = useState(() => shiftIso(todayIso(), -(RENTANG_PETA_DEFAULT_HARI - 1)));
  const [jenis, setJenis] = useState<number>(JENIS_RAWAT_INAP);
  const [pilih, setPilih] = useState<Pilih | null>(null);
  const [jejak, setJejak] = useState<string | null>(null);

  const filter: PetaFilter = useMemo(() => ({ from, to, jenis }), [from, to, jenis]);
  const peta = useAsyncData<PetaRuangan>(() => fetchPetaRuangan(filter), [JSON.stringify(filter)]);
  const tree = useAsyncData<RuanganTree>(() => fetchRuanganTree({ from, to }), [from, to]);
  const d = peta.result;
  const activePreset = PRESETS.find((n) => to === todayIso() && from === shiftIso(to, -(n - 1)));

  const jenisOpsi = useMemo(() => {
    const total = new Map((tree.result?.jenis ?? []).map((j) => [j.jenis, j.total]));
    return JENIS_DINILAI.map((id) => ({ id, label: JENIS_KUNJUNGAN[id]?.label ?? `Jenis ${id}`, n: total.get(id) ?? 0 })).filter(
      (j) => j.n > 0 || j.id === jenis,
    );
  }, [tree.result, jenis]);

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-end">
          <div>
            <Label>Rentang</Label>
            <div className="flex flex-wrap gap-1 rounded-[var(--radius-md)] border border-border bg-surface-2 p-1">
              {PRESETS.map((n) => (
                <button
                  key={n}
                  type="button"
                  aria-pressed={activePreset === n}
                  onClick={() => {
                    const t = todayIso();
                    setTo(t);
                    setFrom(shiftIso(t, -(n - 1)));
                  }}
                  className={cn(
                    "rounded-[var(--radius-sm)] px-2.5 py-1.5 text-xs font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring",
                    activePreset === n ? "bg-surface text-fg shadow-xs" : "text-fg-muted hover:text-fg",
                  )}
                >
                  {n} hari
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:w-[300px]">
            <div>
              <Label htmlFor="pr-from">Dari</Label>
              <Input id="pr-from" type="date" value={from} min={shiftIso(to, -(RENTANG_MAKS_HARI - 1))} max={to} onChange={(e) => e.target.value && setFrom(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="pr-to">Sampai</Label>
              <Input
                id="pr-to"
                type="date"
                value={to}
                min={from}
                max={todayIso()}
                onChange={(e) => {
                  const v = e.target.value;
                  if (!v) return;
                  setTo(v);
                  if (from < shiftIso(v, -(RENTANG_MAKS_HARI - 1))) setFrom(shiftIso(v, -(RENTANG_MAKS_HARI - 1)));
                  if (from > v) setFrom(v);
                }}
              />
            </div>
          </div>
          <div className="min-w-0 flex-1">
            <Label>Jenis layanan</Label>
            <div className="flex flex-wrap gap-1.5" role="group" aria-label="Jenis layanan">
              {jenisOpsi.map((j) => (
                <button
                  key={j.id}
                  type="button"
                  aria-pressed={jenis === j.id}
                  onClick={() => setJenis(j.id)}
                  className={cn(
                    "inline-flex h-9 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring",
                    jenis === j.id ? "border-brand bg-brand text-white" : "border-border bg-surface text-fg-muted hover:text-fg",
                  )}
                >
                  {j.label}
                  <span className={cn("tabular", jenis === j.id ? "text-white/80" : "text-fg-subtle")}>{formatNumber(j.n)}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="self-start xl:self-end">
            <EksporMenu laporan="ruangan" params={filter} disabled={!d || d.baris.length === 0} />
          </div>
        </div>
      </Card>

      {peta.loading && !d ? (
        <PetaSkeleton />
      ) : peta.error ? (
        <Card className="overflow-hidden"><ErrorState onRetry={peta.reload} /></Card>
      ) : !d || d.baris.length === 0 ? (
        <Card className="overflow-hidden"><EmptyState title="Tidak ada kunjungan" description="Tidak ada kunjungan jenis ini pada rentang terpilih." /></Card>
      ) : (
        <div className={cn("space-y-4 transition-opacity", peta.loading && "pointer-events-none opacity-60")}>
          <Keterangan d={d} />
          <Ringkasan d={d} />
          <Heatmap d={d} onPilih={setPilih} />
          <TabelRuang d={d} />
        </div>
      )}

      <SelDrawer pilih={pilih} d={d} onClose={() => setPilih(null)} onOpen={setJejak} tertumpuk={!!jejak} />
      <JejakKunjunganDrawer nomor={jejak} onClose={() => setJejak(null)} />
    </div>
  );
}

/* ------------------------------------------------------------- penjelasan */

function Keterangan({ d }: { d: PetaRuangan }) {
  const ri = d.metrik === "HARIAN_RI";
  return (
    <p className="flex items-start gap-2 rounded-[var(--radius-md)] border border-border bg-surface-2/50 px-3 py-2 text-xs text-fg-muted">
      <Info className="mt-px size-3.5 shrink-0" />
      {ri ? (
        <span>
          <b className="text-fg">Kepatuhan target harian Rawat Inap</b> per hari dinas (07.00–07.00): CPPT keperawatan ≥ {TARGET_RI.cpptPerawatPerShift}/shift,
          visite dokter ≥ {TARGET_RI.cpptDokterPerHari}/hari, TTV ≥ {TARGET_RI.ttvPerHari}/hari. Sel = target terpenuhi ÷ target dinilai, dijumlahkan
          seluruh pasien di ruang tsb. Hanya shift/hari yang utuh dalam masa rawat yang dinilai.
        </span>
      ) : (
        <span>
          <b className="text-fg">Kelengkapan kunjungan {d.jenis.label}</b> per tanggal masuk: kategori wajib yang terisi ÷ kategori wajib, dijumlahkan
          seluruh kunjungan di ruang tsb. Tindakan dihitung tanpa item tarif.
        </span>
      )}
    </p>
  );
}

/* -------------------------------------------------------------- ringkasan */

function Ringkasan({ d }: { d: PetaRuangan }) {
  const ri = d.metrik === "HARIAN_RI";
  const terendah = d.baris.filter((b) => b.ringkas.persen != null).sort((a, b) => a.ringkas.persen! - b.ringkas.persen!)[0];
  const t = d.total;
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
      <Tile label={ri ? "Kepatuhan harian" : "Kelengkapan"} value={t.persen == null ? "—" : `${t.persen}%`} sub={`${formatNumber(t.ok)} dari ${formatNumber(t.dinilai)} target`} tone={t.persen} />
      <Tile label="Ruang terendah" value={terendah ? `${terendah.ringkas.persen}%` : "—"} sub={terendah?.nama ?? "—"} tone={terendah?.ringkas.persen ?? null} />
      <Tile label={ri ? "Pasien-hari" : "Kunjungan"} value={formatNumber(t.pasienHari)} sub={ri ? `${formatNumber(t.kunjungan)} kunjungan` : `${d.baris.length} ruang`} />
      {ri ? (
        <Tile label="Perawat per pasien/hari" value={t.perawatPerPasienHari == null ? "—" : formatNumber(t.perawatPerPasienHari)} sub="perawat/bidan berbeda yang menginput" />
      ) : (
        <Tile label="Petugas penginput" value={formatNumber(t.petugas)} sub="unik, lintas ruang" />
      )}
      <Tile label="Input dibatalkan" value={formatNumber(t.batal)} sub={ri ? `${formatNumber(t.petugas)} petugas penginput` : "STATUS 0 pada kunjungan ini"} />
    </div>
  );
}

function Tile({ label, value, sub, tone }: { label: string; value: string; sub: string; tone?: number | null }) {
  const warna = tone == null ? "text-fg" : tone >= 85 ? "text-success" : tone >= 50 ? "text-warning" : "text-danger";
  return (
    <div className="rounded-[var(--radius-md)] border border-border bg-surface p-3">
      <p className="text-[11px] text-fg-muted">{label}</p>
      <p className={cn("mt-1 text-2xl font-semibold tabular", warna)}>{value}</p>
      <p className="mt-0.5 truncate text-[11px] text-fg-subtle" title={sub}>{sub}</p>
    </div>
  );
}

/* ---------------------------------------------------------------- heatmap */

function Heatmap({ d, onPilih }: { d: PetaRuangan; onPilih: (p: Pilih) => void }) {
  const ri = d.metrik === "HARIAN_RI";
  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-3">
        <MapPinned className="size-4 text-fg-muted" />
        <h3 className="text-sm font-semibold text-fg">{d.jenis.label} · ruang × {ri ? "hari dinas" : "tanggal masuk"}</h3>
        <span className="text-xs text-fg-muted">{formatDate(d.range.from)} – {formatDate(d.range.to)}</span>
      </div>
      <div className="relative overflow-x-auto">
        <table className="w-full border-separate border-spacing-0.5 text-xs" style={{ minWidth: `${240 + d.hari.length * 42}px` }}>
          <thead>
            <tr>
              <th scope="col" className="sticky left-0 z-10 min-w-48 bg-surface px-3 py-1.5 text-left text-[10px] font-semibold tracking-wide text-fg-muted uppercase">Ruang</th>
              {d.hari.map((t) => {
                const u = utc(t);
                const libur = u.getUTCDay() === 0 || u.getUTCDay() === 6;
                return (
                  <th key={t} scope="col" className={cn("px-0.5 py-1 text-center font-normal", libur ? "text-fg-subtle" : "text-fg-muted")} title={tglPanjang.format(u)}>
                    <span className="block text-[9px] uppercase">{hariFmt.format(u)}</span>
                    <span className="block text-[11px] font-semibold tabular">{u.getUTCDate()}</span>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {d.baris.map((b) => (
              <tr key={b.id}>
                <th scope="row" className="sticky left-0 z-10 bg-surface px-3 py-1 text-left align-middle">
                  <span className="flex items-center gap-2">
                    <span className="min-w-0 flex-1">
                      <span className="block max-w-48 truncate text-xs font-medium text-fg" title={b.nama}>{b.nama}</span>
                      {b.grupNama && b.grupNama !== b.nama && <span className="block max-w-48 truncate text-[10px] font-normal text-fg-subtle">{b.grupNama}</span>}
                    </span>
                    <span className={cn("rounded px-1.5 py-0.5 text-[11px] font-semibold tabular", b.ringkas.persen == null ? "text-fg-subtle" : pitaOf(b.ringkas.persen))}>
                      {b.ringkas.persen == null ? "—" : `${b.ringkas.persen}%`}
                    </span>
                  </span>
                </th>
                {b.sel.map((s, i) => (
                  <td key={d.hari[i]} className="p-0">
                    {s ? <SelButton s={s} ruang={b.nama} onClick={() => onPilih({ baris: b, sel: s })} /> : <span className="block h-9 rounded bg-surface-2/40" aria-hidden />}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-border px-4 py-2.5 text-[11px] text-fg-muted">
        {PITA.map((p) => (
          <span key={p.label} className="inline-flex items-center gap-1.5"><span className={cn("size-3 rounded-sm", p.cls.split(" ")[0])} /> {p.label}</span>
        ))}
        <span className="inline-flex items-center gap-1.5"><span className="flex size-3 items-center justify-center rounded-sm border border-dashed border-border-strong text-[8px]">·</span> ada pasien, belum dinilai</span>
        <span className="inline-flex items-center gap-1.5"><span className="size-3 rounded-sm bg-surface-2/40" /> tanpa pasien</span>
        <span className="ml-auto">Klik sel untuk melihat pasien</span>
      </div>
    </Card>
  );
}

function SelButton({ s, ruang, onClick }: { s: PetaSel; ruang: string; onClick: () => void }) {
  const label = `${ruang}, ${tglPanjang.format(utc(s.tanggal))}: ${s.persen == null ? "belum dinilai" : `${s.persen}% (${s.ok}/${s.dinilai})`}, ${s.pasien} pasien${s.batal ? `, ${s.batal} batal` : ""}`;
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className={cn(
        "relative flex h-9 w-full min-w-10 items-center justify-center rounded text-[11px] font-semibold tabular transition-transform hover:scale-110 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring",
        s.persen == null ? "border border-dashed border-border-strong bg-surface text-fg-subtle" : pitaOf(s.persen),
      )}
    >
      {s.persen == null ? "·" : s.persen}
      {s.batal > 0 && <span className="absolute top-0.5 right-0.5 size-1.5 rounded-full bg-danger ring-1 ring-surface" aria-hidden />}
    </button>
  );
}

/* ------------------------------------------------------- tabel per ruang */

function TabelRuang({ d }: { d: PetaRuangan }) {
  const ri = d.metrik === "HARIAN_RI";
  return (
    <Card className="overflow-hidden">
      <div className="border-b border-border px-4 py-3">
        <h3 className="text-sm font-semibold text-fg">Ringkasan per ruang</h3>
      </div>
      <div className="relative overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b border-border bg-surface-2/50 text-left text-[11px] font-semibold tracking-wide text-fg-muted uppercase">
              <th scope="col" className="px-4 py-2">Ruang</th>
              <th scope="col" className="px-2 py-2 text-right">{ri ? "Kepatuhan" : "Kelengkapan"}</th>
              <th scope="col" className="px-2 py-2 text-right">{ri ? "Pasien-hari" : "Kunjungan"}</th>
              {ri && <th scope="col" className="px-2 py-2 text-right">Kunjungan</th>}
              <th scope="col" className="px-2 py-2 text-right">Petugas</th>
              {ri && <th scope="col" className="px-2 py-2 text-right">Perawat/pasien/hari</th>}
              <th scope="col" className="px-4 py-2 text-right">Batal</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {[...d.baris].sort((a, b) => (a.ringkas.persen ?? 101) - (b.ringkas.persen ?? 101)).map((b) => (
              <tr key={b.id}>
                <td className="px-4 py-2 text-fg">{b.nama}</td>
                <td className="px-2 py-2 text-right">
                  <span className={cn("rounded px-1.5 py-0.5 text-xs font-semibold tabular", b.ringkas.persen == null ? "text-fg-subtle" : pitaOf(b.ringkas.persen))}>
                    {b.ringkas.persen == null ? "—" : `${b.ringkas.persen}%`}
                  </span>
                  <span className="ml-1.5 text-[11px] text-fg-subtle tabular">{b.ringkas.ok}/{b.ringkas.dinilai}</span>
                </td>
                <td className="px-2 py-2 text-right tabular">{formatNumber(b.ringkas.pasienHari)}</td>
                {ri && <td className="px-2 py-2 text-right tabular">{formatNumber(b.ringkas.kunjungan)}</td>}
                <td className="px-2 py-2 text-right tabular">{formatNumber(b.ringkas.petugas)}</td>
                {ri && <td className="px-2 py-2 text-right tabular">{b.ringkas.perawatPerPasienHari == null ? "—" : formatNumber(b.ringkas.perawatPerPasienHari)}</td>}
                <td className={cn("px-4 py-2 text-right tabular", b.ringkas.batal ? "text-danger" : "text-fg-muted")}>{formatNumber(b.ringkas.batal)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

/* ----------------------------------------------------------- drawer sel */

function SelDrawer({
  pilih,
  d,
  onClose,
  onOpen,
  tertumpuk,
}: {
  pilih: Pilih | null;
  d: PetaRuangan | null;
  onClose: () => void;
  onOpen: (nomor: string) => void;
  tertumpuk: boolean;
}) {
  const s = pilih?.sel;
  return (
    <Drawer
      open={!!pilih}
      onClose={onClose}
      title="Pasien pada sel peta"
      size="md"
      dismissible={!tertumpuk}
      header={
        pilih && s ? (
          <div className="space-y-1.5">
            <h3 className="text-base font-semibold text-fg">{pilih.baris.nama}</h3>
            <p className="text-xs text-fg-muted">{tglPanjang.format(utc(s.tanggal))}{d?.metrik === "HARIAN_RI" ? " · hari dinas 07.00–07.00" : " · tanggal masuk"}</p>
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className={cn("rounded px-2 py-0.5 font-semibold tabular", s.persen == null ? "bg-surface-2 text-fg-muted" : pitaOf(s.persen))}>
                {s.persen == null ? "Belum dinilai" : `${s.persen}% · ${s.ok}/${s.dinilai} target`}
              </span>
              <span className="inline-flex items-center gap-1 text-fg-muted"><Stethoscope className="size-3.5" /> {s.pasien} pasien</span>
              <span className="inline-flex items-center gap-1 text-fg-muted"><UsersRound className="size-3.5" /> {s.petugas} petugas</span>
              {s.batal > 0 && <span className="inline-flex items-center gap-1 text-danger"><Ban className="size-3.5" /> {s.batal} batal</span>}
            </div>
          </div>
        ) : null
      }
    >
      {s && d && (
        <ul className="divide-y divide-border">
          {[...s.items].sort(urutItem).map((it) => (
            <li key={it.nomor}>
              <button
                type="button"
                onClick={() => onOpen(it.nomor)}
                className="flex w-full items-start gap-3 px-5 py-3 text-left transition-colors hover:bg-surface-2/60 focus-visible:bg-surface-2/60 focus-visible:outline-none"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-fg">{d.pasien[it.nomor]?.nama ?? "Tanpa nama"}</span>
                  <span className="block text-[11px] text-fg-muted">
                    <span className="font-mono">RM {d.pasien[it.nomor]?.norm ?? "—"}</span>
                    {it.tipe === "RI" ? <> · Hari ke-{it.hariKe}</> : <> · masuk {fmtWaktu(d.pasien[it.nomor]?.masuk ?? null)}</>}
                  </span>
                  {it.tipe === "RI" ? <RincianRi it={it} /> : <RincianKel it={it} />}
                </span>
                <ChevronRight className="mt-1 size-4 shrink-0 text-fg-subtle" aria-label="Buka jejak kunjungan" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </Drawer>
  );
}

/** Pasien dengan kepatuhan terendah dulu (yang perlu ditindaklanjuti). */
function urutItem(a: PetaItem, b: PetaItem): number {
  const skor = (x: PetaItem) =>
    x.tipe === "KEL" ? (x.persen ?? 101) : [...x.shift, x.dokter, x.ttv].filter((s) => s === "OK").length - [...x.shift, x.dokter, x.ttv].filter((s) => s === "KURANG").length * 2;
  return skor(a) - skor(b);
}

function RincianRi({ it }: { it: Extract<PetaItem, { tipe: "RI" }> }) {
  return (
    <span className="mt-1.5 flex flex-wrap items-center gap-1">
      {SHIFTS.map((sh, i) => (
        <Pil key={sh.key} status={it.shift[i]} label={sh.label} />
      ))}
      <Pil status={it.dokter} label="Visite" />
      <Pil status={it.ttv} label={`TTV ${it.ttvN}/${TARGET_RI.ttvPerHari}`} />
      <span className="ml-1 text-[10px] text-fg-muted">{it.perawat} perawat · {it.petugas} petugas</span>
      {it.batal > 0 && <span className="inline-flex items-center gap-0.5 text-[10px] text-danger"><Ban className="size-2.5" />{it.batal}</span>}
    </span>
  );
}

function Pil({ status, label }: { status: Parameters<typeof StatusIcon>[0]["s"]; label: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] text-fg", SEL_STYLE[status])} title={`${label}: ${SEL_LABEL[status]}`}>
      <StatusIcon s={status} className="size-3" />
      {label}
    </span>
  );
}

function RincianKel({ it }: { it: Extract<PetaItem, { tipe: "KEL" }> }) {
  return (
    <span className="mt-1.5 flex flex-wrap items-center gap-1">
      <span className={cn("rounded px-1.5 py-0.5 text-[10px] font-semibold tabular", it.persen == null ? "bg-surface-2 text-fg-muted" : pitaOf(it.persen))}>
        {it.persen == null ? "tak dinilai" : `${it.persen}%`}
      </span>
      {it.kurang.length > 0 ? (
        it.kurang.map((k) => (
          <Badge key={k} tone="danger" className="px-1.5 text-[10px]">tanpa {KATEGORI[k].short}</Badge>
        ))
      ) : (
        <span className="text-[10px] text-success">lengkap</span>
      )}
      <span className="ml-1 text-[10px] text-fg-muted">{it.input} input · {it.petugas} petugas</span>
      {it.batal > 0 && <span className="inline-flex items-center gap-0.5 text-[10px] text-danger"><Ban className="size-2.5" />{it.batal}</span>}
    </span>
  );
}

function PetaSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-[var(--radius-md)]" />)}</div>
      <Skeleton className="h-96 rounded-[var(--radius-lg)]" />
    </div>
  );
}

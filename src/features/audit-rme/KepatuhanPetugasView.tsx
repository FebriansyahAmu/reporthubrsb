"use client";

import { useMemo, useRef, useState } from "react";
import { ArrowDown, ArrowUp, Award, CalendarRange, Info, Search, TriangleAlert, X } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Input, InputWithIcon, Label } from "@/components/ui/Field";
import { Select, type SelectGroup } from "@/components/ui/Select";
import { Switch } from "@/components/ui/Switch";
import { Skeleton } from "@/components/ui/Skeleton";
import { NumberedPagination } from "@/components/ui/NumberedPagination";
import { EmptyState, ErrorState } from "@/components/feedback/States";
import { useAsyncData } from "@/lib/useAsyncData";
import { addDays, formatDate, formatNumber, toLocalDateInput } from "@/lib/format";
import { cn } from "@/lib/cn";
import {
  KELOMPOK_LABEL,
  PROFESI_PERAWAT,
  RENTANG_MAKS_HARI,
  RENTANG_PETUGAS_DEFAULT_HARI,
  TINDAKAN_TARIF,
} from "@/server/modules/audit-rme/kunjungan.constants";
import {
  BAND,
  INTEGRITAS_BATAS,
  KOMPONEN,
  KOMPONEN_KEYS,
  SKOR_SYARAT,
  type BandKey,
  type KomponenKey,
} from "@/server/modules/audit-rme/skor";
import {
  fetchKepatuhanPetugas,
  fetchRuanganTree,
  type KepatuhanPetugas,
  type PetugasFilter,
  type PetugasSkorItem,
  type ProfesiRingkas,
  type RuanganTree,
} from "./audit.client";
import { ProfilPetugasDrawer } from "./ProfilPetugasDrawer";
import type { LokasiSel } from "./RuanganRail";
import {
  BAND_STYLE,
  KOMPONEN_PENDEK,
  komponenEkstrem,
  nilaiRingkas,
  PetugasAvatar,
  SkorBar,
  SkorPill,
} from "./SkorParts";

const PAGE_SIZE = 12;
const PODIUM_MAKS = 5;
const PRESETS = [7, 14, RENTANG_PETUGAS_DEFAULT_HARI];

const todayIso = () => toLocalDateInput(new Date());
const shiftIso = (iso: string, n: number) => toLocalDateInput(addDays(new Date(`${iso}T00:00:00`), n));

type SortKey = "skor" | KomponenKey | "hariAktif" | "pasien";
type Sort = { key: SortKey; dir: "desc" | "asc" };

const profKey = (p: number | null) => String(p ?? "x");

/**
 * Kepatuhan Petugas (Fase 2 · K3): skor pengimputan per petugas, dibandingkan
 * dengan rekan seprofesi. Papan dua sisi (Teladan ↔ Perlu pembinaan) + tabel
 * peringkat berpaginasi; klik petugas → profil & bukti record.
 */
export function KepatuhanPetugasView() {
  const [to, setTo] = useState(todayIso);
  const [from, setFrom] = useState(() => shiftIso(todayIso(), -(RENTANG_PETUGAS_DEFAULT_HARI - 1)));
  const [lokasi, setLokasi] = useState<LokasiSel>({});
  const [profesiPilih, setProfesiPilih] = useState<string | null>(null);
  const [rumus, setRumus] = useState(false);
  const [profil, setProfil] = useState<PetugasSkorItem | null>(null);

  const filter: PetugasFilter = useMemo(
    () => ({ from, to, kelompok: lokasi.kelompok, jenis: lokasi.jenis, ruangan: lokasi.ruangan }),
    [from, to, lokasi],
  );
  const board = useAsyncData<KepatuhanPetugas>(() => fetchKepatuhanPetugas(filter), [JSON.stringify(filter)]);
  const tree = useAsyncData<RuanganTree>(() => fetchRuanganTree({ from, to }), [from, to]);
  const data = board.result;

  const profesiList = data?.profesi ?? [];
  const aktif =
    profesiList.find((p) => profKey(p.profesi) === profesiPilih) ??
    profesiList.find((p) => p.profesi === PROFESI_PERAWAT) ??
    profesiList[0];
  const items = useMemo(() => (data && aktif ? data.items.filter((x) => x.profesi === aktif.profesi) : []), [data, aktif]);

  const activePreset = PRESETS.find((d) => to === todayIso() && from === shiftIso(to, -(d - 1)));

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <Card className="p-4">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-end">
          <div>
            <Label>Rentang hari dinas</Label>
            <div className="flex flex-wrap gap-1 rounded-[var(--radius-md)] border border-border bg-surface-2 p-1">
              {PRESETS.map((d) => (
                <button
                  key={d}
                  type="button"
                  aria-pressed={activePreset === d}
                  onClick={() => {
                    const t = todayIso();
                    setTo(t);
                    setFrom(shiftIso(t, -(d - 1)));
                  }}
                  className={cn(
                    "rounded-[var(--radius-sm)] px-2.5 py-1.5 text-xs font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring",
                    activePreset === d ? "bg-surface text-fg shadow-xs" : "text-fg-muted hover:text-fg",
                  )}
                >
                  {d} hari
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:w-[300px]">
            <div>
              <Label htmlFor="kp-from">Dari</Label>
              <Input
                id="kp-from"
                type="date"
                value={from}
                min={shiftIso(to, -(RENTANG_MAKS_HARI - 1))}
                max={to}
                onChange={(e) => e.target.value && setFrom(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="kp-to">Sampai</Label>
              <Input
                id="kp-to"
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
          <div className="min-w-0 xl:w-72">
            <Label htmlFor="kp-lokasi">Lokasi input</Label>
            <Select id="kp-lokasi" value={encodeLokasi(lokasi)} onChange={(v) => setLokasi(decodeLokasi(v))} options={lokasiOptions(tree.result)} />
          </div>
          <button
            type="button"
            onClick={() => setRumus((v) => !v)}
            aria-expanded={rumus}
            className="inline-flex items-center gap-1.5 self-start rounded-[var(--radius-md)] border border-border px-3 py-2 text-xs font-medium text-fg-muted transition-colors hover:bg-surface-2 hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring xl:ml-auto xl:self-end"
          >
            <Info className="size-3.5" /> Cara skor dihitung
          </button>
        </div>
      </Card>

      {rumus && <RumusSkor onClose={() => setRumus(false)} />}

      {board.loading && !data ? (
        <BoardSkeleton />
      ) : board.error ? (
        <Card className="overflow-hidden"><ErrorState onRetry={board.reload} /></Card>
      ) : !data || !aktif ? (
        <Card className="overflow-hidden">
          <EmptyState title="Belum ada input" description="Tidak ada input RME pada rentang & lokasi ini." />
        </Card>
      ) : (
        <div className={cn("space-y-4 transition-opacity", board.loading && "pointer-events-none opacity-60")}>
          {/* Profesi */}
          <div role="tablist" aria-label="Profesi" className="flex flex-wrap items-center gap-1.5">
            {profesiList.map((p) => {
              const on = p === aktif;
              return (
                <button
                  key={profKey(p.profesi)}
                  type="button"
                  role="tab"
                  aria-selected={on}
                  onClick={() => setProfesiPilih(profKey(p.profesi))}
                  className={cn(
                    "inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring",
                    on ? "border-brand bg-brand text-white" : "border-border bg-surface text-fg-muted hover:text-fg",
                  )}
                >
                  {p.label}
                  <span className={cn("text-xs tabular", on ? "text-white/80" : "text-fg-subtle")}>
                    {p.dinilai}/{p.total}
                  </span>
                </button>
              );
            })}
            <span className="ml-auto inline-flex items-center gap-1.5 text-xs text-fg-muted">
              <CalendarRange className="size-3.5" />
              {formatDate(data.range.from)} – {formatDate(data.range.to)} · {data.range.hari} hari dinas
            </span>
          </div>

          <RingkasanProfesi p={aktif} items={items} />

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Podium jenis="TELADAN" items={items} onOpen={setProfil} />
            <Podium jenis="PEMBINAAN" items={items} onOpen={setProfil} />
          </div>

          <TabelPeringkat key={profKey(aktif.profesi)} label={aktif.label} items={items} onOpen={setProfil} />
        </div>
      )}

      <ProfilPetugasDrawer item={profil} filter={filter} onClose={() => setProfil(null)} />
    </div>
  );
}

/* ----------------------------------------------------------------- lokasi */

function encodeLokasi(s: LokasiSel): string {
  if (s.ruangan) return `r:${s.jenis ?? ""}:${s.ruangan}`;
  if (s.jenis != null) return `j:${s.jenis}`;
  if (s.kelompok) return `k:${s.kelompok}`;
  return "semua";
}

function decodeLokasi(v: string): LokasiSel {
  const [t, a, b] = v.split(":");
  if (t === "r") return { jenis: a ? Number(a) : undefined, ruangan: b };
  if (t === "j") return { jenis: Number(a) };
  if (t === "k") return { kelompok: "KLINIS" };
  return {};
}

function lokasiOptions(tree: RuanganTree | null): SelectGroup[] {
  const groups: SelectGroup[] = [
    {
      label: "",
      options: [
        { value: "semua", label: "Semua lokasi" },
        { value: "k:KLINIS", label: `${KELOMPOK_LABEL.KLINIS} (RI · IGD · RJ)` },
      ],
    },
  ];
  for (const j of tree?.jenis ?? []) {
    if (j.jenis == null) continue;
    groups.push({
      label: j.label,
      options: [{ value: `j:${j.jenis}`, label: `Semua ${j.label}` }, ...j.grup.map((g) => ({ value: `r:${j.jenis}:${g.id}`, label: g.nama }))],
    });
  }
  return groups;
}

/* -------------------------------------------------------------- ringkasan */

const persen = (n: number, d: number) => (d ? `${formatNumber(Math.round((n / d) * 1000) / 10)}%` : "—");

function RingkasanProfesi({ p, items }: { p: ProfesiRingkas; items: PetugasSkorItem[] }) {
  const perBand = BAND.map((b) => ({ ...b, n: items.filter((x) => x.band === b.key).length }));
  const dinilai = perBand.reduce((s, b) => s + b.n, 0);
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-[repeat(4,minmax(0,1fr))_minmax(0,1.6fr)]">
      <Tile label="Petugas dinilai" value={`${p.dinilai}`} sub={`dari ${p.total} yang menginput`} />
      <Tile label="Median skor" value={p.medianSkor == null ? "—" : String(p.medianSkor)} sub={`${p.label} yang dinilai`} />
      <Tile label="TTV tepat waktu" value={persen(p.ttv - p.ttvTerlambat, p.ttv)} sub={`${formatNumber(p.ttv)} TTV · ${formatNumber(p.ttvTerlambat)} terlambat`} />
      <Tile label="Input dibatalkan" value={persen(p.batal, p.klinis + p.batal)} sub={`${formatNumber(p.batal)} dari ${formatNumber(p.klinis + p.batal)} input`} />
      <div className="col-span-2 rounded-[var(--radius-md)] border border-border bg-surface p-3 lg:col-span-1">
        <p className="text-[11px] text-fg-muted">Sebaran pita skor</p>
        {dinilai === 0 ? (
          <p className="mt-2 text-sm text-fg-subtle">Belum ada yang dinilai.</p>
        ) : (
          <>
            <div className="mt-2 flex h-3 gap-0.5 overflow-hidden rounded-full" role="img" aria-label={perBand.map((b) => `${b.label} ${b.n}`).join(", ")}>
              {perBand.map((b) => b.n > 0 && <span key={b.key} className={BAND_STYLE[b.key].solid} style={{ flexGrow: b.n }} />)}
            </div>
            <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
              {perBand.map((b) => {
                const Icon = BAND_STYLE[b.key].icon;
                return (
                  <span key={b.key} className="inline-flex items-center gap-1 text-[11px] text-fg-muted">
                    <Icon className={cn("size-3", BAND_STYLE[b.key].text)} aria-hidden />
                    {b.label} <b className="tabular text-fg">{b.n}</b>
                  </span>
                );
              })}
            </div>
          </>
        )}
        {p.tarif > 0 && (
          <p className="mt-2 border-t border-border pt-2 text-[11px] text-fg-muted">
            <b className="tabular text-fg">{formatNumber(p.tarif)}</b> item tarif (akomodasi, jasa, item obat, …) dikecualikan dari Tindakan.
          </p>
        )}
      </div>
    </div>
  );
}

function Tile({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="rounded-[var(--radius-md)] border border-border bg-surface p-3">
      <p className="text-[11px] text-fg-muted">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular text-fg">{value}</p>
      <p className="mt-0.5 text-[11px] text-fg-subtle">{sub}</p>
    </div>
  );
}

/* ----------------------------------------------------------------- podium */

function Podium({ jenis, items, onOpen }: { jenis: Extract<BandKey, "TELADAN" | "PEMBINAAN">; items: PetugasSkorItem[]; onOpen: (it: PetugasSkorItem) => void }) {
  const teladan = jenis === "TELADAN";
  const band = BAND.find((b) => b.key === jenis)!;
  const semua = items
    .filter((x) => x.band === jenis)
    .sort((a, b) => (teladan ? a.peringkat! - b.peringkat! : a.skor! - b.skor! || b.peringkat! - a.peringkat!));
  const tampil = semua.slice(0, PODIUM_MAKS);
  const Icon = teladan ? Award : TriangleAlert;
  const batasAtas = BAND[BAND.findIndex((b) => b.key === jenis) - 1]?.min;

  return (
    <Card className="overflow-hidden">
      <div className={cn("flex items-center gap-2 border-b border-border px-4 py-3", teladan ? "bg-success-soft/50" : "bg-danger-soft/50")}>
        <Icon className={cn("size-4", teladan ? "text-success" : "text-danger")} aria-hidden />
        <h3 className="text-sm font-semibold text-fg">{band.label}</h3>
        <span className="text-xs text-fg-muted">
          {teladan ? `skor ≥ ${band.min}` : `skor < ${batasAtas}`} · {semua.length} petugas
        </span>
      </div>
      {tampil.length === 0 ? (
        <p className="px-4 py-8 text-center text-sm text-fg-muted">
          {teladan ? `Belum ada petugas dengan skor ≥ ${band.min}.` : `Tidak ada petugas dengan skor di bawah ${batasAtas}.`}
        </p>
      ) : (
        <ol className="divide-y divide-border">
          {tampil.map((it) => {
            const { kuat, lemah } = komponenEkstrem(it);
            const sorot = teladan ? kuat : lemah;
            return (
              <li key={it.id}>
                <button
                  type="button"
                  onClick={() => onOpen(it)}
                  className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-surface-2/60 focus-visible:bg-surface-2/60 focus-visible:outline-none"
                >
                  <span className="w-6 shrink-0 text-center text-xs font-semibold tabular text-fg-muted">#{it.peringkat}</span>
                  <PetugasAvatar nama={it.nama} profesi={it.profesi} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-fg">{it.nama ?? `#${it.id}`}</span>
                    <span className="block truncate text-[11px] text-fg-muted">
                      {sorot && (
                        <>
                          {teladan ? "Terkuat" : "Terlemah"}: {KOMPONEN_PENDEK[sorot]} {it.komponen[sorot].skor}
                        </>
                      )}
                      {" · "}
                      {formatNumber(it.klinis)} input · {formatNumber(it.hariAktif)} hari
                    </span>
                  </span>
                  <SkorPill skor={it.skor} band={it.band} size="sm" />
                </button>
              </li>
            );
          })}
        </ol>
      )}
    </Card>
  );
}

/* --------------------------------------------------------- tabel peringkat */

const SORT_VALUE: Record<SortKey, (it: PetugasSkorItem) => number | null> = {
  skor: (it) => it.skor,
  aktivitas: (it) => it.komponen.aktivitas.skor,
  kontribusiRi: (it) => it.komponen.kontribusiRi.skor,
  ketepatanTtv: (it) => it.komponen.ketepatanTtv.skor,
  integritas: (it) => it.komponen.integritas.skor,
  hariAktif: (it) => it.hariAktif,
  pasien: (it) => it.pasien,
};

function TabelPeringkat({ label, items, onOpen }: { label: string; items: PetugasSkorItem[]; onOpen: (it: PetugasSkorItem) => void }) {
  const [sort, setSort] = useState<Sort>({ key: "skor", dir: "desc" });
  const [q, setQ] = useState("");
  const [semua, setSemua] = useState(false);
  const [page, setPage] = useState(1);
  const topRef = useRef<HTMLDivElement>(null);

  const belum = items.filter((x) => !x.dinilai).length;
  const rows = useMemo(() => {
    const cari = q.trim().toLowerCase();
    const get = SORT_VALUE[sort.key];
    const arah = sort.dir === "desc" ? -1 : 1;
    return items
      .filter((x) => (semua || x.dinilai) && (!cari || `${x.nama ?? ""} ${x.login ?? ""}`.toLowerCase().includes(cari)))
      .sort((a, b) => {
        const va = get(a);
        const vb = get(b);
        if (va == null || vb == null) return va == null ? (vb == null ? 0 : 1) : -1; // kosong selalu di bawah
        return (va - vb) * arah || (a.peringkat ?? Infinity) - (b.peringkat ?? Infinity);
      });
  }, [items, sort, q, semua]);

  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const hal = Math.min(page, totalPages);
  const tampil = rows.slice((hal - 1) * PAGE_SIZE, hal * PAGE_SIZE);

  const urut = (key: SortKey) => {
    setSort((s) => (s.key === key ? { key, dir: s.dir === "desc" ? "asc" : "desc" } : { key, dir: "desc" }));
    setPage(1);
  };

  return (
    <Card className="overflow-hidden">
      <div ref={topRef} className="scroll-mt-4" aria-hidden />
      <div className="flex flex-wrap items-center gap-3 border-b border-border px-4 py-3">
        <h3 className="text-sm font-semibold text-fg">Peringkat {label}</h3>
        <div className="ml-auto flex flex-wrap items-center gap-3">
          {belum > 0 && (
            <label className="inline-flex cursor-pointer items-center gap-2 text-xs text-fg-muted">
              <Switch checked={semua} onChange={(v) => { setSemua(v); setPage(1); }} label="Sertakan yang belum dinilai" />
              Sertakan belum dinilai ({belum})
            </label>
          )}
          <div className="w-56">
            <InputWithIcon
              icon={<Search className="size-4" />}
              placeholder="Cari nama petugas…"
              value={q}
              onChange={(e) => { setQ(e.target.value); setPage(1); }}
              aria-label="Cari nama petugas"
            />
          </div>
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="px-4 py-10 text-center text-sm text-fg-muted">Tidak ada petugas yang cocok.</p>
      ) : (
        // `relative`: teks sr-only (absolute) di sel tetap terkurung wadah gulir — tanpa ini halaman melebar di HP.
        <div className="relative overflow-x-auto">
          <table className="w-full min-w-[880px] text-sm">
            <thead>
              <tr className="border-b border-border bg-surface-2/50 text-left text-[11px] font-semibold tracking-wide text-fg-muted uppercase">
                <th scope="col" className="w-12 px-4 py-2">#</th>
                <th scope="col" className="px-2 py-2">Petugas</th>
                <SortTh label="Skor" k="skor" sort={sort} onSort={urut} />
                {KOMPONEN_KEYS.map((k) => (
                  <SortTh key={k} label={KOMPONEN_PENDEK[k]} k={k} sort={sort} onSort={urut} sub={`${KOMPONEN[k].bobot}%`} />
                ))}
                <SortTh label="Hari" k="hariAktif" sort={sort} onSort={urut} align="right" />
                <SortTh label="Pasien" k="pasien" sort={sort} onSort={urut} align="right" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {tampil.map((it) => (
                <tr
                  key={it.id}
                  onClick={() => onOpen(it)}
                  className={cn("cursor-pointer transition-colors hover:bg-surface-2/50", !it.dinilai && "text-fg-muted")}
                >
                  <td className="px-4 py-2.5 text-xs font-semibold tabular text-fg-muted">{it.peringkat ?? "—"}</td>
                  <td className="px-2 py-2.5">
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); onOpen(it); }}
                      className="flex items-center gap-2.5 rounded text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring"
                    >
                      <PetugasAvatar nama={it.nama} profesi={it.profesi} />
                      <span className="min-w-0">
                        <span className="block max-w-52 truncate font-medium text-fg">{it.nama ?? `#${it.id}`}</span>
                        <span className="block max-w-52 truncate font-mono text-[10px] text-fg-subtle">{it.login ?? "—"}</span>
                      </span>
                    </button>
                  </td>
                  <td className="px-2 py-2.5">
                    {it.dinilai ? <SkorPill skor={it.skor} band={it.band} size="sm" /> : <span className="text-[11px]">{it.alasan}</span>}
                  </td>
                  {KOMPONEN_KEYS.map((k) => (
                    <td key={k} className="w-28 px-2 py-2.5">
                      <span className="block text-xs tabular text-fg">{nilaiRingkas(k, it)}</span>
                      <SkorBar skor={it.komponen[k].skor} className="mt-1" />
                      <span className="sr-only">skor komponen {it.komponen[k].skor ?? "tidak berlaku"}</span>
                    </td>
                  ))}
                  <td className="px-2 py-2.5 text-right text-xs tabular">{formatNumber(it.hariAktif)}</td>
                  <td className="px-4 py-2.5 text-right text-xs tabular">{formatNumber(it.pasien)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex flex-col items-center justify-between gap-3 border-t border-border px-4 py-3 sm:flex-row">
        <p className="text-xs text-fg-muted">
          <b className="tabular text-fg">{formatNumber(rows.length)}</b> petugas · batang = skor komponen (0–100), angka = besaran yang dinilai
        </p>
        <NumberedPagination
          page={hal}
          totalPages={totalPages}
          onPageChange={(p) => {
            setPage(p);
            topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
          }}
        />
      </div>
    </Card>
  );
}

function SortTh({
  label,
  k,
  sort,
  onSort,
  sub,
  align,
}: {
  label: string;
  k: SortKey;
  sort: Sort;
  onSort: (k: SortKey) => void;
  sub?: string;
  align?: "right";
}) {
  const on = sort.key === k;
  const Arrow = sort.dir === "desc" ? ArrowDown : ArrowUp;
  return (
    <th scope="col" aria-sort={on ? (sort.dir === "desc" ? "descending" : "ascending") : "none"} className={cn("px-2 py-2", align === "right" && "text-right")}>
      <button
        type="button"
        onClick={() => onSort(k)}
        className={cn(
          "inline-flex flex-col gap-0.5 rounded whitespace-nowrap uppercase hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring",
          align === "right" ? "items-end" : "items-start",
          on && "text-fg",
        )}
      >
        <span className="inline-flex items-center gap-1">
          {label}
          {on && <Arrow className="size-3" aria-hidden />}
        </span>
        {sub && <span className="font-normal normal-case text-fg-subtle">bobot {sub}</span>}
      </button>
    </th>
  );
}

/* ------------------------------------------------------------------ rumus */

function RumusSkor({ onClose }: { onClose: () => void }) {
  return (
    <Card className="relative p-4">
      <button
        type="button"
        onClick={onClose}
        aria-label="Tutup penjelasan"
        className="absolute top-3 right-3 rounded-md p-1 text-fg-subtle hover:bg-surface-2 hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring"
      >
        <X className="size-4" />
      </button>
      <h3 className="text-sm font-semibold text-fg">Cara skor dihitung</h3>
      <p className="mt-1 max-w-3xl text-xs text-fg-muted">
        Skor adalah <b className="text-fg">alat bantu</b> penilaian, bukan keputusan otomatis. Semua angka berasal dari data aktual SIMGOS (kolom
        penginput <span className="font-mono">OLEH</span>) dan dapat ditelusuri sampai ke record lewat profil petugas.
      </p>
      <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        {KOMPONEN_KEYS.map((k) => (
          <div key={k} className="rounded-[var(--radius-md)] border border-border bg-surface-2/40 p-3">
            <p className="flex items-baseline justify-between gap-2 text-xs font-semibold text-fg">
              {KOMPONEN[k].label} <span className="tabular text-brand">{KOMPONEN[k].bobot}%</span>
            </p>
            <p className="mt-1 text-[11px] leading-relaxed text-fg-muted">{KOMPONEN[k].rumus}</p>
          </div>
        ))}
      </div>
      <ul className="mt-3 list-disc space-y-1 pl-4 text-[11px] leading-relaxed text-fg-muted">
        <li>
          <b className="text-fg">Skor</b> = Σ (bobot × nilai komponen) ÷ Σ bobot komponen yang berlaku. Komponen yang tidak berlaku tidak menghukum.
        </li>
        <li>
          Dinilai bila aktif ≥ {SKOR_SYARAT.hariAktifMin} hari dinas dan ≥ {SKOR_SYARAT.inputMin} input klinis. Pembanding = rekan seprofesi pada
          rentang & lokasi yang sama. Hari dinas dimulai 07.00.
        </li>
        <li>
          Pita: {BAND.map((b, i) => `${b.label} ${i === 0 ? `≥ ${b.min}` : i === BAND.length - 1 ? `< ${BAND[i - 1].min}` : `${b.min}–${BAND[i - 1].min - 1}`}`).join(" · ")}.
        </li>
        <li>
          Integritas hanya menilai pembatalan (maks. penalti pada {INTEGRITAS_BATAS * 100}%). Nilai TTV tak wajar (mis. suhu 362) ditampilkan sebagai
          temuan, tidak mengurangi skor — polanya sistemik (± 47% TTV).
        </li>
        <li>
          <b className="text-fg">Item tarif</b> pada Tindakan tidak dihitung: {TINDAKAN_TARIF.map((t) => t.label.toLowerCase()).join(", ")}.
        </li>
      </ul>
    </Card>
  );
}

/* --------------------------------------------------------------- skeleton */

function BoardSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true">
      <div className="flex gap-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-8 w-28 rounded-full" />)}</div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-[var(--radius-md)]" />)}</div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">{Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-72 rounded-[var(--radius-lg)]" />)}</div>
      <Skeleton className="h-96 rounded-[var(--radius-lg)]" />
    </div>
  );
}

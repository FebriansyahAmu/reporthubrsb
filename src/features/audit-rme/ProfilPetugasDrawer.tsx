"use client";

import { useMemo, useState } from "react";
import { Ban, CalendarDays, ChevronRight, Clock, Gauge, ListChecks, SearchCheck, TriangleAlert, UsersRound } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Drawer } from "@/components/ui/Drawer";
import { Skeleton } from "@/components/ui/Skeleton";
import { NumberedPagination } from "@/components/ui/NumberedPagination";
import { ErrorState } from "@/components/feedback/States";
import { useAsyncData } from "@/lib/useAsyncData";
import { formatDate, formatLama, formatNumber } from "@/lib/format";
import { cn } from "@/lib/cn";
import {
  JENIS_KUNJUNGAN,
  KATEGORI,
  KATEGORI_KEYS,
  SHIFTS,
  SUMBER,
  TTV_TERLAMBAT_MENIT,
} from "@/server/modules/audit-rme/kunjungan.constants";
import { KOMPONEN, KOMPONEN_KEYS } from "@/server/modules/audit-rme/skor";
import {
  fetchProfilPetugas,
  type KunjunganPetugas,
  type PetugasFilter,
  type PetugasSkorItem,
  type ProfilPetugas,
  type TemuanBatal,
  type TemuanTtv,
} from "./audit.client";
import { JejakKunjunganDrawer } from "./JejakKunjunganDrawer";
import { KalenderAktivitas } from "./KalenderAktivitas";
import { fmtWaktu } from "./KunjunganCardView";
import { KATEGORI_TONE } from "./RekamList";
import { nilaiPenjelasan, PetugasAvatar, SkorBar, SkorPill } from "./SkorParts";

type Tab = "ringkasan" | "pasien" | "temuan";
const PASIEN_PAGE = 10;
const TEMUAN_AWAL = 20;

/**
 * Profil kepatuhan satu petugas (Fase 2 · K3). Skor & komponen dari baris papan
 * peringkat (tanpa hitung ulang); rincian bukti dimuat per buka. Klik pasien /
 * temuan → jejak kunjungan (drawer di atasnya; Escape menutup yang teratas).
 */
export function ProfilPetugasDrawer({
  item,
  filter,
  onClose,
}: {
  item: PetugasSkorItem | null;
  filter: PetugasFilter;
  onClose: () => void;
}) {
  const [jejak, setJejak] = useState<string | null>(null);
  const { result, loading, error, reload } = useAsyncData<ProfilPetugas | null>(
    () => (item ? fetchProfilPetugas(item.id, filter) : Promise.resolve(null)),
    [item?.id, JSON.stringify(filter)],
  );
  // Abaikan profil petugas sebelumnya selama profil baru dimuat.
  const d = result && item && result.petugas.id === item.id ? result : null;

  return (
    <>
      <Drawer
        open={!!item}
        onClose={onClose}
        title="Profil kepatuhan petugas"
        size="xl"
        dismissible={!jejak}
        header={item ? <Header it={item} /> : null}
      >
        {item &&
          (d ? (
            <ProfilBody key={item.id} it={item} d={d} onOpenKunjungan={setJejak} />
          ) : error && !loading ? (
            <div className="p-5"><ErrorState onRetry={reload} /></div>
          ) : (
            <BodySkeleton />
          ))}
      </Drawer>
      <JejakKunjunganDrawer nomor={jejak} onClose={() => setJejak(null)} />
    </>
  );
}

function Header({ it }: { it: PetugasSkorItem }) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <PetugasAvatar nama={it.nama} profesi={it.profesi} size="lg" />
      <div className="min-w-0 flex-1">
        <h3 className="truncate text-base font-semibold text-fg">{it.nama ?? `Petugas #${it.id}`}</h3>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-fg-muted">
          <Badge tone="brand" className="px-2 text-[10px]">{it.profesiLabel}</Badge>
          {it.login && <span className="font-mono">{it.login}</span>}
          {it.dinilai ? (
            <span>Peringkat <b className="tabular text-fg">#{it.peringkat}</b> dari {it.pembanding} {it.profesiLabel.toLowerCase()}</span>
          ) : (
            <span>Belum dinilai — {it.alasan}</span>
          )}
        </p>
      </div>
      <SkorPill skor={it.skor} band={it.band} size="lg" />
    </div>
  );
}

function BodySkeleton() {
  return (
    <div className="space-y-3 p-5" aria-busy="true">
      <Skeleton className="h-9 w-72 rounded" />
      <div className="grid gap-3 lg:grid-cols-2">
        <Skeleton className="h-64 rounded" />
        <Skeleton className="h-64 rounded" />
      </div>
    </div>
  );
}

function ProfilBody({ it, d, onOpenKunjungan }: { it: PetugasSkorItem; d: ProfilPetugas; onOpenKunjungan: (nomor: string) => void }) {
  const [tab, setTab] = useState<Tab>("ringkasan");
  const pasienByNomor = useMemo(() => new Map(d.kunjungan.map((k) => [k.nomor, k])), [d.kunjungan]);
  const nTemuan = d.temuan.batal.length + d.temuan.ttvTerlambat.length + d.temuan.ttvTakWajar.length;

  const tabs: { key: Tab; label: string; icon: typeof Gauge; n?: number }[] = [
    { key: "ringkasan", label: "Ringkasan", icon: Gauge },
    { key: "pasien", label: "Kunjungan ditangani", icon: UsersRound, n: d.kunjungan.length },
    { key: "temuan", label: "Temuan", icon: SearchCheck, n: nTemuan },
  ];

  return (
    <div>
      <div role="tablist" aria-label="Bagian profil petugas" className="sticky top-0 z-10 flex gap-1 overflow-x-auto border-b border-border bg-bg/95 px-5 pt-2 backdrop-blur">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={tab === t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              "-mb-px inline-flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring",
              tab === t.key ? "border-brand text-brand" : "border-transparent text-fg-muted hover:text-fg",
            )}
          >
            <t.icon className="size-4" />
            {t.label}
            {t.n != null && <span className="rounded-full bg-surface-2 px-1.5 text-[10px] tabular text-fg-muted">{t.n}</span>}
          </button>
        ))}
      </div>

      <div className="p-5">
        {tab === "ringkasan" && <Ringkasan it={it} d={d} />}
        {tab === "pasien" && <PasienList rows={d.kunjungan} onOpen={onOpenKunjungan} />}
        {tab === "temuan" && <TemuanList d={d} pasien={pasienByNomor} petugasId={it.id} onOpen={onOpenKunjungan} />}
        {d.terpotong && <p className="mt-3 text-[11px] text-warning">Input sangat banyak — sebagian record terbaru tidak dimuat pada profil ini.</p>}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------- ringkasan */

function Ringkasan({ it, d }: { it: PetugasSkorItem; d: ProfilPetugas }) {
  const berlaku = KOMPONEN_KEYS.filter((k) => it.komponen[k].skor != null);
  const rumus = berlaku.map((k) => `${KOMPONEN[k].bobot}×${it.komponen[k].skor}`).join(" + ");
  const totalBobot = berlaku.reduce((s, k) => s + KOMPONEN[k].bobot, 0);
  const maksKat = Math.max(1, ...KATEGORI_KEYS.map((k) => d.perKategori[k]));
  const totalShift = SHIFTS.reduce((s, x) => s + d.perShift[x.key], 0);

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel icon={Gauge} title="Komponen skor">
          {it.dinilai ? (
            <div className="space-y-3">
              {KOMPONEN_KEYS.map((k) => {
                const c = it.komponen[k];
                return (
                  <div key={k}>
                    <div className="flex items-baseline gap-2">
                      <span className="text-xs font-medium text-fg">{KOMPONEN[k].label}</span>
                      <span className="text-[10px] text-fg-subtle">bobot {KOMPONEN[k].bobot}%</span>
                      <span className={cn("ml-auto text-sm font-semibold tabular", c.skor == null ? "text-fg-subtle" : "text-fg")}>{c.skor ?? "—"}</span>
                    </div>
                    <SkorBar skor={c.skor} className="mt-1" />
                    <p className="mt-1 text-[11px] leading-snug text-fg-muted">{nilaiPenjelasan(k, it)}</p>
                  </div>
                );
              })}
              <p className="rounded-md bg-surface-2/60 px-2.5 py-1.5 font-mono text-[11px] text-fg-muted">
                ({rumus}) ÷ {totalBobot} = <b className="text-fg">{it.skor}</b>
              </p>
            </div>
          ) : (
            <p className="text-sm text-fg-muted">Belum dinilai — {it.alasan}. Aktivitas tetap ditampilkan untuk ditelusuri.</p>
          )}
        </Panel>

        <Panel icon={CalendarDays} title="Kalender aktivitas" sub={`${formatDate(d.range.from)} – ${formatDate(d.range.to)}`}>
          <KalenderAktivitas harian={d.harian} />
        </Panel>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel icon={ListChecks} title="Input per kategori" sub="input klinis aktif">
          <ul className="space-y-2">
            {KATEGORI_KEYS.map((k) => (
              <BarRow key={k} label={KATEGORI[k].label} n={d.perKategori[k]} maks={maksKat} />
            ))}
          </ul>
          <p className="mt-3 flex flex-wrap gap-x-4 gap-y-1 border-t border-border pt-2 text-[11px] text-fg-muted">
            <span><b className="tabular text-fg">{formatNumber(d.tarif)}</b> item tarif (tidak dinilai)</span>
            <span className="inline-flex items-center gap-1 text-danger"><Ban className="size-3" /> <b className="tabular">{formatNumber(d.batal)}</b> dibatalkan</span>
            <span><b className="tabular text-fg">{formatNumber(it.pasien)}</b> pasien</span>
          </p>
        </Panel>

        <Panel icon={Clock} title="Pola dinas" sub="input klinis per shift">
          <ul className="space-y-2">
            {SHIFTS.map((s) => (
              <BarRow
                key={s.key}
                label={`${s.label} ${String(s.start).padStart(2, "0")}–${String(s.end).padStart(2, "0")}`}
                n={d.perShift[s.key]}
                maks={Math.max(1, ...SHIFTS.map((x) => d.perShift[x.key]))}
                akhir={totalShift ? `${Math.round((d.perShift[s.key] / totalShift) * 100)}%` : undefined}
              />
            ))}
          </ul>
        </Panel>
      </div>
    </div>
  );
}

function Panel({ icon: Icon, title, sub, children }: { icon: typeof Gauge; title: string; sub?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-[var(--radius-md)] border border-border bg-surface p-4">
      <h4 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-fg">
        <Icon className="size-4 text-fg-muted" /> {title}
        {sub && <span className="ml-auto text-[11px] font-normal text-fg-muted">{sub}</span>}
      </h4>
      {children}
    </section>
  );
}

function BarRow({ label, n, maks, akhir }: { label: string; n: number; maks: number; akhir?: string }) {
  return (
    <li className="grid grid-cols-[7.5rem_minmax(0,1fr)_3.5rem] items-center gap-2 text-xs">
      <span className="truncate text-fg-muted">{label}</span>
      <span className="h-2 overflow-hidden rounded-full bg-chart-track" aria-hidden>
        {n > 0 && <span className="block h-full rounded-full bg-brand" style={{ width: `${Math.max(3, (n / maks) * 100)}%` }} />}
      </span>
      <span className="text-right tabular text-fg">
        {formatNumber(n)}
        {akhir && <span className="ml-1 text-[10px] text-fg-subtle">{akhir}</span>}
      </span>
    </li>
  );
}

/* ----------------------------------------------------------------- pasien */

function PasienList({ rows, onOpen }: { rows: KunjunganPetugas[]; onOpen: (nomor: string) => void }) {
  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(rows.length / PASIEN_PAGE));
  const tampil = rows.slice((page - 1) * PASIEN_PAGE, page * PASIEN_PAGE);

  if (rows.length === 0) return <p className="py-8 text-center text-sm text-fg-muted">Tidak ada kunjungan pada rentang ini.</p>;

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-[var(--radius-md)] border border-border bg-surface">
        <table className="w-full min-w-[680px] text-sm">
          <thead>
            <tr className="border-b border-border bg-surface-2/50 text-left text-[11px] font-semibold tracking-wide text-fg-muted uppercase">
              <th scope="col" className="px-3 py-2">Pasien</th>
              <th scope="col" className="px-2 py-2">Lokasi</th>
              <th scope="col" className="px-2 py-2">Input oleh petugas ini</th>
              <th scope="col" className="px-3 py-2 text-right">Terakhir</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {tampil.map((k) => {
              const tone = (k.jenis.id != null ? JENIS_KUNJUNGAN[k.jenis.id]?.tone : undefined) ?? "neutral";
              return (
                <tr key={k.nomor} onClick={() => onOpen(k.nomor)} className="cursor-pointer transition-colors hover:bg-surface-2/50">
                  <td className="px-3 py-2">
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); onOpen(k.nomor); }}
                      className={cn("block max-w-52 truncate text-left font-medium text-fg hover:text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring", k.status === "BATAL" && "line-through decoration-danger/60")}
                    >
                      {k.pasien ?? "Tanpa nama"}
                    </button>
                    <span className="font-mono text-[10px] text-fg-subtle">RM {k.norm ?? "—"}</span>
                  </td>
                  <td className="px-2 py-2">
                    <span className="flex items-center gap-1.5">
                      <Badge tone={tone} className="px-1.5 text-[10px]">{k.jenis.short}</Badge>
                      <span className="max-w-44 truncate text-xs text-fg-muted">{k.ruangan}</span>
                    </span>
                  </td>
                  <td className="px-2 py-2">
                    <span className="flex flex-wrap items-center gap-1">
                      {KATEGORI_KEYS.filter((c) => k.perKategori[c] > 0).map((c) => (
                        <Badge key={c} tone={KATEGORI_TONE[c]} className="px-1.5 text-[10px]">{KATEGORI[c].short} {k.perKategori[c]}</Badge>
                      ))}
                      {k.tarif > 0 && <span className="text-[10px] text-fg-subtle">+{k.tarif} tarif</span>}
                      {k.batal > 0 && (
                        <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-danger"><Ban className="size-2.5" />{k.batal}</span>
                      )}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right">
                    <span className="inline-flex items-center gap-1 font-mono text-[11px] text-fg-muted">
                      {fmtWaktu(k.terakhir)} <ChevronRight className="size-3.5 text-fg-subtle" />
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="flex flex-col items-center justify-between gap-2 sm:flex-row">
        <p className="text-xs text-fg-muted"><b className="tabular text-fg">{formatNumber(rows.length)}</b> kunjungan · klik untuk membuka jejak kunjungan</p>
        <NumberedPagination page={page} totalPages={totalPages} onPageChange={setPage} />
      </div>
    </div>
  );
}

/* ----------------------------------------------------------------- temuan */

function TemuanList({
  d,
  pasien,
  petugasId,
  onOpen,
}: {
  d: ProfilPetugas;
  pasien: Map<string, KunjunganPetugas>;
  petugasId: string;
  onOpen: (nomor: string) => void;
}) {
  const nama = (nomor: string | null) => (nomor ? (pasien.get(nomor)?.pasien ?? "Tanpa nama") : "—");
  const { batal, ttvTerlambat, ttvTakWajar } = d.temuan;
  const jenisList: { key: JenisTemuan; label: string; n: number }[] = [
    { key: "batal", label: "Input dibatalkan", n: batal.length },
    { key: "terlambat", label: "TTV terlambat", n: ttvTerlambat.length },
    { key: "takwajar", label: "TTV tak wajar", n: ttvTakWajar.length },
  ];
  const [pilih, setPilih] = useState<JenisTemuan>(() => jenisList.find((j) => j.n > 0)?.key ?? "batal");

  if (batal.length + ttvTerlambat.length + ttvTakWajar.length === 0) {
    return <p className="rounded-[var(--radius-md)] border border-dashed border-success/40 bg-success-soft/40 py-8 text-center text-sm text-success">Tidak ada temuan pada rentang ini.</p>;
  }
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Jenis temuan">
        {jenisList.map((j) => (
          <button
            key={j.key}
            type="button"
            aria-pressed={pilih === j.key}
            disabled={j.n === 0}
            onClick={() => setPilih(j.key)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring",
              pilih === j.key ? "border-brand bg-brand text-white" : "border-border bg-surface text-fg-muted hover:text-fg",
            )}
          >
            {j.label}
            <span className={cn("tabular", pilih === j.key ? "text-white/80" : "text-fg-subtle")}>{j.n}</span>
          </button>
        ))}
      </div>

      {pilih === "batal" && (
        <Seksi icon={Ban} tone="danger" title="Input dibatalkan" n={batal.length} catatan="Dasar komponen integritas.">
          {(n) =>
            batal.slice(0, n).map((b) => (
              <BarisBatal key={`${b.sumber}:${b.id}`} b={b} pasien={nama(b.kunjungan)} pelaku={pembatal(b, d, petugasId)} onOpen={onOpen} />
            ))
          }
        </Seksi>
      )}

      {pilih === "terlambat" && (
        <Seksi icon={Clock} tone="warning" title="TTV terlambat diinput" n={ttvTerlambat.length} catatan={`Disimpan > ${TTV_TERLAMBAT_MENIT} menit setelah pemeriksaan — dasar komponen ketepatan waktu.`}>
          {(n) => ttvTerlambat.slice(0, n).map((t) => <BarisTtv key={t.id} t={t} pasien={nama(t.kunjungan)} onOpen={onOpen} mode="terlambat" />)}
        </Seksi>
      )}

      {pilih === "takwajar" && (
        <Seksi icon={TriangleAlert} tone="neutral" title="Nilai TTV tak wajar" n={ttvTakWajar.length} catatan="Informasi — tidak mengurangi skor (pola sistemik, mis. suhu tanpa koma).">
          {(n) => ttvTakWajar.slice(0, n).map((t) => <BarisTtv key={t.id} t={t} pasien={nama(t.kunjungan)} onOpen={onOpen} mode="takwajar" />)}
        </Seksi>
      )}
    </div>
  );
}

type JenisTemuan = "batal" | "terlambat" | "takwajar";

function pembatal(b: TemuanBatal, d: ProfilPetugas, petugasId: string): string {
  if (!b.batalOleh) return "Batal/dihapus — pelaku tidak tercatat di log";
  const siapa = b.batalOleh.oleh === petugasId ? "petugas ini sendiri" : (d.petugasRef[b.batalOleh.oleh]?.nama ?? `#${b.batalOleh.oleh}`);
  return `Dibatalkan oleh ${siapa} · ${fmtWaktu(b.batalOleh.ts)}`;
}

function Seksi({
  icon: Icon,
  tone,
  title,
  n,
  catatan,
  children,
}: {
  icon: typeof Ban;
  tone: "danger" | "warning" | "neutral";
  title: string;
  n: number;
  catatan: string;
  children: (batas: number) => React.ReactNode;
}) {
  const [semua, setSemua] = useState(false);
  if (n === 0) return null;
  const warna = tone === "danger" ? "text-danger" : tone === "warning" ? "text-warning" : "text-fg-muted";
  return (
    <section>
      <h4 className="mb-1 flex items-center gap-1.5 text-sm font-semibold text-fg">
        <Icon className={cn("size-4", warna)} /> {title} <span className="text-xs font-normal tabular text-fg-muted">{n}</span>
      </h4>
      <p className="mb-2 text-[11px] text-fg-muted">{catatan}</p>
      <ul className="divide-y divide-border overflow-hidden rounded-[var(--radius-md)] border border-border bg-surface">{children(semua ? n : TEMUAN_AWAL)}</ul>
      {n > TEMUAN_AWAL && (
        <button type="button" onClick={() => setSemua((v) => !v)} className="mt-1.5 text-xs font-medium text-brand hover:underline">
          {semua ? "Tampilkan lebih sedikit" : `Tampilkan semua (${n})`}
        </button>
      )}
    </section>
  );
}

function BarisTemuan({ nomor, onOpen, children }: { nomor: string | null; onOpen: (nomor: string) => void; children: React.ReactNode }) {
  return (
    <li>
      <button
        type="button"
        disabled={!nomor}
        onClick={() => nomor && onOpen(nomor)}
        className="flex w-full items-start gap-2 px-3 py-2 text-left transition-colors hover:bg-surface-2/60 focus-visible:bg-surface-2/60 focus-visible:outline-none disabled:cursor-default"
      >
        {children}
        {nomor && <ChevronRight className="mt-0.5 size-4 shrink-0 text-fg-subtle" aria-label="Buka jejak kunjungan" />}
      </button>
    </li>
  );
}

function BarisBatal({ b, pasien, pelaku, onOpen }: { b: TemuanBatal; pasien: string; pelaku: string; onOpen: (nomor: string) => void }) {
  return (
    <BarisTemuan nomor={b.kunjungan} onOpen={onOpen}>
      <span className="w-24 shrink-0 font-mono text-[11px] text-fg-muted">{fmtWaktu(b.waktu)}</span>
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-1.5">
          <Badge tone={KATEGORI_TONE[b.kategori]} className="px-1.5 text-[10px]">{KATEGORI[b.kategori].short}</Badge>
          <span className="text-sm text-fg line-through decoration-danger/60">{SUMBER[b.sumber].label}</span>
          <span className="text-xs text-fg-muted">· {pasien}</span>
        </span>
        {b.ringkasan && <span className="block truncate text-[11px] text-fg-muted">{b.ringkasan}</span>}
        <span className="block text-[11px] font-medium text-danger">{pelaku}</span>
      </span>
    </BarisTemuan>
  );
}

function BarisTtv({ t, pasien, onOpen, mode }: { t: TemuanTtv; pasien: string; onOpen: (nomor: string) => void; mode: "terlambat" | "takwajar" }) {
  return (
    <BarisTemuan nomor={t.kunjungan} onOpen={onOpen}>
      <span className="w-24 shrink-0 font-mono text-[11px] text-fg-muted">{fmtWaktu(t.waktu)}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm text-fg">{pasien}</span>
        {t.ringkasan && <span className="block truncate text-[11px] text-fg-muted">{t.ringkasan}</span>}
        {mode === "terlambat" ? (
          <span className="block text-[11px] font-medium text-warning">
            Diinput {formatLama(t.menit)} setelah pemeriksaan ({fmtWaktu(t.waktuInput)})
          </span>
        ) : (
          <span className="block text-[11px] font-medium text-fg-muted">{t.peringatan}</span>
        )}
      </span>
    </BarisTemuan>
  );
}

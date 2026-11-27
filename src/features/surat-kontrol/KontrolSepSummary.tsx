"use client";

import { useMemo, useState } from "react";
import { Card } from "@/components/ui/Card";
import { formatDate, formatNumber } from "@/lib/format";
import { cn } from "@/lib/cn";
import { JENIS_KONTROL, type JenisKontrol } from "@/server/modules/surat-kontrol/surat-kontrol.constants";
import { rekapAudit, rekapPerHari, rekapPerRuangan, ringkasSep, type RekapAngka } from "@/server/modules/surat-kontrol/surat-kontrol.sep";
import { LAYANAN_SEP, STATUS_SEP, type StatusSep } from "@/server/modules/surat-kontrol/surat-kontrol.sep.constants";
import type { AuditKontrolSep } from "@/server/modules/surat-kontrol/surat-kontrol.sep.types";
import { persenId, WARNA } from "./pulang.ui";
import { SebaranHarianChart, type SeriBatang } from "./SebaranHarianChart";
import { warnaStatusSep } from "./sep.ui";

const FOKUS = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring";
const JENIS: readonly JenisKontrol[] = [2, 1];

/** Kolom audit BPJS — warna = status yang sama dengan daftar (teks label selalu ada). */
const KOLOM = [
  { k: "kurang", status: "SEBELUM_SEP", label: "Surkon < SEP", ket: "dibuat sebelum hari SEP (setelah pelayanan sebelumnya selesai)" },
  { k: "sama", status: "SAMA_HARI", label: "Surkon = SEP", ket: "dibuat di hari SEP" },
  { k: "lebih", status: "SETELAH_SEP", label: "Surkon > SEP", ket: "dibuat setelah SEP terbit" },
] as const satisfies readonly { k: keyof RekapAngka; status: StatusSep; label: string; ket: string }[];

const SERI_REKAP: readonly SeriBatang<"SEBELUM_SEP" | "SETELAH_SEP" | "SAMA_HARI">[] = [
  { key: "SEBELUM_SEP", label: "Surkon < SEP", color: WARNA.success.css },
  { key: "SETELAH_SEP", label: "Surkon > SEP", color: WARNA.warning.css },
  { key: "SAMA_HARI", label: "Surkon = SEP", color: WARNA.danger.css },
];

/** Nada persentase "setelah selesai pelayanan" (selalu disertai angka). */
const nadaPersen = (p: number | null) => (p == null ? WARNA.neutral : p >= 80 ? WARNA.success : p >= 50 ? WARNA.warning : WARNA.danger);

/** Urutan segmen pemakaian surat (basis tanggal rencana / daftar VClaim). */
const PEMAKAIAN: readonly StatusSep[] = ["SEBELUM_SEP", "SETELAH_SEP", "SAMA_HARI", "TAK_TERBACA", "SEP_TAK_TERCATAT", "BELUM_DIPAKAI"];

type Cakupan = "kontrol" | "spri";

/**
 * Summary "Kontrol = SEP": gabungan Surat Kontrol & SPRI.
 * - Angka utama & pemakaian surat: daftar VClaim (tanggal RENCANA).
 * - Rekap format audit BPJS (Surkon < / = / > SEP, % setelah selesai pelayanan), grafik
 *   harian & per ruangan: SEP tidak batal bertanggal SEP di rentang — basis tarikan BPJS.
 * Angka di tabel bisa diklik untuk membuka daftar (yang memakai tanggal rencana).
 */
export function KontrolSepSummary({ d, onBuka }: { d: AuditKontrolSep; onBuka: (c: Cakupan, s?: StatusSep) => void }) {
  const [hari, setHari] = useState<string | null>(null);
  const [semuaRuangan, setSemuaRuangan] = useState(false);
  const surat = useMemo(() => ({ 2: ringkasSep(d.baris.filter((e) => e.surat.jenis === 2)), 1: ringkasSep(d.baris.filter((e) => e.surat.jenis === 1)) }), [d]);
  const semua = useMemo(() => ringkasSep(d.baris), [d]);
  const rekap = useMemo(() => rekapAudit(d.rekap), [d]);
  const harian = useMemo(() => rekapPerHari(d.rekap, d.rentang.from, d.rentang.to), [d]);
  const perRuangan = useMemo(() => rekapPerRuangan(d.rekap), [d]);
  const rentang = `${formatDate(d.rentang.from)} – ${formatDate(d.rentang.to)}`;
  const BATAS = 8;
  const ruanganTampil = semuaRuangan ? perRuangan : perRuangan.slice(0, BATAS);
  const cakupanJenis = (j: JenisKontrol): Cakupan => (j === 2 ? "kontrol" : "spri");

  return (
    <div className="space-y-4">
      {/* Angka utama */}
      <section aria-labelledby="kss-kpi" className="space-y-2">
        <h2 id="kss-kpi" className="sr-only">Angka utama</h2>
        <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 xl:grid-cols-4">
          <Kpi judul="Surat di BPJS (VClaim)" nilai={formatNumber(semua.total)} ket={`rencana ${rentang}`}>
            Surat Kontrol <b className="font-semibold text-fg tabular">{formatNumber(surat[2].total)}</b> · SPRI{" "}
            <b className="font-semibold text-fg tabular">{formatNumber(surat[1].total)}</b>
          </Kpi>
          {/* Fokus Surat Kontrol: SPRI hampir selalu dipakai (dibuat bersama SEP rawat inap) → cukup di rincian. */}
          <Kpi
            judul="Surat Kontrol dipakai SEP"
            nilai={formatNumber(surat[2].dipakai)}
            dari={formatNumber(surat[2].total)}
            ket={surat[2].total ? `${persenId(Math.round((surat[2].dipakai / surat[2].total) * 1000) / 10)} sudah dipakai pasien untuk kontrol` : undefined}
          >
            {surat[2].perStatus.BELUM_DIPAKAI > 0 ? (
              <button type="button" onClick={() => onBuka("kontrol", "BELUM_DIPAKAI")} className={cn("relative rounded-sm text-left underline-offset-2 hover:text-fg hover:underline", FOKUS)}>
                <b className="font-semibold text-fg tabular">{formatNumber(surat[2].perStatus.BELUM_DIPAKAI)}</b> belum dipakai
                <span className="sr-only">: buka daftar Surat Kontrol yang belum dipakai SEP</span>
              </button>
            ) : (
              "Semua sudah dipakai"
            )}
            {surat[2].perStatus.SEP_TAK_TERCATAT > 0 && <> · {formatNumber(surat[2].perStatus.SEP_TAK_TERCATAT)} SEP tak tercatat</>}
            {surat[1].total > 0 && (
              <>
                {" · "}SPRI <b className="font-semibold text-fg tabular">{formatNumber(surat[1].dipakai)}</b> dari {formatNumber(surat[1].total)} dipakai
                {surat[1].perStatus.SEP_TAK_TERCATAT > 0 && <> ({formatNumber(surat[1].perStatus.SEP_TAK_TERCATAT)} SEP tak tercatat)</>}
              </>
            )}
          </Kpi>
          <Kpi
            judul="Dibuat setelah selesai pelayanan"
            nilai={persenId(rekap.total.persen)}
            nada={nadaPersen(rekap.total.persen).teks}
            ket={`Surkon < SEP · ${formatNumber(rekap.total.kurang)} dari ${formatNumber(rekap.total.total)} SEP`}
          >
            Surat Kontrol <b className="font-semibold text-fg tabular">{persenId(rekap.perJenis[2].persen)}</b> · SPRI{" "}
            <b className="font-semibold text-fg tabular">{persenId(rekap.perJenis[1].persen)}</b>
          </Kpi>
          <Kpi judul="Surat = SEP" nilai={formatNumber(rekap.total.sama)} nada={rekap.total.sama > 0 ? WARNA.danger.teks : undefined} ket={`dibuat di hari SEP · > SEP ${formatNumber(rekap.total.lebih)}`}>
            Surat Kontrol <b className="font-semibold text-fg tabular">{formatNumber(rekap.perJenis[2].sama)}</b> · SPRI{" "}
            <b className="font-semibold text-fg tabular">{formatNumber(rekap.perJenis[1].sama)}</b>
          </Kpi>
        </div>
      </section>

      {/* Tabel format audit BPJS */}
      <Card className="min-w-0 overflow-hidden">
        <section aria-labelledby="kss-audit-judul">
          <div className="border-b border-border px-4 py-3">
            <h2 id="kss-audit-judul" className="text-sm font-semibold text-fg">Rekap format audit BPJS</h2>
            <p className="mt-0.5 text-xs text-fg-muted [text-wrap:pretty]">
              Tanggal pembuatan surat dibanding tanggal SEP yang memakainya · SEP tidak batal bertanggal {rentang} (basis yang sama dengan tarikan audit BPJS). Persentase = Surkon &lt; SEP ÷ Grand Total.
            </p>
          </div>
          <div role="region" aria-labelledby="kss-audit-judul" tabIndex={0} className={cn("overflow-x-auto focus-visible:ring-inset", FOKUS)}>
            <table className="w-full min-w-[640px] border-separate border-spacing-0 text-sm">
              <caption className="sr-only">Rekap audit BPJS per jenis surat: Surkon kurang dari, sama dengan, dan lebih dari tanggal SEP, total, dan persentase dibuat setelah selesai pelayanan</caption>
              <thead className="bg-surface-2/60 text-left text-[11px] font-semibold text-fg-muted">
                <tr>
                  <th scope="col" className="sticky left-0 z-10 border-b border-border bg-surface-2 py-2 pr-2 pl-4">Jenis surat</th>
                  {KOLOM.map((c) => (
                    <th key={c.k} scope="col" className="border-b border-border px-2 py-2 text-right" title={c.ket}>
                      <span className="inline-flex items-center gap-1.5">
                        <span className={cn("size-2 rounded-[2px]", warnaStatusSep(c.status).isi)} aria-hidden />
                        {c.label}
                      </span>
                    </th>
                  ))}
                  <th scope="col" className="border-b border-border px-2 py-2 text-right">Grand total</th>
                  <th scope="col" className="border-b border-border py-2 pr-4 pl-2">Dibuat setelah selesai pelayanan</th>
                </tr>
              </thead>
              <tbody>
                {JENIS.map((j) => (
                  <BarisAudit key={j} label={JENIS_KONTROL[j].label} kode={j} x={rekap.perJenis[j]} onBuka={(s) => onBuka(cakupanJenis(j), s)} />
                ))}
                <BarisAudit label="Total" x={rekap.total} tebal />
              </tbody>
            </table>
          </div>
          {rekap.total.takTerbaca > 0 && (
            <p className="border-t border-border px-4 py-2 text-[11px] text-fg-subtle">{formatNumber(rekap.total.takTerbaca)} SEP tidak dihitung karena tanggal entri suratnya belum terbaca.</p>
          )}
          <p className="border-t border-border px-4 py-2 text-[11px] text-fg-subtle">Klik angka untuk membuka daftar surat (daftar memakai tanggal rencana, jumlahnya bisa sedikit berbeda).</p>
        </section>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        {/* Pemakaian surat per jenis (VClaim) */}
        <Card className="min-w-0 p-4">
          <section aria-labelledby="kss-pakai-judul">
            <h2 id="kss-pakai-judul" className="text-sm font-semibold text-fg">Pemakaian surat (VClaim)</h2>
            <p className="text-xs text-fg-muted">Surat menurut tanggal rencana {rentang}, dibanding SEP pemakainya.</p>
            <ul className="mt-4 space-y-4">
              {JENIS.map((j) => {
                const x = surat[j];
                return (
                  <li key={j}>
                    <p className="mb-1.5 flex items-baseline justify-between gap-2 text-xs">
                      <span className="font-medium text-fg">
                        {JENIS_KONTROL[j].label} <span className="font-normal text-fg-subtle">· kode {j}</span>
                      </span>
                      <span className="text-fg-muted tabular">{formatNumber(x.total)} surat</span>
                    </p>
                    <span className="flex h-3 w-full gap-0.5 overflow-hidden rounded-full bg-chart-track" aria-hidden>
                      {x.total > 0 &&
                        PEMAKAIAN.map((s) =>
                          x.perStatus[s] > 0 ? (
                            <span key={s} className={cn("h-full first:rounded-l-full last:rounded-r-full", warnaStatusSep(s).isi)} style={{ width: `${(x.perStatus[s] / x.total) * 100}%` }} />
                          ) : null,
                        )}
                    </span>
                    <ul className="mt-2 grid grid-cols-1 gap-x-3 gap-y-0.5 text-[11px] min-[420px]:grid-cols-2" aria-label={`Pemakaian ${JENIS_KONTROL[j].label}`}>
                      {PEMAKAIAN.filter((s) => x.perStatus[s] > 0).map((s) => (
                        <li key={s}>
                          <button
                            type="button"
                            onClick={() => onBuka(cakupanJenis(j), s)}
                            className={cn("flex w-full items-center gap-1.5 rounded-sm text-left text-fg-muted hover:text-fg", FOKUS)}
                          >
                            <span className={cn("size-2 shrink-0 rounded-[2px]", warnaStatusSep(s).isi)} aria-hidden />
                            <span className="truncate">{STATUS_SEP[s].label}</span>
                            <b className="ml-auto font-semibold text-fg tabular">{formatNumber(x.perStatus[s])}</b>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </li>
                );
              })}
            </ul>
          </section>
        </Card>

        {/* Sebaran harian (basis SEP) */}
        <Card className="min-w-0 p-4">
          <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-sm font-semibold text-fg">Sebaran per tanggal SEP</h2>
            <span className="text-[11px] text-fg-subtle">Surat Kontrol &amp; SPRI · titik = hari ini</span>
          </div>
          <SebaranHarianChart
            data={harian}
            seri={SERI_REKAP}
            hariIni={d.hariIni}
            aktif={hari}
            satuan="SEP"
            judul="Sebaran SEP bersurat per tanggal SEP menurut tanggal pembuatan surat: sebelum, sama dengan, atau setelah SEP"
            onPilih={setHari}
          />
          {hari && (
            <p className="mt-2 text-xs text-fg-muted" role="status">
              {formatDate(hari)}:{" "}
              {(() => {
                const h = harian.find((x) => x.tanggal === hari);
                return h ? `< SEP ${h.SEBELUM_SEP} · = SEP ${h.SAMA_HARI} · > SEP ${h.SETELAH_SEP}` : "—";
              })()}
            </p>
          )}
        </Card>
      </div>

      {/* Per ruangan / poli SEP */}
      <Card className="min-w-0 overflow-hidden">
        <section aria-labelledby="kss-ruangan-judul">
          <div className="border-b border-border px-4 py-3">
            <h2 id="kss-ruangan-judul" className="text-sm font-semibold text-fg">Rekap per ruangan / poli SEP</h2>
            <p className="mt-0.5 text-xs text-fg-muted">Format audit BPJS per unit · urut jumlah SEP terbanyak.</p>
          </div>
          {perRuangan.length === 0 ? (
            <p className="px-4 py-8 text-center text-xs text-fg-subtle">Tidak ada SEP bersurat pada rentang ini.</p>
          ) : (
            <div role="region" aria-labelledby="kss-ruangan-judul" tabIndex={0} className={cn("overflow-x-auto focus-visible:ring-inset", FOKUS)}>
              <table className="w-full min-w-[720px] border-separate border-spacing-0 text-sm">
                <caption className="sr-only">Rekap audit BPJS per ruangan atau poli: Surat Kontrol dan SPRI kurang dari, sama dengan, lebih dari tanggal SEP, total, dan persentase</caption>
                <thead className="bg-surface-2/60 text-left text-[11px] font-semibold text-fg-muted">
                  <tr>
                    <th scope="col" rowSpan={2} className="sticky left-0 z-10 border-b border-border bg-surface-2 py-2 pr-2 pl-4 align-bottom">Ruangan / poli</th>
                    <th scope="colgroup" colSpan={3} className="border-b border-border px-2 pt-2 pb-1 text-center">Surat Kontrol</th>
                    <th scope="colgroup" colSpan={3} className="border-b border-border px-2 pt-2 pb-1 text-center">SPRI</th>
                    <th scope="col" rowSpan={2} className="border-b border-border px-2 py-2 text-right align-bottom">Total SEP</th>
                    <th scope="col" rowSpan={2} className="border-b border-border py-2 pr-4 pl-2 align-bottom">Setelah selesai pelayanan</th>
                  </tr>
                  <tr>
                    {JENIS.flatMap((j) =>
                      KOLOM.map((c) => (
                        <th key={`${j}-${c.k}`} scope="col" className="border-b border-border px-2 pb-2 text-right font-medium">
                          <span className="sr-only">{JENIS_KONTROL[j].label} </span>
                          {c.label.replace("Surkon ", "")}
                        </th>
                      )),
                    )}
                  </tr>
                </thead>
                <tbody>
                  {ruanganTampil.map((r) => (
                    <tr key={`${r.layanan}|${r.ruangan}`} className="hover:bg-surface-2/40">
                      <th scope="row" className="sticky left-0 z-10 border-b border-border bg-surface py-2 pr-2 pl-4 text-left font-normal">
                        <span className="flex items-center gap-1.5">
                          <span className="shrink-0 rounded bg-surface-2 px-1 text-[10px] font-semibold text-fg-muted">{LAYANAN_SEP[r.layanan].pendek}</span>
                          <span className="max-w-52 truncate text-xs font-medium text-fg" title={r.ruangan}>{r.ruangan}</span>
                        </span>
                      </th>
                      {JENIS.flatMap((j) =>
                        KOLOM.map((c) => {
                          const n = r.perJenis[j][c.k];
                          return (
                            <td key={`${j}-${c.k}`} className={cn("border-b border-border px-2 py-2 text-right text-xs tabular", n === 0 ? "text-fg-subtle" : c.status === "SAMA_HARI" ? "font-semibold text-danger" : c.status === "SETELAH_SEP" ? "font-semibold text-warning" : "text-fg")}>
                              {formatNumber(n)}
                            </td>
                          );
                        }),
                      )}
                      <td className="border-b border-border px-2 py-2 text-right text-xs font-semibold text-fg tabular">{formatNumber(r.total.total)}</td>
                      <td className="border-b border-border py-2 pr-4 pl-2">
                        <BatangPersen p={r.total.persen} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {perRuangan.length > BATAS && (
            <div className="border-t border-border px-4 py-2">
              <button type="button" onClick={() => setSemuaRuangan((v) => !v)} className={cn("rounded-sm text-[11px] font-medium text-brand hover:underline", FOKUS)}>
                {semuaRuangan ? "Tampilkan lebih sedikit" : `Tampilkan semua (${formatNumber(perRuangan.length)})`}
              </button>
            </div>
          )}
        </section>
      </Card>
    </div>
  );
}

/** Tile angka utama (`<article>`: judul → angka → rincian). */
function Kpi({ judul, nilai, dari, ket, nada, children }: { judul: string; nilai: string; dari?: string; ket?: string; nada?: string; children?: React.ReactNode }) {
  return (
    <article className="flex min-w-0 flex-col rounded-[var(--radius-lg)] border border-border bg-surface p-4 shadow-xs">
      <h3 className="text-xs font-medium text-fg-muted">{judul}</h3>
      <p className={cn("mt-1 text-3xl font-semibold tracking-tight tabular", nada ?? "text-fg")}>
        {nilai}
        {dari && <span className="ml-1.5 text-sm font-medium tracking-normal text-fg-muted">dari {dari}</span>}
      </p>
      {ket && <p className="text-[11px] text-fg-subtle">{ket}</p>}
      {children && <div className="mt-2 border-t border-border pt-2 text-xs text-fg-muted">{children}</div>}
    </article>
  );
}

function BarisAudit({ label, kode, x, tebal = false, onBuka }: { label: string; kode?: JenisKontrol; x: RekapAngka; tebal?: boolean; onBuka?: (s: StatusSep) => void }) {
  const sel = cn("border-b border-border px-2 py-2.5 text-right tabular", tebal && "bg-surface-2/50 font-semibold");
  return (
    <tr>
      <th scope="row" className={cn("sticky left-0 z-10 border-b border-border py-2.5 pr-2 pl-4 text-left", tebal ? "bg-surface-2 font-semibold text-fg" : "bg-surface font-medium text-fg")}>
        {label}
        {kode && <span className="ml-1 text-[11px] font-normal text-fg-subtle">· kode {kode}</span>}
      </th>
      {KOLOM.map((c) => {
        const n = x[c.k];
        const teks = <span className={cn(n > 0 && c.status === "SAMA_HARI" && "text-danger", n > 0 && c.status === "SETELAH_SEP" && "text-warning")}>{formatNumber(n)}</span>;
        return (
          <td key={c.k} className={sel}>
            {onBuka && n > 0 ? (
              <button type="button" onClick={() => onBuka(c.status)} className={cn("rounded-sm font-semibold underline-offset-2 hover:underline", FOKUS)} aria-label={`${formatNumber(n)} ${label} ${c.label}: buka daftar`}>
                {teks}
              </button>
            ) : (
              teks
            )}
          </td>
        );
      })}
      <td className={sel}>{formatNumber(x.total)}</td>
      <td className={cn("border-b border-border py-2.5 pr-4 pl-2", tebal && "bg-surface-2/50")}>
        <BatangPersen p={x.persen} tebal={tebal} />
      </td>
    </tr>
  );
}

/** Persentase "setelah selesai pelayanan": angka (selalu) + batang dekoratif berwarna menurut ambang. */
function BatangPersen({ p, tebal = false }: { p: number | null; tebal?: boolean }) {
  const w = nadaPersen(p);
  return (
    <span className="flex min-w-36 items-center gap-2">
      <span className="h-2 flex-1 overflow-hidden rounded-full bg-chart-track" aria-hidden>
        {p != null && <span className={cn("block h-full rounded-full", w.isi)} style={{ width: `${Math.max(p, p > 0 ? 2 : 0)}%` }} />}
      </span>
      <span className={cn("w-14 text-right text-xs tabular", tebal ? "font-semibold" : "font-medium", w.teks)}>{persenId(p)}</span>
    </span>
  );
}

"use client";

import { cn } from "@/lib/cn";
import { formatNumber } from "@/lib/format";
import { KOLOM_RL35 } from "@/server/modules/rl35/rl35.constants";
import type { NilaiRl35 } from "@/server/modules/rl35/rl35.types";

const TH = "border-b border-l border-border px-2 py-2 text-center text-[11px] font-semibold leading-tight text-fg-muted";
const TD = "px-2 py-2 text-right tabular";
/** Garis pemisah di kolom pertama tiap grup (Dalam / Luar / Total). */
const AWAL_GRUP = new Set(KOLOM_RL35.map((k, i) => (i === 0 || KOLOM_RL35[i - 1].grup !== k.grup ? i : -1)));
const GRUP = [...new Set(KOLOM_RL35.map((k) => k.grup))].map((g) => ({ g, n: KOLOM_RL35.filter((k) => k.grup === g).length }));

function Bilangan({ n, tebal }: { n: number; tebal?: boolean }) {
  return <span className={cn(n === 0 ? "text-fg-subtle" : "text-fg", tebal && "font-semibold")}>{formatNumber(n)}</span>;
}

/** Baris ekor berangka tunggal (formulir baris 66 & 77), ditampilkan di kolom Jumlah. */
export type BarisEkor = { kode: string; label: string; nilai: string; keterangan: string };

/**
 * Matriks RL 3.5 sesuai formulir SIRS 6: kolom pengenal (lengket saat digeser)
 * + kunjungan dalam / luar kab/kota (L, P) + total kunjungan (L, P, Jumlah).
 * Dipakai untuk tab per jenis kegiatan & per ruangan.
 */
export function TabelRl35<T>({
  baris,
  kunci,
  nilai,
  kepala,
  sel,
  redup,
  rincian,
  total,
  labelTotal,
  ekor = [],
}: {
  baris: T[];
  kunci: (row: T) => string;
  nilai: (row: T) => NilaiRl35;
  kepala: string;
  sel: (row: T) => React.ReactNode;
  redup?: (row: T) => boolean;
  /** Baris rincian (bagian ruangan yang pindah baris): kecil, latar redup. */
  rincian?: (row: T) => boolean;
  total: NilaiRl35;
  labelTotal: string;
  ekor?: BarisEkor[];
}) {
  const angka = (n: NilaiRl35, tebal = false) =>
    KOLOM_RL35.map((k, i) => (
      <td key={k.ambil} className={cn(TD, AWAL_GRUP.has(i) && "border-l border-border")}>
        <Bilangan n={n[k.ambil]} tebal={tebal || k.ambil === "total"} />
      </td>
    ));

  return (
    <div className="w-full overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead className="bg-surface-2/60">
          <tr>
            <th
              rowSpan={2}
              scope="col"
              className="sticky left-0 z-10 min-w-[11rem] border-b border-border bg-surface-2 px-3 py-2 text-left text-xs font-semibold text-fg-muted sm:min-w-[16rem] sm:px-4"
            >
              {kepala}
            </th>
            {GRUP.map(({ g, n }) => (
              <th key={g} colSpan={n} scope="colgroup" className={TH}>
                {g}
              </th>
            ))}
          </tr>
          <tr>
            {KOLOM_RL35.map((k, i) => (
              <th
                key={k.ambil}
                scope="col"
                title={`${k.grup} — ${k.sub === "L" ? "laki-laki" : k.sub === "P" ? "perempuan" : "jumlah"}`}
                className={cn(
                  "border-b border-border px-2 py-2 text-center text-[11px] font-semibold text-fg-muted",
                  AWAL_GRUP.has(i) && "border-l",
                  k.sub === "Jumlah" ? "min-w-[5rem]" : "min-w-[3.5rem]",
                )}
              >
                {k.sub}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {baris.map((row) => {
            const rinci = rincian?.(row) ?? false;
            return (
              <tr
                key={kunci(row)}
                data-rincian={rinci || undefined}
                className={cn(
                  "group border-b border-border transition-colors hover:bg-surface-2/50",
                  redup?.(row) && "opacity-70",
                  rinci && "bg-surface-2/40 text-xs text-fg-muted",
                )}
              >
                <th
                  scope="row"
                  className={cn(
                    "sticky left-0 z-10 max-w-[13rem] px-3 py-2 text-left font-normal group-hover:bg-surface-2 sm:max-w-[22rem] sm:px-4",
                    rinci ? "bg-surface-2" : "bg-surface",
                  )}
                >
                  {sel(row)}
                </th>
                {angka(nilai(row))}
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="bg-surface-2/70 font-semibold">
            <th scope="row" className="sticky left-0 z-10 bg-surface-2 px-4 py-2.5 text-left text-sm text-fg">
              {labelTotal}
            </th>
            {angka(total, true)}
          </tr>
          {ekor.map((e) => (
            <tr key={e.kode} data-ekor={e.kode} className="border-t border-border">
              <th scope="row" className="sticky left-0 z-10 bg-surface px-4 py-2 text-left font-normal">
                <p className="font-medium text-fg">
                  <span className="mr-1.5 tabular text-fg-subtle">{e.kode}.</span>
                  {e.label}
                </p>
                <p className="text-[11px] text-fg-subtle">{e.keterangan}</p>
              </th>
              <td colSpan={KOLOM_RL35.length - 1} className="border-l border-border" />
              <td className={cn(TD, "border-l border-border font-semibold text-fg")}>{e.nilai}</td>
            </tr>
          ))}
        </tfoot>
      </table>
    </div>
  );
}

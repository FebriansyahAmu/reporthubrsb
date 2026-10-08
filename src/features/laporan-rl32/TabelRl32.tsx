"use client";

import { Fragment } from "react";
import { cn } from "@/lib/cn";
import { formatNumber } from "@/lib/format";
import { grupMetrik, LABEL_TEMPAT_TIDUR, METRIK_RL32 } from "@/server/modules/rl32/rl32.constants";
import type { Angka, NilaiRl32 } from "@/server/modules/rl32/rl32.types";

const GRUP = grupMetrik();

const TH = "border-b border-l border-border px-2 py-2 text-center text-[11px] font-semibold leading-tight text-fg-muted";
const TD = "border-l border-border px-2 py-2 text-right tabular";

function Bilangan({ n, tebal }: { n: number; tebal?: boolean }) {
  return <span className={cn(n === 0 ? "text-fg-subtle" : "text-fg", tebal && "font-semibold")}>{formatNumber(n)}</span>;
}

/**
 * Matriks RL 3.2: satu kolom pengenal (lengket saat digeser) + 17 kolom angka
 * (grup bertingkat sesuai formulir) + alokasi TT. `lp` merinci tiap kolom jadi
 * L / P / Jml. Dipakai untuk tab per jenis pelayanan & per ruangan.
 */
export function TabelRl32<T>({
  lp,
  baris,
  kunci,
  nilai,
  kepala,
  sel,
  redup,
  rincian,
  total,
  labelTotal,
}: {
  lp: boolean;
  baris: T[];
  kunci: (row: T) => string;
  nilai: (row: T) => NilaiRl32;
  kepala: string;
  sel: (row: T) => React.ReactNode;
  redup?: (row: T) => boolean;
  /** Baris rincian (sub-baris ruangan yang dipisah menurut DPJP): kecil, latar redup. */
  rincian?: (row: T) => boolean;
  total: NilaiRl32;
  labelTotal: string;
}) {
  const lebar = lp ? 3 : 1;
  const tingkat = lp ? 3 : 2;

  const selAngka = (a: Angka, tebal = false) =>
    lp ? (
      <>
        <td className={TD}>
          <Bilangan n={a.lk} />
        </td>
        <td className="px-2 py-2 text-right tabular">
          <Bilangan n={a.pr} />
        </td>
        <td className="px-2 py-2 text-right tabular">
          <Bilangan n={a.total} tebal />
        </td>
      </>
    ) : (
      <td className={TD}>
        <Bilangan n={a.total} tebal={tebal} />
      </td>
    );

  const selTT = (tt: number | null) => (
    <td className={TD}>{tt == null ? <span className="text-fg-subtle">—</span> : <Bilangan n={tt} />}</td>
  );

  return (
    <div className="w-full overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead className="bg-surface-2/60">
          <tr>
            <th
              rowSpan={tingkat}
              scope="col"
              className="sticky left-0 z-10 min-w-[15rem] border-b border-border bg-surface-2 px-4 py-2 text-left text-xs font-semibold text-fg-muted"
            >
              {kepala}
            </th>
            {GRUP.map((g) =>
              g.grup ? (
                <th key={g.grup} colSpan={g.metrik.length * lebar} scope="colgroup" className={TH}>
                  {g.grup}
                </th>
              ) : (
                <th
                  key={g.metrik[0].key}
                  rowSpan={2}
                  colSpan={lebar}
                  scope="col"
                  title={g.metrik[0].label}
                  className={cn(TH, lp ? "min-w-[7.5rem]" : "min-w-[4.75rem]")}
                >
                  {g.metrik[0].sub}
                </th>
              ),
            )}
            <th rowSpan={tingkat} scope="col" title={LABEL_TEMPAT_TIDUR} className={cn(TH, "min-w-[4.75rem]")}>
              Alokasi TT
            </th>
          </tr>
          <tr>
            {GRUP.filter((g) => g.grup).flatMap((g) =>
              g.metrik.map((m) => (
                <th key={m.key} colSpan={lebar} scope="col" title={m.label} className={cn(TH, lp ? "min-w-[7.5rem]" : "min-w-[4.75rem]")}>
                  {m.sub}
                </th>
              )),
            )}
          </tr>
          {lp && (
            <tr>
              {METRIK_RL32.map((m) => (
                <Fragment key={m.key}>
                  <th scope="col" className={TH}>
                    L
                  </th>
                  <th scope="col" className="border-b border-border px-2 py-2 text-center text-[11px] font-semibold text-fg-muted">
                    P
                  </th>
                  <th scope="col" className="border-b border-border px-2 py-2 text-center text-[11px] font-semibold text-fg-muted">
                    Jml
                  </th>
                </Fragment>
              ))}
            </tr>
          )}
        </thead>
        <tbody>
          {baris.map((row) => {
            const n = nilai(row);
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
                    "sticky left-0 z-10 max-w-[20rem] px-4 py-2 text-left font-normal group-hover:bg-surface-2",
                    rinci ? "bg-surface-2" : "bg-surface",
                  )}
                >
                  {sel(row)}
                </th>
                {METRIK_RL32.map((m) => (
                  <Fragment key={m.key}>{selAngka(n[m.key])}</Fragment>
                ))}
                {selTT(n.tempatTidur)}
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="bg-surface-2/70 font-semibold">
            <th scope="row" className="sticky left-0 z-10 bg-surface-2 px-4 py-2.5 text-left text-sm text-fg">
              {labelTotal}
            </th>
            {METRIK_RL32.map((m) => (
              <Fragment key={m.key}>{selAngka(total[m.key], true)}</Fragment>
            ))}
            {selTT(total.tempatTidur)}
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

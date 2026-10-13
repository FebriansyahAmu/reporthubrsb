"use client";

import { useState } from "react";
import { useMeasure } from "@/components/charts/useMeasure";
import { fmtDayLong, fmtDayShort, nf, niceMax } from "@/components/charts/format";
import { cn } from "@/lib/cn";
import type { HariRingkas } from "@/server/modules/surat-kontrol/surat-kontrol.filter";

const H = 216;
const M = { top: 10, right: 8, bottom: 22, left: 30 };
const SERI = [
  { key: "masalah", label: "Bermasalah", color: "var(--danger)" },
  { key: "tinjau", label: "Perlu ditinjau", color: "var(--warning)" },
  { key: "sesuai", label: "Sesuai", color: "var(--success)" },
] as const;

/**
 * Sebaran surat per tanggal rencana — batang bertumpuk per status (status =
 * warna cadangan; legenda & tooltip selalu berlabel). Klik batang = saring
 * daftar ke tanggal itu (klik lagi = lepas). Keyboard: Tab ke batang, Enter.
 */
export function SebaranHarianChart({
  data,
  hariIni,
  aktif,
  onPilih,
}: {
  data: HariRingkas[];
  hariIni: string;
  aktif: string | null;
  onPilih: (tanggal: string | null) => void;
}) {
  const [ref, width] = useMeasure<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const n = data.length;
  const innerW = Math.max(0, width - M.left - M.right);
  const innerH = H - M.top - M.bottom;
  const maxY = niceMax(Math.max(1, ...data.map((d) => d.masalah + d.tinjau + d.sesuai)));
  const band = n ? innerW / n : innerW;
  const barW = Math.max(3, Math.min(22, band * 0.68));
  const x = (i: number) => M.left + (i + 0.5) * band;
  const y = (v: number) => M.top + innerH - (v / maxY) * innerH;
  // Label sumbu-x jarang agar tak bertumpuk (± tiap 48 px).
  const langkah = Math.max(1, Math.ceil(48 / Math.max(1, band)));
  const hd = hover != null ? data[hover] : null;
  const tipLeft = hd ? Math.min(Math.max(x(hover!), 80), width - 80) : 0;

  return (
    <div>
      <div ref={ref} className="relative h-[216px]" onMouseLeave={() => setHover(null)}>
        {width > 0 && (
          <svg width={width} height={H} role="img" aria-label="Sebaran surat per tanggal rencana menurut status audit">
            {[0, 0.5, 1].map((f) => {
              const v = Math.round(maxY * f);
              return (
                <g key={f}>
                  <line x1={M.left} x2={width - M.right} y1={y(v)} y2={y(v)} stroke="var(--chart-grid)" />
                  <text x={M.left - 6} y={y(v) + 3} textAnchor="end" fontSize={10} fill="var(--chart-axis)">{nf(v)}</text>
                </g>
              );
            })}
            {data.map((d, i) => {
              const total = d.masalah + d.tinjau + d.sesuai;
              const dipilih = aktif === d.tanggal;
              const redup = aktif != null && !dipilih;
              let dasar = 0;
              return (
                <g
                  key={d.tanggal}
                  role="button"
                  tabIndex={total > 0 ? 0 : -1}
                  aria-label={`${fmtDayLong(d.tanggal)}: ${total} surat, ${d.masalah} bermasalah, ${d.tinjau} perlu ditinjau`}
                  aria-pressed={dipilih}
                  className="cursor-pointer outline-none [&:focus-visible>rect.fokus]:stroke-[var(--brand)]"
                  onMouseEnter={() => setHover(i)}
                  onFocus={() => setHover(i)}
                  onBlur={() => setHover(null)}
                  onClick={() => total > 0 && onPilih(dipilih ? null : d.tanggal)}
                  onKeyDown={(e) => {
                    if ((e.key === "Enter" || e.key === " ") && total > 0) {
                      e.preventDefault();
                      onPilih(dipilih ? null : d.tanggal);
                    }
                  }}
                >
                  {/* Area tekan selebar pita (lebih besar dari batang). */}
                  <rect className="fokus" x={x(i) - band / 2} y={M.top} width={band} height={innerH} fill={hover === i ? "var(--chart-grid)" : "transparent"} stroke="transparent" strokeWidth={1.5} rx={3} />
                  {SERI.map((s) => {
                    const v = d[s.key];
                    if (!v) return null;
                    const y0 = y(dasar + v);
                    const tinggi = y(dasar) - y0;
                    dasar += v;
                    return (
                      <rect key={s.key} x={x(i) - barW / 2} y={y0 + 1} width={barW} height={Math.max(0, tinggi - 1)} rx={2} fill={s.color} opacity={redup ? 0.28 : 1} />
                    );
                  })}
                  {d.tanggal === hariIni && <circle cx={x(i)} cy={H - 4} r={2.5} fill="var(--brand)" />}
                  {(i % langkah === 0 || dipilih) && (
                    <text x={x(i)} y={H - 9} textAnchor="middle" fontSize={10} fontWeight={dipilih ? 700 : 400} fill={dipilih ? "var(--fg)" : "var(--chart-axis)"}>
                      {fmtDayShort(d.tanggal)}
                    </text>
                  )}
                </g>
              );
            })}
          </svg>
        )}
        {hd && (
          <div
            className="pointer-events-none absolute top-0 z-10 w-40 -translate-x-1/2 rounded-[var(--radius-md)] border border-border bg-surface px-3 py-2 text-xs shadow-md"
            style={{ left: tipLeft }}
          >
            <p className="font-semibold text-fg">{fmtDayLong(hd.tanggal)}{hd.tanggal === hariIni ? " · hari ini" : ""}</p>
            {SERI.map((s) => (
              <p key={s.key} className="mt-0.5 flex items-center justify-between gap-2 text-fg-muted">
                <span className="flex items-center gap-1.5">
                  <span className="size-2 rounded-[2px]" style={{ background: s.color }} aria-hidden />
                  {s.label}
                </span>
                <b className="tabular text-fg">{nf(hd[s.key])}</b>
              </p>
            ))}
          </div>
        )}
      </div>
      <ul className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-fg-muted">
        {SERI.map((s) => (
          <li key={s.key} className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-[3px]" style={{ background: s.color }} aria-hidden />
            <span className="font-medium text-fg">{s.label}</span>
          </li>
        ))}
        <li className={cn("ml-auto text-[11px]", aktif ? "text-brand" : "text-fg-subtle")}>
          {aktif ? (
            <button type="button" className="font-medium underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring" onClick={() => onPilih(null)}>
              Lepas saringan {fmtDayLong(aktif)}
            </button>
          ) : (
            "Klik batang untuk menyaring tanggal"
          )}
        </li>
      </ul>
    </div>
  );
}

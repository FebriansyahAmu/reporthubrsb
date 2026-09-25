"use client";

import { useState } from "react";
import { Legend } from "@/components/charts/Legend";
import { useMeasure } from "@/components/charts/useMeasure";
import { fmtDayLong, fmtDayShort, nf, niceMax } from "@/components/charts/format";

export type TrendSeries = { key: string; label: string; color: string };
export type TrendRow = { date: string; values: number[] };

const H = 260;
const M = { top: 14, right: 14, bottom: 26, left: 40 };

/**
 * Area bertumpuk N-seri untuk tren harian (mis. Penambahan + Perubahan). Grid
 * resesif, x-tick jarang, crosshair + tooltip. Warna kategori (urutan tetap).
 */
export function AuditTrendChart({
  data,
  series,
  ariaLabel = "Tren harian",
}: {
  data: TrendRow[];
  series: TrendSeries[];
  ariaLabel?: string;
}) {
  const [ref, width] = useMeasure<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);

  const n = data.length;
  const innerW = Math.max(0, width - M.left - M.right);
  const innerH = H - M.top - M.bottom;
  const totals = data.map((d) => d.values.reduce((s, v) => s + v, 0));
  const maxY = niceMax(Math.max(1, ...totals));

  const x = (i: number) => (n <= 1 ? M.left + innerW / 2 : M.left + (i / (n - 1)) * innerW);
  const y = (v: number) => M.top + innerH - (v / maxY) * innerH;

  // Batas kumulatif per titik (bawah→atas) untuk tiap seri.
  const cum = data.map((d) => {
    const acc: number[] = [];
    let s = 0;
    for (const v of d.values) {
      acc.push(s);
      s += v;
    }
    acc.push(s); // total
    return acc;
  });

  function bandPath(si: number): string {
    const top = data.map((_, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(cum[i][si + 1]).toFixed(1)}`);
    const bot = data.map((_, i) => `L${x(n - 1 - i).toFixed(1)},${y(cum[n - 1 - i][si]).toFixed(1)}`);
    return `${top.join(" ")} ${bot.join(" ")} Z`;
  }
  const topLine = data.map((_, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(totals[i]).toFixed(1)}`).join(" ");

  const gridVals = [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(maxY * f));
  const xTickIdx = tickIndices(n, Math.min(7, n));

  const hd = hover != null ? data[hover] : null;
  const cx = hover != null ? x(hover) : 0;
  const tipLeft = width > 0 ? Math.min(Math.max(cx, 82), width - 82) : cx;
  const allZero = totals.every((t) => t === 0);

  return (
    <div>
      <Legend className="mb-3" items={series.map((s) => ({ label: s.label, color: s.color }))} />
      <div ref={ref} className="relative" style={{ height: H }}>
        {width > 0 && n > 0 && (
          <svg width={width} height={H} role="img" aria-label={ariaLabel}>
            {gridVals.map((v, i) => {
              const gy = y(v);
              return (
                <g key={i}>
                  <line x1={M.left} y1={gy} x2={width - M.right} y2={gy} stroke="var(--chart-grid)" strokeWidth={1} />
                  <text x={M.left - 8} y={gy + 3} textAnchor="end" fontSize={10} fill="var(--chart-axis)">{nf(v)}</text>
                </g>
              );
            })}
            {xTickIdx.map((i) => (
              <text key={i} x={x(i)} y={H - 8} textAnchor="middle" fontSize={10} fill="var(--chart-axis)">{fmtDayShort(data[i].date)}</text>
            ))}
            {!allZero && series.map((s, si) => (
              <path key={s.key} d={bandPath(si)} fill={s.color} fillOpacity={0.9} />
            ))}
            {!allZero && <path d={topLine} fill="none" stroke="var(--surface)" strokeWidth={1.5} strokeOpacity={0.5} />}
            {hd && (
              <g pointerEvents="none">
                <line x1={cx} y1={M.top} x2={cx} y2={M.top + innerH} stroke="var(--border-strong)" strokeWidth={1} strokeDasharray="3 3" />
                {series.map((s, si) => (
                  <circle key={s.key} cx={cx} cy={y(cum[hover!][si + 1])} r={3.5} fill={s.color} stroke="var(--surface)" strokeWidth={1.5} />
                ))}
              </g>
            )}
            <rect
              x={M.left} y={M.top} width={innerW} height={innerH} fill="transparent"
              onMouseMove={(e) => {
                const rect = (e.currentTarget.ownerSVGElement as SVGSVGElement).getBoundingClientRect();
                const mx = e.clientX - rect.left;
                const i = n <= 1 ? 0 : Math.round(((mx - M.left) / innerW) * (n - 1));
                setHover(Math.min(Math.max(i, 0), n - 1));
              }}
              onMouseLeave={() => setHover(null)}
            />
          </svg>
        )}
        {allZero && width > 0 && (
          <p className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-fg-muted">
            Tidak ada aktivitas pada rentang ini.
          </p>
        )}

        {hd && (
          <div
            className="pointer-events-none absolute z-10 w-[164px] -translate-x-1/2 rounded-[var(--radius-md)] border border-border bg-surface p-2.5 shadow-md"
            style={{ left: tipLeft, top: 4 }}
          >
            <p className="mb-1.5 text-[11px] font-semibold text-fg">{fmtDayLong(hd.date)}</p>
            {series.map((s, si) => (
              <div key={s.key} className="flex items-center justify-between py-0.5 text-[11px]">
                <span className="flex items-center gap-1.5 text-fg-muted">
                  <span className="size-2 rounded-[2px]" style={{ background: s.color }} />
                  {s.label}
                </span>
                <span className="tabular font-medium text-fg">{nf(hd.values[si])}</span>
              </div>
            ))}
            {series.length > 1 && (
              <div className="mt-1.5 flex items-center justify-between border-t border-border pt-1.5 text-[11px]">
                <span className="font-medium text-fg-muted">Total</span>
                <span className="tabular font-semibold text-fg">{nf(hd.values.reduce((s, v) => s + v, 0))}</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function tickIndices(n: number, count: number): number[] {
  if (n <= 0) return [];
  if (n <= count) return Array.from({ length: n }, (_, i) => i);
  const out: number[] = [];
  for (let k = 0; k < count; k++) out.push(Math.round((k / (count - 1)) * (n - 1)));
  return [...new Set(out)];
}

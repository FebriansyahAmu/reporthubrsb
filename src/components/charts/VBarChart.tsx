"use client";

import { useState } from "react";
import { useMeasure } from "./useMeasure";
import { nf, niceMax } from "./format";

export type VBarPoint = { label: string; value: number; hint?: string };

const H = 240;
const M = { top: 14, right: 12, bottom: 26, left: 40 };

/**
 * Bar vertikal seri tunggal (mis. tren perolehan per tahun) — sumbu nilai,
 * grid resesif, ujung bar membulat, tooltip hover. Warna magnitudo satu hue.
 */
export function VBarChart({
  data,
  color = "var(--brand)",
  ariaLabel = "Diagram batang",
}: {
  data: VBarPoint[];
  color?: string;
  ariaLabel?: string;
}) {
  const [ref, width] = useMeasure<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);

  const n = data.length;
  if (n === 0) return <p className="py-10 text-center text-sm text-fg-muted">Tidak ada data.</p>;

  const innerW = Math.max(0, width - M.left - M.right);
  const innerH = H - M.top - M.bottom;
  const maxY = niceMax(Math.max(1, ...data.map((d) => d.value)));
  const band = n > 0 ? innerW / n : innerW;
  const barW = Math.min(46, band * 0.62);

  const cx = (i: number) => M.left + (i + 0.5) * band;
  const y = (v: number) => M.top + innerH - (v / maxY) * innerH;
  const gridVals = [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(maxY * f));

  const hd = hover != null ? data[hover] : null;
  const tipLeft = width > 0 && hover != null ? Math.min(Math.max(cx(hover), 82), width - 82) : 0;

  return (
    <div ref={ref} className="relative" style={{ height: H }}>
      {width > 0 && (
        <svg width={width} height={H} role="img" aria-label={ariaLabel}>
          {/* grid + y labels */}
          {gridVals.map((v, i) => {
            const gy = y(v);
            return (
              <g key={i}>
                <line x1={M.left} y1={gy} x2={width - M.right} y2={gy} stroke="var(--chart-grid)" strokeWidth={1} />
                <text x={M.left - 8} y={gy + 3} textAnchor="end" fontSize={10} fill="var(--chart-axis)">{nf(v)}</text>
              </g>
            );
          })}
          {/* bars */}
          {data.map((d, i) => {
            const bx = cx(i) - barW / 2;
            const by = y(d.value);
            const bh = Math.max(0, M.top + innerH - by);
            const active = hover == null || hover === i;
            return (
              <g key={d.label}>
                <rect
                  x={bx} y={by} width={barW} height={bh} rx={4} ry={4}
                  fill={color} fillOpacity={active ? 1 : 0.35}
                  style={{ transition: "fill-opacity 120ms" }}
                />
                {/* tutup sudut bawah agar menempel baseline */}
                {bh > 4 && <rect x={bx} y={by + bh - 4} width={barW} height={4} fill={color} fillOpacity={active ? 1 : 0.35} />}
                <text x={cx(i)} y={H - 8} textAnchor="middle" fontSize={10} fill="var(--chart-axis)">{d.label}</text>
                {/* hit area */}
                <rect
                  x={cx(i) - band / 2} y={M.top} width={band} height={innerH} fill="transparent"
                  onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}
                />
              </g>
            );
          })}
        </svg>
      )}

      {hd && (
        <div
          className="pointer-events-none absolute z-10 min-w-[132px] -translate-x-1/2 rounded-[var(--radius-md)] border border-border bg-surface p-2.5 shadow-md"
          style={{ left: tipLeft, top: 4 }}
        >
          <p className="mb-1 text-[11px] font-semibold text-fg">{hd.label}</p>
          <div className="flex items-center justify-between gap-4 text-[11px]">
            <span className="text-fg-muted">Jumlah</span>
            <span className="tabular font-semibold text-fg">{nf(hd.value)}</span>
          </div>
          {hd.hint && <p className="tabular mt-0.5 text-[11px] text-fg-subtle">{hd.hint}</p>}
        </div>
      )}
    </div>
  );
}

"use client";

import { useState } from "react";
import type { TrendPoint } from "@/server/modules/dashboard/dashboard.types";
import { useMeasure } from "./useMeasure";
import { Legend } from "./Legend";
import { fmtDayLong, fmtDayShort, nf, niceMax } from "./format";

type SeriesKey = "rj" | "igd" | "ri";
const SERIES: { key: SeriesKey; label: string; color: string }[] = [
  { key: "rj", label: "Rawat Jalan", color: "var(--chart-rj)" },
  { key: "igd", label: "IGD", color: "var(--chart-igd)" },
  { key: "ri", label: "Rawat Inap", color: "var(--chart-ri)" },
];

const H = 300;
const M = { top: 14, right: 14, bottom: 26, left: 40 };

/** Tren kunjungan harian — area bertumpuk RJ/IGD/RI + crosshair & tooltip. */
export function TrendAreaChart({ data }: { data: TrendPoint[] }) {
  const [ref, width] = useMeasure<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);

  const n = data.length;
  const innerW = Math.max(0, width - M.left - M.right);
  const innerH = H - M.top - M.bottom;
  const maxY = niceMax(Math.max(1, ...data.map((d) => d.total)));

  const x = (i: number) => (n <= 1 ? M.left + innerW / 2 : M.left + (i / (n - 1)) * innerW);
  const y = (v: number) => M.top + innerH - (v / maxY) * innerH;

  // area bertumpuk (bawah → atas): rj, igd, ri
  function band(pick: (d: TrendPoint) => [number, number]): string {
    const top = data.map((d, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(pick(d)[1]).toFixed(1)}`);
    const bot = data.map((d, i) => `L${x(n - 1 - i).toFixed(1)},${y(pick(data[n - 1 - i])[0]).toFixed(1)}`);
    return `${top.join(" ")} ${bot.join(" ")} Z`;
  }
  const bands = {
    rj: band((d) => [0, d.rj]),
    igd: band((d) => [d.rj, d.rj + d.igd]),
    ri: band((d) => [d.rj + d.igd, d.total]),
  };
  const topLine = data
    .map((d, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(d.total).toFixed(1)}`)
    .join(" ");

  const gridVals = [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(maxY * f));
  const xTickIdx = tickIndices(n, Math.min(7, n));

  const hd = hover != null ? data[hover] : null;
  const cx = hover != null ? x(hover) : 0;
  const tipLeft = width > 0 ? Math.min(Math.max(cx, 78), width - 78) : cx;

  return (
    <div>
      <Legend
        className="mb-3"
        items={SERIES.map((s) => ({ label: s.label, color: s.color }))}
      />
      <div ref={ref} className="relative" style={{ height: H }}>
        {width > 0 && n > 0 && (
          <svg width={width} height={H} role="img" aria-label="Tren kunjungan harian">
            {/* grid + y labels */}
            {gridVals.map((v, i) => {
              const gy = y(v);
              return (
                <g key={i}>
                  <line x1={M.left} y1={gy} x2={width - M.right} y2={gy} stroke="var(--chart-grid)" strokeWidth={1} />
                  <text x={M.left - 8} y={gy + 3} textAnchor="end" fontSize={10} fill="var(--chart-axis)">
                    {nf(v)}
                  </text>
                </g>
              );
            })}
            {/* x labels */}
            {xTickIdx.map((i) => (
              <text key={i} x={x(i)} y={H - 8} textAnchor="middle" fontSize={10} fill="var(--chart-axis)">
                {fmtDayShort(data[i].date)}
              </text>
            ))}
            {/* bands */}
            <path d={bands.rj} fill="var(--chart-rj)" fillOpacity={0.9} />
            <path d={bands.igd} fill="var(--chart-igd)" fillOpacity={0.9} />
            <path d={bands.ri} fill="var(--chart-ri)" fillOpacity={0.9} />
            {/* pemisah tipis warna surface + garis atas crisp */}
            <path d={topLine} fill="none" stroke="var(--surface)" strokeWidth={1.5} strokeOpacity={0.5} />
            {/* crosshair */}
            {hd && (
              <g pointerEvents="none">
                <line x1={cx} y1={M.top} x2={cx} y2={M.top + innerH} stroke="var(--border-strong)" strokeWidth={1} strokeDasharray="3 3" />
                <circle cx={cx} cy={y(hd.rj)} r={3.5} fill="var(--chart-rj)" stroke="var(--surface)" strokeWidth={1.5} />
                <circle cx={cx} cy={y(hd.rj + hd.igd)} r={3.5} fill="var(--chart-igd)" stroke="var(--surface)" strokeWidth={1.5} />
                <circle cx={cx} cy={y(hd.total)} r={3.5} fill="var(--chart-ri)" stroke="var(--surface)" strokeWidth={1.5} />
              </g>
            )}
            {/* capture area */}
            <rect
              x={M.left}
              y={M.top}
              width={innerW}
              height={innerH}
              fill="transparent"
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

        {hd && (
          <div
            className="pointer-events-none absolute z-10 w-[156px] -translate-x-1/2 rounded-[var(--radius-md)] border border-border bg-surface p-2.5 shadow-md"
            style={{ left: tipLeft, top: 4 }}
          >
            <p className="mb-1.5 text-[11px] font-semibold text-fg">{fmtDayLong(hd.date)}</p>
            <Row color="var(--chart-rj)" label="Rawat Jalan" value={hd.rj} />
            <Row color="var(--chart-igd)" label="IGD" value={hd.igd} />
            <Row color="var(--chart-ri)" label="Rawat Inap" value={hd.ri} />
            <div className="mt-1.5 flex items-center justify-between border-t border-border pt-1.5 text-[11px]">
              <span className="font-medium text-fg-muted">Total</span>
              <span className="tabular font-semibold text-fg">{nf(hd.total)}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Row({ color, label, value }: { color: string; label: string; value: number }) {
  return (
    <div className="flex items-center justify-between py-0.5 text-[11px]">
      <span className="flex items-center gap-1.5 text-fg-muted">
        <span className="size-2 rounded-[2px]" style={{ background: color }} />
        {label}
      </span>
      <span className="tabular font-medium text-fg">{nf(value)}</span>
    </div>
  );
}

/** Pilih ~count indeks merata dari 0..n-1 (selalu termasuk awal & akhir). */
function tickIndices(n: number, count: number): number[] {
  if (n <= 0) return [];
  if (n <= count) return Array.from({ length: n }, (_, i) => i);
  const out: number[] = [];
  for (let k = 0; k < count; k++) out.push(Math.round((k / (count - 1)) * (n - 1)));
  return [...new Set(out)];
}

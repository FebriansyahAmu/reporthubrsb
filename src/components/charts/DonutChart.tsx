"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";
import { nf } from "./format";

export type DonutSegment = { label: string; value: number; color: string };

const SIZE = 184;
const R = 82;
const RING = 26; // ketebalan
const GAP = 0.035; // celah antar-segmen (radian)

function polar(cx: number, cy: number, r: number, a: number) {
  return [cx + r * Math.cos(a), cy + r * Math.sin(a)] as const;
}
function ringSlice(cx: number, cy: number, rOuter: number, rInner: number, a0: number, a1: number) {
  const large = a1 - a0 > Math.PI ? 1 : 0;
  const [x0, y0] = polar(cx, cy, rOuter, a0);
  const [x1, y1] = polar(cx, cy, rOuter, a1);
  const [x2, y2] = polar(cx, cy, rInner, a1);
  const [x3, y3] = polar(cx, cy, rInner, a0);
  return `M${x0},${y0} A${rOuter},${rOuter} 0 ${large} 1 ${x1},${y1} L${x2},${y2} A${rInner},${rInner} 0 ${large} 0 ${x3},${y3} Z`;
}

/** Donut komposisi + legenda (nilai & %). Hover menyorot segmen & pusat. */
export function DonutChart({
  segments,
  centerLabel = "Total",
}: {
  segments: DonutSegment[];
  centerLabel?: string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const total = segments.reduce((a, s) => a + s.value, 0);
  const cx = SIZE / 2;
  const cy = SIZE / 2;

  const arcs: { color: string; i: number; a0: number; a1: number; frac: number }[] = [];
  let angle = -Math.PI / 2;
  for (let i = 0; i < segments.length; i++) {
    const frac = total > 0 ? segments[i].value / total : 0;
    const a0 = angle;
    const a1 = angle + frac * Math.PI * 2;
    angle = a1;
    const gap = frac > 0 && segments.length > 1 ? GAP / 2 : 0;
    arcs.push({ color: segments[i].color, i, a0: a0 + gap, a1: Math.max(a0 + gap, a1 - gap), frac });
  }

  const center =
    hover != null && segments[hover]
      ? { value: segments[hover].value, label: segments[hover].label, pct: arcs[hover].frac }
      : { value: total, label: centerLabel, pct: 1 };

  return (
    <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-center sm:gap-6">
      <div className="relative shrink-0" style={{ width: SIZE, height: SIZE }}>
        <svg width={SIZE} height={SIZE} role="img" aria-label={centerLabel}>
          {total === 0 && (
            <circle cx={cx} cy={cy} r={(R + (R - RING)) / 2} fill="none" stroke="var(--chart-track)" strokeWidth={RING} />
          )}
          {arcs.map((a) => {
            if (a.frac <= 0) return null;
            const opacity = hover == null || hover === a.i ? 1 : 0.32;
            // Satu segmen penuh (≈100%) tak bisa digambar sebagai busur (titik awal
            // = titik akhir) → pakai lingkaran penuh agar cincin tetap terlihat.
            if (a.frac >= 0.999) {
              return (
                <circle
                  key={a.i}
                  cx={cx}
                  cy={cy}
                  r={R - RING / 2}
                  fill="none"
                  stroke={a.color}
                  strokeWidth={RING}
                  strokeOpacity={opacity}
                  onMouseEnter={() => setHover(a.i)}
                  onMouseLeave={() => setHover(null)}
                  style={{ transition: "stroke-opacity 120ms" }}
                />
              );
            }
            return (
              <path
                key={a.i}
                d={ringSlice(cx, cy, R, R - RING, a.a0, a.a1)}
                fill={a.color}
                fillOpacity={opacity}
                onMouseEnter={() => setHover(a.i)}
                onMouseLeave={() => setHover(null)}
                style={{ transition: "fill-opacity 120ms" }}
              />
            );
          })}
        </svg>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="tabular text-2xl font-semibold text-fg">{nf(center.value)}</span>
          <span className="max-w-[7rem] truncate text-[11px] text-fg-muted">{center.label}</span>
          {hover != null && (
            <span className="tabular mt-0.5 text-[11px] font-medium text-fg-subtle">
              {(center.pct * 100).toFixed(1)}%
            </span>
          )}
        </div>
      </div>

      <ul className="w-full space-y-1.5">
        {segments.map((s, i) => {
          const pct = total > 0 ? (s.value / total) * 100 : 0;
          return (
            <li
              key={s.label}
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
              className={cn(
                "flex items-center gap-2 rounded-md px-2 py-1 transition-colors",
                hover === i ? "bg-surface-2" : "hover:bg-surface-2",
              )}
            >
              <span className="size-2.5 shrink-0 rounded-[3px]" style={{ background: s.color }} />
              <span className="min-w-0 flex-1 truncate text-xs font-medium text-fg">{s.label}</span>
              <span className="tabular text-xs font-semibold text-fg">{nf(s.value)}</span>
              <span className="tabular w-11 text-right text-[11px] text-fg-subtle">{pct.toFixed(1)}%</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

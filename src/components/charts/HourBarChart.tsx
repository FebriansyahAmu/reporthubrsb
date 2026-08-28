"use client";

import { cn } from "@/lib/cn";
import type { HourDatum } from "@/server/modules/dashboard/dashboard.types";
import { nf } from "./format";

/** Distribusi kunjungan per jam (0–23). Bar div responsif + tooltip hover. */
export function HourBarChart({ data }: { data: HourDatum[] }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  const peak = data.reduce((a, b) => (b.value > a.value ? b : a), data[0] ?? { hour: 0, value: 0 });

  return (
    <div>
      <div className="flex h-[150px] items-end gap-[3px]">
        {data.map((d) => {
          const pct = (d.value / max) * 100;
          const isPeak = d.value > 0 && d.hour === peak.hour;
          return (
            <div key={d.hour} className="group relative flex h-full flex-1 items-end">
              <div
                title={`${String(d.hour).padStart(2, "0")}:00 — ${nf(d.value)} kunjungan`}
                className={cn(
                  "w-full rounded-t-[3px] transition-[height,background] duration-300",
                  isPeak ? "bg-brand" : "bg-brand/45 group-hover:bg-brand/70",
                )}
                style={{ height: `${Math.max(pct, d.value > 0 ? 3 : 0)}%` }}
              />
              {/* tooltip */}
              <div className="pointer-events-none absolute -top-10 left-1/2 z-10 hidden -translate-x-1/2 whitespace-nowrap rounded-md border border-border bg-surface px-2 py-1 text-[11px] shadow-md group-hover:block">
                <span className="tabular font-semibold text-fg">{nf(d.value)}</span>
                <span className="text-fg-muted"> · {String(d.hour).padStart(2, "0")}:00</span>
              </div>
            </div>
          );
        })}
      </div>
      {/* label sejajar bar: 24 sel (flex-1) + gap sama seperti baris bar */}
      <div className="mt-1.5 flex gap-[3px] text-[10px] text-fg-subtle">
        {data.map((d) => (
          <span key={d.hour} className="tabular flex-1 text-center">
            {d.hour % 3 === 0 ? String(d.hour).padStart(2, "0") : ""}
          </span>
        ))}
      </div>
    </div>
  );
}

"use client";

import { nf } from "./format";

export type HBarItem = { label: string; value: number; color: string; sub?: string };

/** Daftar bar horizontal (mis. top ruangan). Nilai selalu berlabel langsung. */
export function HBarList({ items }: { items: HBarItem[] }) {
  const max = Math.max(1, ...items.map((i) => i.value));
  if (items.length === 0) {
    return <p className="py-8 text-center text-sm text-fg-muted">Tidak ada data.</p>;
  }
  return (
    <ul className="space-y-3">
      {items.map((it) => {
        const pct = (it.value / max) * 100;
        return (
          <li key={it.label}>
            <div className="mb-1 flex items-center justify-between gap-2 text-xs">
              <span className="flex min-w-0 items-center gap-1.5">
                <span className="size-2.5 shrink-0 rounded-[3px]" style={{ background: it.color }} />
                <span className="truncate font-medium text-fg">{it.label}</span>
                {it.sub && (
                  <span className="shrink-0 rounded bg-surface-2 px-1.5 py-0.5 text-[10px] font-medium text-fg-muted">
                    {it.sub}
                  </span>
                )}
              </span>
              <span className="tabular shrink-0 font-semibold text-fg">{nf(it.value)}</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full" style={{ background: "var(--chart-track)" }}>
              <div
                className="h-full rounded-full"
                style={{ width: `${pct}%`, background: it.color, transition: "width 400ms ease" }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

"use client";

import { cn } from "@/lib/cn";

export type LegendItem = { label: string; color: string; value?: string };

/** Legenda bersama — identitas seri tak pernah lewat warna saja (selalu berlabel). */
export function Legend({
  items,
  className,
}: {
  items: LegendItem[];
  className?: string;
}) {
  return (
    <ul className={cn("flex flex-wrap items-center gap-x-4 gap-y-1.5", className)}>
      {items.map((it) => (
        <li key={it.label} className="flex items-center gap-1.5 text-xs text-fg-muted">
          <span
            className="size-2.5 shrink-0 rounded-[3px]"
            style={{ background: it.color }}
            aria-hidden
          />
          <span className="font-medium text-fg">{it.label}</span>
          {it.value != null && <span className="tabular text-fg-subtle">{it.value}</span>}
        </li>
      ))}
    </ul>
  );
}

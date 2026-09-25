"use client";

import { CalendarClock, CalendarDays, CalendarRange } from "lucide-react";
import { cn } from "@/lib/cn";
import { FREKUENSI, FREKUENSI_LABEL, type Frekuensi } from "@/server/modules/inventaris/checklist.schema";

const FREK_ICON: Record<Frekuensi, typeof CalendarDays> = {
  HARIAN: CalendarDays,
  MINGGUAN: CalendarRange,
  BULANAN: CalendarClock,
};

/** Tab pemilih frekuensi (Harian / Mingguan / Bulanan). Stats opsional per tab. */
export function FrekuensiTabs({
  value,
  onChange,
  stats,
}: {
  value: Frekuensi;
  onChange: (f: Frekuensi) => void;
  stats?: Partial<Record<Frekuensi, { done: number; total: number }>>;
}) {
  return (
    <div className="grid grid-cols-3 gap-2 sm:gap-3">
      {FREKUENSI.map((f) => {
        const Icon = FREK_ICON[f];
        const active = value === f;
        const st = stats?.[f];
        const full = !!st && st.total > 0 && st.done === st.total;
        return (
          <button
            key={f}
            type="button"
            onClick={() => onChange(f)}
            aria-pressed={active}
            className={cn(
              "flex items-center gap-2.5 rounded-[var(--radius-lg)] border p-3 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring",
              active ? "border-brand bg-brand-soft/40 ring-1 ring-brand/30" : "border-border bg-surface hover:border-brand/40 hover:shadow-sm",
            )}
          >
            <span
              className={cn(
                "flex size-9 shrink-0 items-center justify-center rounded-[var(--radius-md)]",
                active ? "bg-brand text-white" : "bg-surface-2 text-fg-muted",
              )}
            >
              <Icon className="size-4.5" />
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-fg">{FREKUENSI_LABEL[f]}</p>
              {st ? (
                <p className="text-xs tabular-nums text-fg-muted">
                  {st.done}/{st.total}
                  {full && st.total > 0 ? " ✓" : ""}
                </p>
              ) : (
                <p className="truncate text-xs text-fg-muted">Periode {FREKUENSI_LABEL[f].toLowerCase()}</p>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
}

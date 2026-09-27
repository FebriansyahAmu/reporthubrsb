"use client";

import { useState } from "react";
import { LayoutGrid, LineChart, ListFilter } from "lucide-react";
import { cn } from "@/lib/cn";
import { AuditTimelineView } from "./AuditTimelineView";
import { AuditDashboardView } from "./AuditDashboardView";
import { PapanKunjunganView } from "./PapanKunjunganView";

type Tab = "papan" | "log" | "tren";

const TABS: { key: Tab; label: string; icon: typeof ListFilter }[] = [
  { key: "papan", label: "Papan Kunjungan", icon: LayoutGrid },
  { key: "log", label: "Log Aktivitas", icon: ListFilter },
  { key: "tren", label: "Tren Log", icon: LineChart },
];

export function AuditRmeView() {
  const [tab, setTab] = useState<Tab>("papan");

  return (
    <div className="space-y-4">
      <div role="tablist" aria-label="Tampilan Audit Trail RME" className="inline-flex max-w-full overflow-x-auto rounded-[var(--radius-md)] border border-border bg-surface-2 p-1">
        {TABS.map((it) => {
          const Icon = it.icon;
          const active = tab === it.key;
          return (
            <button
              key={it.key}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setTab(it.key)}
              className={cn(
                "inline-flex shrink-0 items-center gap-1.5 rounded-[var(--radius-sm)] px-3 py-1.5 text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring",
                active ? "bg-surface text-fg shadow-xs" : "text-fg-muted hover:text-fg",
              )}
            >
              <Icon className="size-4" />
              {it.label}
            </button>
          );
        })}
      </div>

      {tab === "papan" ? <PapanKunjunganView /> : tab === "log" ? <AuditTimelineView /> : <AuditDashboardView />}
    </div>
  );
}

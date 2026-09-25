"use client";

import { useState } from "react";
import { LineChart, ListFilter } from "lucide-react";
import { cn } from "@/lib/cn";
import { AuditTimelineView } from "./AuditTimelineView";
import { AuditDashboardView } from "./AuditDashboardView";

type Tab = "timeline" | "dashboard";

export function AuditRmeView() {
  const [tab, setTab] = useState<Tab>("timeline");
  const items: { key: Tab; label: string; icon: typeof ListFilter }[] = [
    { key: "timeline", label: "Timeline", icon: ListFilter },
    { key: "dashboard", label: "Tren & Kepatuhan", icon: LineChart },
  ];

  return (
    <div className="space-y-4">
      <div className="inline-flex rounded-[var(--radius-md)] border border-border bg-surface-2 p-1">
        {items.map((it) => {
          const Icon = it.icon;
          const active = tab === it.key;
          return (
            <button
              key={it.key}
              type="button"
              onClick={() => setTab(it.key)}
              aria-pressed={active}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-[var(--radius-sm)] px-3 py-1.5 text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring",
                active ? "bg-surface text-fg shadow-xs" : "text-fg-muted hover:text-fg",
              )}
            >
              <Icon className="size-4" />
              {it.label}
            </button>
          );
        })}
      </div>

      {tab === "timeline" ? <AuditTimelineView /> : <AuditDashboardView />}
    </div>
  );
}

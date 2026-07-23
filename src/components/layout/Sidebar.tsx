"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Activity, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { NAV } from "./nav";

export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <div className="flex h-full flex-col bg-surface">
      {/* Brand */}
      <div className="flex h-16 items-center gap-2.5 border-b border-border px-5">
        <div className="flex size-8 items-center justify-center rounded-[var(--radius-md)] bg-brand text-brand-fg">
          <Activity className="size-5" strokeWidth={2.4} />
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-fg">ReportHub</p>
          <p className="truncate text-[11px] text-fg-muted">RS Balikpapan</p>
        </div>
        {onNavigate && (
          <button
            onClick={onNavigate}
            className="ml-auto text-fg-subtle hover:text-fg lg:hidden"
            aria-label="Tutup menu"
          >
            <X className="size-5" />
          </button>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-5">
        {NAV.map((section) => (
          <div key={section.title}>
            <p className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-wider text-fg-subtle">
              {section.title}
            </p>
            <ul className="space-y-1">
              {section.items.map((item) => {
                const active = item.exact
                  ? pathname === item.href
                  : pathname === item.href || pathname.startsWith(item.href + "/");
                const Icon = item.icon;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={onNavigate}
                      className={cn(
                        "group flex items-center gap-3 rounded-[var(--radius-md)] px-3 py-2 text-sm font-medium transition-colors",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring",
                        active
                          ? "bg-brand-soft text-brand-soft-fg"
                          : "text-fg-muted hover:bg-surface-2 hover:text-fg",
                      )}
                    >
                      <Icon
                        className={cn(
                          "size-[18px] shrink-0",
                          active ? "text-brand" : "text-fg-subtle group-hover:text-fg-muted",
                        )}
                      />
                      <span className="truncate">{item.label}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* Footer note */}
      <div className="border-t border-border p-3">
        <div className="rounded-[var(--radius-md)] bg-surface-2 px-3 py-2.5">
          <p className="flex items-center gap-1.5 text-[11px] font-medium text-fg-muted">
            <span className="size-1.5 rounded-full bg-success" />
            Mode Read-Only SIMGOS
          </p>
          <p className="mt-0.5 text-[11px] leading-snug text-fg-subtle">
            Data hanya dibaca, tidak diubah.
          </p>
        </div>
      </div>
    </div>
  );
}

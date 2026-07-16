"use client";

import { Menu } from "lucide-react";
import { ThemeToggle } from "./ThemeToggle";

export function Topbar({ onMenu }: { onMenu: () => void }) {
  return (
    <header className="no-print sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-border bg-surface/80 px-4 backdrop-blur-md sm:px-6">
      <button
        onClick={onMenu}
        className="text-fg-muted hover:text-fg lg:hidden"
        aria-label="Buka menu"
      >
        <Menu className="size-5" />
      </button>

      <div className="ml-auto flex items-center gap-3">
        <ThemeToggle />
        <div className="hidden h-6 w-px bg-border sm:block" />
        <div className="flex items-center gap-2.5">
          <div className="hidden text-right sm:block">
            <p className="text-xs font-medium text-fg">Operator RS</p>
            <p className="text-[11px] text-fg-muted">operator@rsb.id</p>
          </div>
          <div className="flex size-9 items-center justify-center rounded-full bg-brand-soft text-sm font-semibold text-brand-soft-fg">
            OR
          </div>
        </div>
      </div>
    </header>
  );
}

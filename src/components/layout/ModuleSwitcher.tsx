"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, LayoutGrid } from "lucide-react";
import { cn } from "@/lib/cn";
import { visibleWorkspaces, workspaceKeyForPath } from "./workspaces";

/**
 * Switcher modul kerja (header). Menampilkan modul aktif; dropdown berisi semua
 * modul kerja yang boleh diakses. Modul admin (Master) TIDAK ditampilkan di sini
 * — lihat AdminMenu. Memilih modul = navigasi ke halaman pertama modul itu.
 */
export function ModuleSwitcher({ allowedModules }: { allowedModules: string[] }) {
  const pathname = usePathname();
  const ref = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);

  const allowed = useMemo(() => new Set(allowedModules), [allowedModules]);
  const modules = useMemo(
    () => visibleWorkspaces(allowed).filter((w) => !w.admin),
    [allowed],
  );

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (modules.length === 0) return null;

  const activeKey = workspaceKeyForPath(pathname);
  const active = modules.find((w) => w.key === activeKey) ?? null;
  const ActiveIcon = active?.icon ?? LayoutGrid;

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className={cn(
          "flex items-center gap-2 rounded-[var(--radius-md)] border border-border bg-surface px-2.5 py-1.5 text-sm font-medium text-fg transition-colors hover:bg-surface-2",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring",
        )}
      >
        <ActiveIcon className="size-4 text-brand" />
        <span className="max-w-[8rem] truncate sm:max-w-[11rem]">
          {active?.label ?? "Pilih Modul"}
        </span>
        <ChevronDown
          className={cn("size-4 text-fg-subtle transition-transform", open && "rotate-180")}
        />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            role="menu"
            initial={{ opacity: 0, scale: 0.97, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: -4 }}
            transition={{ duration: 0.14, ease: [0.16, 1, 0.3, 1] }}
            className="absolute left-0 top-[calc(100%+8px)] z-30 w-72 overflow-hidden rounded-[var(--radius-lg)] border border-border bg-surface shadow-md"
          >
            <p className="border-b border-border px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-fg-subtle">
              Pilih Modul
            </p>
            <div className="p-1.5">
              {modules.map((w) => {
                const Icon = w.icon;
                const isActive = w.key === activeKey;
                return (
                  <Link
                    key={w.key}
                    href={w.items[0].href}
                    role="menuitem"
                    onClick={() => setOpen(false)}
                    className={cn(
                      "flex items-start gap-3 rounded-md px-2.5 py-2 transition-colors",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring",
                      isActive ? "bg-brand-soft" : "hover:bg-surface-2",
                    )}
                  >
                    <span
                      className={cn(
                        "mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md",
                        isActive ? "bg-brand text-brand-fg" : "bg-surface-2 text-fg-muted",
                      )}
                    >
                      <Icon className="size-4" />
                    </span>
                    <span className="min-w-0">
                      <span
                        className={cn(
                          "block text-sm font-medium",
                          isActive ? "text-brand-soft-fg" : "text-fg",
                        )}
                      >
                        {w.label}
                      </span>
                      {w.description && (
                        <span className="block truncate text-xs text-fg-muted">
                          {w.description}
                        </span>
                      )}
                    </span>
                  </Link>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

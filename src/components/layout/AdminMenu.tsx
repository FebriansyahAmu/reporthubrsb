"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Settings } from "lucide-react";
import { cn } from "@/lib/cn";
import { WORKSPACES, allowedItems } from "./workspaces";

/**
 * Menu admin (ikon gerigi) — area Master yang dipisah dari dropdown modul kerja.
 * Hanya tampil bila pengguna punya izin ke salah satu item admin.
 */
export function AdminMenu({ allowedModules }: { allowedModules: string[] }) {
  const pathname = usePathname();
  const ref = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);

  const items = useMemo(() => {
    const allowed = new Set(allowedModules);
    const admin = WORKSPACES.find((w) => w.admin);
    return admin ? allowedItems(admin, allowed) : [];
  }, [allowedModules]);

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

  if (items.length === 0) return null;

  const inAdmin = pathname.startsWith("/master");

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Pengaturan"
        title="Pengaturan"
        className={cn(
          "flex size-9 items-center justify-center rounded-full transition-colors",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring",
          inAdmin ? "bg-brand-soft text-brand-soft-fg" : "text-fg-muted hover:bg-surface-2 hover:text-fg",
        )}
      >
        <Settings className={cn("size-5 transition-transform", open && "rotate-45")} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            role="menu"
            initial={{ opacity: 0, scale: 0.97, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: -4 }}
            transition={{ duration: 0.14, ease: [0.16, 1, 0.3, 1] }}
            className="absolute right-0 top-[calc(100%+8px)] z-30 w-60 overflow-hidden rounded-[var(--radius-lg)] border border-border bg-surface shadow-md"
          >
            <p className="border-b border-border px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-fg-subtle">
              Pengaturan
            </p>
            <div className="p-1.5">
              {items.map((item) => {
                const Icon = item.icon;
                const isActive =
                  pathname === item.href || pathname.startsWith(item.href + "/");
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    role="menuitem"
                    onClick={() => setOpen(false)}
                    className={cn(
                      "flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm transition-colors",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring",
                      isActive
                        ? "bg-brand-soft font-medium text-brand-soft-fg"
                        : "text-fg hover:bg-surface-2",
                    )}
                  >
                    <Icon
                      className={cn("size-4", isActive ? "text-brand" : "text-fg-muted")}
                    />
                    {item.label}
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

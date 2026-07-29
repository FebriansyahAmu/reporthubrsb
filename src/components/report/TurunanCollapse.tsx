"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, ChevronDown, Clock, Layers } from "lucide-react";
import { cn } from "@/lib/cn";
import { formatDateTime } from "@/lib/format";
import type { TurunanLayananItem } from "@/server/modules/pelayanan/pelayanan.types";

/**
 * Rincian turunan layanan (leg lain di NOPEN yang sama) dalam collapse.
 * Header HIJAU bila semua leg sudah final, KUNING bila ada yang belum final.
 */
export function TurunanCollapse({ turunan }: { turunan: TurunanLayananItem[] }) {
  const [open, setOpen] = useState(false);
  const belum = turunan.filter((t) => !t.final).length;
  const allFinal = belum === 0;

  return (
    <div
      className={cn(
        "overflow-hidden rounded-[var(--radius-md)] border",
        allFinal ? "border-success/40 bg-success-soft" : "border-warning/50 bg-warning-soft",
      )}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left"
      >
        <span className="flex min-w-0 items-center gap-1.5 text-[13px] font-medium text-fg">
          <Layers className="size-3.5 shrink-0 text-fg-subtle" />
          {turunan.length} layanan turunan
          <span className={cn("truncate text-xs font-normal", allFinal ? "text-success" : "text-warning")}>
            · {allFinal ? "semua final" : `${belum} belum final`}
          </span>
        </span>
        <ChevronDown
          className={cn("size-4 shrink-0 text-fg-subtle transition-transform", open && "rotate-180")}
        />
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden"
          >
            <ul className="space-y-1.5 border-t border-border/50 px-3 py-2">
              {turunan.map((t) => (
                <li key={t.nomor} className="flex items-center justify-between gap-2 text-xs">
                  <span className="flex min-w-0 items-center gap-1.5">
                    {t.final ? (
                      <CheckCircle2 className="size-3.5 shrink-0 text-success" />
                    ) : (
                      <Clock className="size-3.5 shrink-0 text-warning" />
                    )}
                    <span className="truncate text-fg">{t.ruang}</span>
                    <span className="shrink-0 rounded bg-surface-2 px-1.5 py-0.5 text-[10px] font-medium text-fg-muted">
                      {t.jenisLabel}
                    </span>
                  </span>
                  <span className="shrink-0 tabular text-fg-muted">
                    {t.final ? formatDateTime(t.keluar as string) : "belum"}
                  </span>
                </li>
              ))}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

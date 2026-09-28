"use client";

import { useEffect, useId, useRef, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { cn } from "@/lib/cn";

/** True hanya di client (tanpa setState-in-effect) — untuk aman createPortal. */
function useIsClient() {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
}

const SIZE: Record<"md" | "lg" | "xl", string> = {
  md: "sm:max-w-lg",
  lg: "sm:max-w-3xl",
  xl: "sm:max-w-5xl",
};

/**
 * Panel samping (slide dari kanan) untuk drill-down tanpa meninggalkan halaman.
 * Portal ke <body>; Escape/backdrop menutup bila `dismissible`; scroll body
 * dikunci; fokus dikembalikan ke elemen pemicu saat ditutup.
 */
export function Drawer({
  open,
  onClose,
  title,
  header,
  children,
  size = "lg",
  dismissible = true,
}: {
  open: boolean;
  onClose: () => void;
  /** Judul aksesibel (dibacakan pembaca layar). */
  title: string;
  /** Isi header kustom (menggantikan judul teks bila ada). */
  header?: React.ReactNode;
  children?: React.ReactNode;
  size?: "md" | "lg" | "xl";
  /** False saat dialog lain di atasnya terbuka — Escape tak menutup drawer. */
  dismissible?: boolean;
}) {
  const isClient = useIsClient();
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open || !dismissible) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose, dismissible]);

  useEffect(() => {
    if (!open) return;
    const prevFocus = document.activeElement as HTMLElement | null;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    return () => {
      document.body.style.overflow = prevOverflow;
      prevFocus?.focus?.();
    };
  }, [open]);

  if (!isClient) return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          key="drawer"
          className="fixed inset-0 z-50 flex justify-end"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
        >
          <div className="absolute inset-0 bg-[#111111]/50 backdrop-blur-[2px]" onClick={dismissible ? onClose : undefined} aria-hidden />
          <motion.aside
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className={cn("relative flex h-dvh w-full flex-col border-l border-border bg-bg shadow-xl", SIZE[size])}
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="flex items-start gap-3 border-b border-border bg-surface px-5 py-4">
              <div className="min-w-0 flex-1">
                <h2 id={titleId} className={header ? "sr-only" : "text-sm font-semibold text-fg"}>
                  {title}
                </h2>
                {header}
              </div>
              <button
                ref={closeRef}
                type="button"
                onClick={onClose}
                aria-label="Tutup panel"
                className="rounded-md p-1.5 text-fg-subtle transition-colors hover:bg-surface-2 hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring"
              >
                <X className="size-4" />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
          </motion.aside>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

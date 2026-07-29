"use client";

import { useEffect, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";

/** True hanya di client (tanpa setState-in-effect) — untuk aman createPortal. */
function useIsClient() {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
}

const SIZE: Record<"sm" | "md" | "lg" | "xl", string> = {
  sm: "max-w-md",
  md: "max-w-lg",
  lg: "max-w-3xl",
  xl: "max-w-5xl",
};

export function Modal({
  open,
  onClose,
  title,
  description,
  icon,
  children,
  footer,
  dismissible = true,
  size = "sm",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  icon?: React.ReactNode;
  children?: React.ReactNode;
  footer?: React.ReactNode;
  /** Bila false: TIDAK bisa ditutup via Escape / klik backdrop / tombol X. */
  dismissible?: boolean;
  size?: "sm" | "md" | "lg" | "xl";
}) {
  const isClient = useIsClient();

  // Tutup dengan Escape (hanya bila dismissible).
  useEffect(() => {
    if (!open || !dismissible) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose, dismissible]);

  // Kunci scroll body saat modal terbuka.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!isClient) return null;

  // Portal ke <body> agar `fixed` relatif ke viewport (lepas dari ancestor
  // ber-transform / backdrop-filter seperti Topbar) → benar-benar center.
  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          key="modal-overlay"
          className="fixed inset-0 z-50 flex min-h-dvh items-center justify-center overflow-y-auto p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
        >
          <div
            className="fixed inset-0 bg-[#111111]/60 backdrop-blur-sm"
            onClick={dismissible ? onClose : undefined}
            aria-hidden
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={title}
            className={`relative z-10 my-auto w-full ${SIZE[size]} overflow-hidden rounded-[var(--radius-lg)] border border-border bg-surface shadow-lg`}
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="flex items-start gap-3 border-b border-border px-5 py-4">
              {icon}
              <div className="min-w-0 flex-1">
                <h2 className="text-sm font-semibold text-fg">{title}</h2>
                {description && <p className="mt-0.5 text-xs text-fg-muted">{description}</p>}
              </div>
              {dismissible && (
                <button
                  onClick={onClose}
                  aria-label="Tutup"
                  className="rounded-md p-1 text-fg-subtle transition-colors hover:bg-surface-2 hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring"
                >
                  <X className="size-4" />
                </button>
              )}
            </div>

            {children && <div className="px-5 py-4">{children}</div>}

            {footer && (
              <div className="flex items-center justify-end gap-2 border-t border-border bg-surface-2/40 px-5 py-3">
                {footer}
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

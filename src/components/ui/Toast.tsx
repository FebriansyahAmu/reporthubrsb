"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AlertCircle, AlertTriangle, CheckCircle2, Info, X } from "lucide-react";
import { cn } from "@/lib/cn";

/**
 * Sistem notifikasi (toast) global — bahasa desain "Cord". Dipasang sekali di
 * root layout (`<ToastProvider>`), dipakai di mana saja via `useToast()`:
 *
 *   const toast = useToast();
 *   toast.success("Tersimpan", "Data satuan berhasil disimpan.");
 *   toast.error("Gagal", e.message);
 *
 * Toast menumpuk di kanan-atas, auto-hilang, bisa ditutup manual, animasi halus,
 * dan aman-CVD (warna + ikon + teks).
 */

type Tone = "success" | "danger" | "warning" | "brand";

type ToastItem = {
  id: string;
  tone: Tone;
  title: string;
  description?: string;
};

type ToastInput = { title: string; description?: string; duration?: number };

type ToastApi = {
  show: (tone: Tone, input: ToastInput) => string;
  success: (title: string, description?: string) => string;
  error: (title: string, description?: string) => string;
  warning: (title: string, description?: string) => string;
  info: (title: string, description?: string) => string;
  dismiss: (id: string) => void;
};

const ToastContext = createContext<ToastApi | null>(null);

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast harus dipakai di dalam <ToastProvider>");
  return ctx;
}

const TONE_META: Record<
  Tone,
  { icon: typeof CheckCircle2; accent: string; iconColor: string }
> = {
  success: { icon: CheckCircle2, accent: "border-l-success", iconColor: "text-success" },
  danger: { icon: AlertCircle, accent: "border-l-danger", iconColor: "text-danger" },
  warning: { icon: AlertTriangle, accent: "border-l-warning", iconColor: "text-warning" },
  brand: { icon: Info, accent: "border-l-brand", iconColor: "text-brand" },
};

const DEFAULT_DURATION = 4200;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const dismiss = useCallback((id: string) => {
    setItems((prev) => prev.filter((t) => t.id !== id));
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
  }, []);

  const show = useCallback(
    (tone: Tone, input: ToastInput) => {
      const id = `t_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      setItems((prev) => [...prev.slice(-4), { id, tone, title: input.title, description: input.description }]);
      const duration = input.duration ?? (tone === "danger" ? 6000 : DEFAULT_DURATION);
      timers.current.set(
        id,
        setTimeout(() => dismiss(id), duration),
      );
      return id;
    },
    [dismiss],
  );

  const api = useMemo<ToastApi>(
    () => ({
      show,
      success: (title, description) => show("success", { title, description }),
      error: (title, description) => show("danger", { title, description }),
      warning: (title, description) => show("warning", { title, description }),
      info: (title, description) => show("brand", { title, description }),
      dismiss,
    }),
    [show, dismiss],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        className="pointer-events-none fixed inset-x-4 top-4 z-[100] flex flex-col items-end gap-2 sm:inset-x-auto sm:right-4"
        role="region"
        aria-label="Notifikasi"
      >
        <AnimatePresence initial={false}>
          {items.map((t) => {
            const meta = TONE_META[t.tone];
            const Icon = meta.icon;
            return (
              <motion.div
                key={t.id}
                layout
                initial={{ opacity: 0, x: 24, scale: 0.96 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, x: 24, scale: 0.96 }}
                transition={{ type: "spring", stiffness: 380, damping: 30 }}
                className={cn(
                  "pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-[var(--radius-lg)] border border-l-4 border-border bg-surface px-4 py-3 shadow-lg",
                  meta.accent,
                )}
                role="alert"
              >
                <Icon className={cn("mt-0.5 size-5 shrink-0", meta.iconColor)} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-fg">{t.title}</p>
                  {t.description && (
                    <p className="mt-0.5 text-xs leading-relaxed text-fg-muted">{t.description}</p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => dismiss(t.id)}
                  className="-mr-1 -mt-0.5 shrink-0 rounded-md p-1 text-fg-subtle transition-colors hover:bg-surface-2 hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring"
                  aria-label="Tutup notifikasi"
                >
                  <X className="size-4" />
                </button>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

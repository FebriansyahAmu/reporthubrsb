"use client";

import {
  createContext,
  useCallback,
  useContext,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AlertCircle, AlertTriangle, CheckCircle2, Info, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { useMediaQuery } from "@/lib/useMediaQuery";

/**
 * Sistem notifikasi (toast) global — bahasa desain "Cord". Dipasang sekali di
 * root layout (`<ToastProvider>`), dipakai di mana saja via `useToast()`:
 *
 *   const toast = useToast();
 *   toast.success("Tersimpan", "Data satuan berhasil disimpan.");
 *   toast.error("Gagal", e.message);
 *
 * Toast menumpuk di kanan-atas (ponsel: atas, selebar layar), auto-hilang
 * (jeda selama kursor/fokus di atasnya), bisa ditutup manual, dan aman-CVD
 * (warna + ikon + teks). Wadah = `popover="manual"` (lapisan teratas, tanpa
 * light-dismiss); peramban tanpa Popover API tetap memakai posisi fixed biasa.
 * Pengumuman pembaca layar lewat `ariaNotify()` bila ada, selain itu live
 * region yang sudah ada sejak halaman dimuat — tanpa `role="alert"` ganda.
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
/** Sisa waktu setelah kursor/fokus meninggalkan toast. */
const DURATION_LANJUT = 2500;

type DokumenAria = Document & {
  ariaNotify?: (pesan: string, opsi?: { priority?: "normal" | "high" }) => void;
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const wadah = useRef<HTMLDivElement>(null);
  const liveSopan = useRef<HTMLDivElement>(null);
  const liveTegas = useRef<HTMLDivElement>(null);
  /** Fokus sebelum masuk ke wadah toast — dikembalikan saat toast terakhir ditutup dengan keyboard. */
  const asalFokus = useRef<HTMLElement | null>(null);
  // Reaktif terhadap perubahan preferensi selama halaman terbuka (useReducedMotion framer-motion hanya membaca sekali saat mount).
  const kurangiGerak = useMediaQuery("(prefers-reduced-motion: reduce)");

  const hentikanTimer = useCallback((id: string) => {
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
  }, []);

  const dismiss = useCallback(
    (id: string) => {
      setItems((prev) => prev.filter((t) => t.id !== id));
      hentikanTimer(id);
    },
    [hentikanTimer],
  );

  const pasangTimer = useCallback(
    (id: string, ms: number) => {
      hentikanTimer(id);
      timers.current.set(
        id,
        setTimeout(() => dismiss(id), ms),
      );
    },
    [dismiss, hentikanTimer],
  );

  /** Umumkan teks toast ke pembaca layar (hanya teks tampak, tanpa nama tombol). */
  const umumkan = useCallback((tone: Tone, teks: string) => {
    const doc = document as DokumenAria;
    if (typeof doc.ariaNotify === "function") {
      doc.ariaNotify(teks, { priority: tone === "danger" ? "high" : "normal" });
      return;
    }
    const el = (tone === "danger" ? liveTegas : liveSopan).current;
    if (!el) return;
    // Kosongkan dulu agar pesan yang sama berturut-turut tetap diumumkan.
    el.textContent = "";
    window.setTimeout(() => {
      el.textContent = teks;
    }, 60);
  }, []);

  const show = useCallback(
    (tone: Tone, input: ToastInput) => {
      const id = `t_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      setItems((prev) => [...prev.slice(-4), { id, tone, title: input.title, description: input.description }]);
      pasangTimer(id, input.duration ?? (tone === "danger" ? 6000 : DEFAULT_DURATION));
      umumkan(tone, [input.title, input.description].filter(Boolean).join(". "));
      return id;
    },
    [pasangTimer, umumkan],
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

  // Tampilkan wadah di lapisan teratas selama ada toast (Popover API); disembunyikan setelah animasi keluar selesai.
  // `daftar` = toast yang masih aktif. Saat `onExitComplete` berjalan, elemen yang keluar belum tentu sudah lepas
  // dari DOM, jadi jangan menghitung anak elemen wadah.
  const daftar = useRef<ToastItem[]>([]);
  useLayoutEffect(() => {
    daftar.current = items;
    const el = wadah.current;
    if (!el || typeof el.showPopover !== "function") return;
    if (items.length > 0 && !el.matches(":popover-open")) el.showPopover();
  }, [items]);
  const sembunyikanBilaKosong = () => {
    const el = wadah.current;
    if (el && typeof el.hidePopover === "function" && daftar.current.length === 0 && el.matches(":popover-open")) el.hidePopover();
  };
  /** Toast yang sedang beranimasi keluar tak boleh memasang timer lagi (mis. blur saat fokus dikembalikan). */
  const masihAda = (id: string) => daftar.current.some((t) => t.id === id);

  /** Tutup lewat tombol: fokus pindah ke toast berikutnya, atau kembali ke asal bila tak ada lagi. */
  function tutupManual(id: string) {
    const dariFokus = !!wadah.current?.contains(document.activeElement);
    dismiss(id);
    if (!dariFokus) return;
    requestAnimationFrame(() => {
      const berikut = wadah.current?.querySelector<HTMLButtonElement>(`[data-toast]:not([data-toast="${id}"]) button[data-tutup]`);
      if (berikut) berikut.focus();
      else {
        asalFokus.current?.focus?.();
        asalFokus.current = null;
      }
    });
  }

  const gerak = kurangiGerak
    ? { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 }, transition: { duration: 0.12 } }
    : {
        initial: { opacity: 0, x: 24, scale: 0.96 },
        animate: { opacity: 1, x: 0, scale: 1 },
        exit: { opacity: 0, x: 24, scale: 0.96 },
        transition: { type: "spring" as const, stiffness: 380, damping: 30 },
      };

  return (
    <ToastContext.Provider value={api}>
      {children}
      {/* Live region cadangan (tanpa ariaNotify) — ada sejak halaman dimuat, diberi konteks. */}
      <div className="sr-only">
        <p>Pengumuman notifikasi</p>
        <div ref={liveSopan} aria-live="polite" />
        <div ref={liveTegas} aria-live="assertive" />
      </div>
      <div
        ref={wadah}
        popover="manual"
        role="region"
        aria-label="Notifikasi"
        onFocus={(e) => {
          const dari = e.relatedTarget as HTMLElement | null;
          if (dari && !e.currentTarget.contains(dari)) asalFokus.current = dari;
        }}
        // Lapisan atas: timpa gaya bawaan [popover] (inset/margin/border/latar/overflow).
        className="pointer-events-none fixed inset-x-4 top-4 bottom-auto z-[100] m-0 flex h-auto w-auto flex-col items-end gap-2 overflow-visible border-0 bg-transparent p-0 text-fg sm:inset-x-auto sm:right-4"
      >
        <AnimatePresence initial={false} onExitComplete={sembunyikanBilaKosong}>
          {items.map((t) => {
            const meta = TONE_META[t.tone];
            const Icon = meta.icon;
            return (
              <motion.div
                key={t.id}
                data-toast={t.id}
                layout={!kurangiGerak}
                {...gerak}
                // Jeda auto-hilang selama kursor atau fokus berada di toast.
                onMouseEnter={() => hentikanTimer(t.id)}
                onMouseLeave={(e) => {
                  if (masihAda(t.id) && !e.currentTarget.contains(document.activeElement)) pasangTimer(t.id, DURATION_LANJUT);
                }}
                onFocus={() => hentikanTimer(t.id)}
                onBlur={(e) => {
                  if (masihAda(t.id) && !e.currentTarget.contains(e.relatedTarget as Node | null)) pasangTimer(t.id, DURATION_LANJUT);
                }}
                className={cn(
                  "pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-[var(--radius-lg)] border border-l-4 border-border bg-surface px-4 py-3 shadow-lg",
                  meta.accent,
                )}
              >
                <Icon className={cn("mt-0.5 size-5 shrink-0", meta.iconColor)} aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-fg">{t.title}</p>
                  {t.description && (
                    <p className="mt-0.5 text-xs leading-relaxed text-fg-muted">{t.description}</p>
                  )}
                </div>
                <button
                  type="button"
                  data-tutup
                  onClick={() => tutupManual(t.id)}
                  className="-mr-1 -mt-0.5 shrink-0 rounded-md p-1 text-fg-subtle transition-colors hover:bg-surface-2 hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring pointer-coarse:p-2.5"
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

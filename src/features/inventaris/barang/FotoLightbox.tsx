"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Download, Loader2, X, ZoomIn, ZoomOut } from "lucide-react";
import { cn } from "@/lib/cn";

const useIsClient = () =>
  useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

const ZOOM = 2.25;

/**
 * Penampil foto layar penuh: klik foto untuk memperbesar (titik perbesaran
 * mengikuti kursor), Esc / klik latar untuk menutup. Esc ditangkap di fase
 * capture agar Modal di bawahnya tidak ikut tertutup. Lapisan di atas toast
 * (z-100) supaya tombol Tutup/Unduh tak tertutup notifikasi.
 */
export function FotoLightbox({
  open,
  src,
  judul,
  subjudul,
  unduhUrl,
  onClose,
}: {
  open: boolean;
  src: string;
  judul: string;
  subjudul?: string;
  unduhUrl?: string;
  onClose: () => void;
}) {
  const isClient = useIsClient();
  const [zoom, setZoom] = useState(false);
  const [asal, setAsal] = useState({ x: 50, y: 50 });
  const [muat, setMuat] = useState(true);

  // Reset saat ditutup / sumber berganti (fase render, bukan effect).
  const [kunci, setKunci] = useState(`${open}|${src}`);
  if (kunci !== `${open}|${src}`) {
    setKunci(`${open}|${src}`);
    setZoom(false);
    setMuat(true);
  }

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      onClose();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [open, onClose]);

  if (!isClient) return null;

  function geser(e: React.PointerEvent<HTMLImageElement>) {
    const r = e.currentTarget.getBoundingClientRect();
    setAsal({
      x: Math.min(100, Math.max(0, ((e.clientX - r.left) / r.width) * 100)),
      y: Math.min(100, Math.max(0, ((e.clientY - r.top) / r.height) * 100)),
    });
  }

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          key="foto-lightbox"
          role="dialog"
          aria-modal="true"
          aria-label={`Foto ${judul}`}
          className="fixed inset-0 z-[110] flex flex-col bg-[#0b1624]/92 backdrop-blur-md"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.16 }}
        >
          <div className="flex items-center gap-3 px-4 py-3 text-white sm:px-6">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{judul}</p>
              {subjudul && <p className="truncate text-xs text-white/65">{subjudul}</p>}
            </div>
            <AksiGelap label={zoom ? "Perkecil" : "Perbesar"} onClick={() => setZoom((z) => !z)}>
              {zoom ? <ZoomOut className="size-4.5" /> : <ZoomIn className="size-4.5" />}
            </AksiGelap>
            {unduhUrl && (
              <a
                href={unduhUrl}
                download
                aria-label="Unduh foto asli"
                title="Unduh foto"
                className="inline-flex size-9 items-center justify-center rounded-full text-white/85 transition-colors hover:bg-white/12 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
              >
                <Download className="size-4.5" />
              </a>
            )}
            <AksiGelap label="Tutup" onClick={onClose} autoFocus>
              <X className="size-5" />
            </AksiGelap>
          </div>

          <div
            className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden px-4 pb-4 sm:px-8 sm:pb-8"
            onClick={(e) => e.target === e.currentTarget && onClose()}
          >
            {muat && <Loader2 className="absolute size-7 animate-spin text-white/70" aria-hidden />}
            {/* eslint-disable-next-line @next/next/no-img-element -- foto dari route berizin, bukan aset statis */}
            <img
              src={src}
              alt={`Foto ${judul}`}
              draggable={false}
              onLoad={() => setMuat(false)}
              onError={() => setMuat(false)}
              onClick={() => setZoom((z) => !z)}
              onPointerMove={zoom ? geser : undefined}
              style={{ transform: zoom ? `scale(${ZOOM})` : undefined, transformOrigin: `${asal.x}% ${asal.y}%` }}
              className={cn(
                "max-h-full max-w-full select-none rounded-[var(--radius-md)] object-contain shadow-2xl transition-opacity duration-200 motion-safe:transition-[opacity,transform]",
                muat ? "opacity-0" : "opacity-100",
                zoom ? "cursor-zoom-out" : "cursor-zoom-in",
              )}
            />
          </div>
          <p className="pb-3 text-center text-[11px] text-white/50">
            Klik foto untuk {zoom ? "memperkecil" : "memperbesar"} · Esc untuk menutup
          </p>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

function AksiGelap({
  label,
  onClick,
  children,
  autoFocus,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
  autoFocus?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      autoFocus={autoFocus}
      className="inline-flex size-9 items-center justify-center rounded-full text-white/85 transition-colors hover:bg-white/12 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
    >
      {children}
    </button>
  );
}

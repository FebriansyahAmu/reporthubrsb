"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { motion } from "framer-motion";
import { cn } from "@/lib/cn";

const useIsoLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

/**
 * Panel popover ter-anchor yang dirender lewat **portal** ke <body> (fixed) —
 * aman dari `overflow-hidden` induk. Otomatis membalik ke atas bila ruang bawah
 * sempit, menutup saat klik di luar / Escape, dan mengikuti scroll/resize.
 */
export function PopoverPanel({
  anchor,
  open,
  onClose,
  align = "start",
  matchWidth = true,
  className,
  children,
}: {
  anchor: HTMLElement | null;
  open: boolean;
  onClose: () => void;
  align?: "start" | "end";
  matchWidth?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const [style, setStyle] = useState<React.CSSProperties>({ visibility: "hidden" });

  useIsoLayoutEffect(() => {
    if (!open || !anchor) return;
    const place = () => {
      const r = anchor.getBoundingClientRect();
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const gap = 6;
      const panelH = panelRef.current?.offsetHeight ?? 0;
      const spaceBelow = vh - r.bottom;
      const openUp = spaceBelow < Math.min(panelH || 280, 300) && r.top > spaceBelow;
      setStyle({
        position: "fixed",
        top: openUp ? undefined : r.bottom + gap,
        bottom: openUp ? vh - r.top + gap : undefined,
        left: align === "start" ? Math.max(8, Math.min(r.left, vw - 8)) : undefined,
        right: align === "end" ? Math.max(8, vw - r.right) : undefined,
        minWidth: matchWidth ? r.width : undefined,
        maxHeight: (openUp ? r.top : spaceBelow) - gap - 8,
        visibility: "visible",
      });
    };
    place();
    // Dua kali: setelah panel terukur tingginya (untuk keputusan flip yang akurat).
    const raf = requestAnimationFrame(place);
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("resize", place);
    };
  }, [open, anchor, align, matchWidth]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (panelRef.current?.contains(t) || anchor?.contains(t)) return;
      onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    document.addEventListener("pointerdown", onDown, true);
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("pointerdown", onDown, true);
      document.removeEventListener("keydown", onKey, true);
    };
  }, [open, anchor, onClose]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <motion.div
      ref={panelRef}
      style={style}
      initial={{ opacity: 0, scale: 0.97, y: -3 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ duration: 0.12, ease: [0.16, 1, 0.3, 1] }}
      className={cn(
        "z-50 overflow-auto rounded-[var(--radius-md)] border border-border bg-surface p-1 shadow-[var(--shadow-md)]",
        className,
      )}
    >
      {children}
    </motion.div>,
    document.body,
  );
}

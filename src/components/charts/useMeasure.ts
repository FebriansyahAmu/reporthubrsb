"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Ukur lebar elemen container (px) via ResizeObserver. Chart dirender pada lebar
 * px terukur (tinggi tetap) supaya matematika hover akurat & responsif. Sebelum
 * terukur, lebar = 0 → pemanggil menampilkan placeholder.
 */
export function useMeasure<T extends HTMLElement = HTMLDivElement>() {
  const ref = useRef<T | null>(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width ?? 0;
      setWidth(Math.round(w));
    });
    ro.observe(el);
    setWidth(Math.round(el.getBoundingClientRect().width));
    return () => ro.disconnect();
  }, []);

  return [ref, width] as const;
}

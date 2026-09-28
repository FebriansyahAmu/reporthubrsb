"use client";

import { useSyncExternalStore } from "react";

/**
 * True bila media query cocok. Aman SSR (server = `false`) & tanpa
 * setState-in-effect (berlangganan lewat `useSyncExternalStore`).
 */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const mql = window.matchMedia(query);
      mql.addEventListener("change", onChange);
      return () => mql.removeEventListener("change", onChange);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}

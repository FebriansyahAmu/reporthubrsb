"use client";

import { createContext, useContext } from "react";
import { cn } from "@/lib/cn";

/**
 * Kunci isian: saat isian FINAL/BATAL (atau pengguna tak berizin ubah) semua
 * kolom di dalam <BidangIsian> dinonaktifkan sekaligus lewat `<fieldset disabled>`
 * bawaan HTML — tak perlu meneruskan `disabled` ke setiap kontrol.
 */
const KunciContext = createContext(false);

export const useTerkunci = () => useContext(KunciContext);

export function KunciIsian({ terkunci, children }: { terkunci: boolean; children: React.ReactNode }) {
  return <KunciContext value={terkunci}>{children}</KunciContext>;
}

/** Wilayah kolom isian (blok polos tanpa bingkai fieldset bawaan). */
export function BidangIsian({ children, className }: { children: React.ReactNode; className?: string }) {
  const terkunci = useTerkunci();
  return (
    <fieldset disabled={terkunci} className={cn("m-0 min-w-0 border-0 p-0", terkunci && "isian-terkunci", className)}>
      {children}
    </fieldset>
  );
}

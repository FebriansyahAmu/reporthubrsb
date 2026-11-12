"use client";

import { createContext, useContext } from "react";

/**
 * Konteks pembukaan isian form berlanjut IGD → RI (PRD §3): NOPEN episode
 * anggota rantai tempat petugas membuka isian — sudah divalidasi server di
 * halaman isian. Dikirim bersama simpan/aksi untuk label unit & ruang di log
 * (server memvalidasinya lagi). Tanpa provider → episode isian sendiri.
 */
const Konteks = createContext<string | null>(null);

export function KonteksIsianProvider({ konteks, children }: { konteks: string; children: React.ReactNode }) {
  return <Konteks.Provider value={konteks}>{children}</Konteks.Provider>;
}

export const useKonteksIsian = (): string | null => useContext(Konteks);

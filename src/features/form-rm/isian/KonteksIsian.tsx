"use client";

import { createContext, useContext } from "react";

/**
 * Konteks pembukaan isian form berlanjut IGD → RI (PRD §3): NOPEN episode
 * anggota rantai tempat petugas membuka isian — sudah divalidasi server di
 * halaman isian. Dikirim bersama simpan/aksi/aliran untuk label unit & ruang
 * (server memvalidasinya lagi). Tanpa provider → episode isian sendiri.
 *
 * `dirawatDi` = ruang rawat inap bila pasien MASIH dirawat dan form ini
 * biasanya difinalkan saat pulang (K6) — hanya untuk peringatan FINALKAN.
 */
type NilaiKonteks = { konteks: string; dirawatDi: string | null };

const Konteks = createContext<NilaiKonteks | null>(null);

export function KonteksIsianProvider({
  konteks,
  dirawatDi = null,
  children,
}: {
  konteks: string;
  dirawatDi?: string | null;
  children: React.ReactNode;
}) {
  return <Konteks.Provider value={{ konteks, dirawatDi }}>{children}</Konteks.Provider>;
}

export const useKonteksIsian = (): string | null => useContext(Konteks)?.konteks ?? null;

/** Ruang rawat inap pasien yang masih dirawat (peringatan FINALKAN, K6); null = tak perlu peringatan. */
export const useDirawatDi = (): string | null => useContext(Konteks)?.dirawatDi ?? null;

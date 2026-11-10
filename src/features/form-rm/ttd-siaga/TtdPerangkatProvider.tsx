"use client";

import { createContext, useCallback, useContext, useMemo, useRef } from "react";
import { apiGet } from "@/lib/api-client";
import type { PerangkatPilihDto } from "./types";

/**
 * Konteks metode "Perangkat" (tablet siaga) untuk slot TTD di halaman isian
 * Form RM (docs/PRD_TTD_Perangkat_Siaga.md §5.3). Dipasang `IsianFrame`; di luar
 * Form RM (Master, BCKH, Berkas Klaim) tidak ada provider → metode tak tampil.
 * Daftar perangkat dimuat sekali lalu dibagi semua slot (singgah 15 dtk).
 */

type Nilai = {
  isianId: string;
  /** Isian DRAF yang boleh diubah pengguna ini. */
  aktif: boolean;
  /** Daftar perangkat terpasang; `paksa` = abaikan singgahan (mis. tombol muat ulang). */
  muat: (paksa?: boolean) => Promise<PerangkatPilihDto[]>;
};

const Konteks = createContext<Nilai | null>(null);

const API = "/api/form-rm/ttd-siaga/perangkat";
const SINGGAH_MS = 15_000;

const kedaluwarsa = (waktu: number) => Date.now() - waktu > SINGGAH_MS;

export function TtdPerangkatProvider({ isianId, aktif, children }: { isianId: string; aktif: boolean; children: React.ReactNode }) {
  const singgah = useRef<{ data: PerangkatPilihDto[]; waktu: number } | null>(null);
  const berjalan = useRef<Promise<PerangkatPilihDto[]> | null>(null);

  const muat = useCallback((paksa = false): Promise<PerangkatPilihDto[]> => {
    const s = singgah.current;
    if (!paksa && s && !kedaluwarsa(s.waktu)) return Promise.resolve(s.data);
    if (berjalan.current) return berjalan.current;
    const p = apiGet<PerangkatPilihDto[]>(API)
      .then((data) => {
        singgah.current = { data, waktu: Date.now() };
        return data;
      })
      .finally(() => {
        berjalan.current = null;
      });
    berjalan.current = p;
    return p;
  }, []);

  const nilai = useMemo(() => ({ isianId, aktif, muat }), [isianId, aktif, muat]);
  return <Konteks.Provider value={nilai}>{children}</Konteks.Provider>;
}

export const useTtdPerangkat = () => useContext(Konteks);

/* --------------------------------------------- perangkat terakhir (per browser) */

const KUNCI_TERAKHIR = "rh.ttdSiaga.perangkatTerakhir";

/** ID perangkat terakhir di browser ini (hanya ID — bukan data pasien). */
export function perangkatTerakhir(): string | null {
  try {
    return window.localStorage.getItem(KUNCI_TERAKHIR);
  } catch {
    return null;
  }
}

export function ingatPerangkat(id: string): void {
  try {
    window.localStorage.setItem(KUNCI_TERAKHIR, id);
  } catch {
    /* penyimpanan diblokir — cukup tak diingat */
  }
}

"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { apiDelete, apiGet, apiPut } from "@/lib/api-client";
import type { DataTtdSaya, JenisTtdSaya } from "@/features/form-rm/ttd-saya";

/**
 * Konteks "tanda tangan saya": nama lengkap pengguna login + TTD/paraf
 * tersimpannya, dimuat sekali per halaman Form RM dan dipakai bersama semua slot
 * TTD. Tanpa provider (mis. Master, Bukti Pelayanan) fitur ini tidak tampil.
 */

type NilaiTtdSaya = {
  /** null = belum dimuat / gagal dimuat (fitur disembunyikan, form tetap jalan). */
  data: DataTtdSaya | null;
  simpan(jenis: JenisTtdSaya, png: string): Promise<void>;
  hapus(jenis: JenisTtdSaya): Promise<void>;
};

const Konteks = createContext<NilaiTtdSaya | null>(null);

export function TtdSayaProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<DataTtdSaya | null>(null);

  useEffect(() => {
    const ac = new AbortController();
    apiGet<DataTtdSaya>("/api/form-rm/ttd-saya", { signal: ac.signal })
      .then(setData)
      .catch(() => {
        /* tanpa data → tombol "TTD saya" tidak tampil; penandatanganan biasa tetap jalan */
      });
    return () => ac.abort();
  }, []);

  const simpan = useCallback(async (jenis: JenisTtdSaya, png: string) => {
    setData(await apiPut<DataTtdSaya>("/api/form-rm/ttd-saya", { jenis, png }));
  }, []);
  const hapus = useCallback(async (jenis: JenisTtdSaya) => {
    setData(await apiDelete<DataTtdSaya>(`/api/form-rm/ttd-saya?jenis=${jenis}`));
  }, []);

  const nilai = useMemo(() => ({ data, simpan, hapus }), [data, simpan, hapus]);
  return <Konteks.Provider value={nilai}>{children}</Konteks.Provider>;
}

export const useTtdSaya = () => useContext(Konteks);

/** Nama lengkap pengguna login ("" bila belum dimuat / di luar Form RM). */
export const useNamaSaya = () => useContext(Konteks)?.data?.nama ?? "";

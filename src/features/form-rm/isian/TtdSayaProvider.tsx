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

/**
 * `endpoint` = API "tanda tangan saya" modul pemakai (bawaan Form RM; BCKH memakai
 * `/api/bckh/ttd-saya` — tabel & aturan pemilik yang sama, izin modulnya sendiri).
 */
export function TtdSayaProvider({ children, endpoint = "/api/form-rm/ttd-saya" }: { children: React.ReactNode; endpoint?: string }) {
  const [data, setData] = useState<DataTtdSaya | null>(null);

  useEffect(() => {
    const ac = new AbortController();
    apiGet<DataTtdSaya>(endpoint, { signal: ac.signal })
      .then(setData)
      .catch(() => {
        /* tanpa data → tombol "TTD saya" tidak tampil; penandatanganan biasa tetap jalan */
      });
    return () => ac.abort();
  }, [endpoint]);

  const simpan = useCallback(
    async (jenis: JenisTtdSaya, png: string) => {
      setData(await apiPut<DataTtdSaya>(endpoint, { jenis, png }));
    },
    [endpoint],
  );
  const hapus = useCallback(
    async (jenis: JenisTtdSaya) => {
      setData(await apiDelete<DataTtdSaya>(`${endpoint}?jenis=${jenis}`));
    },
    [endpoint],
  );

  const nilai = useMemo(() => ({ data, simpan, hapus }), [data, simpan, hapus]);
  return <Konteks.Provider value={nilai}>{children}</Konteks.Provider>;
}

export const useTtdSaya = () => useContext(Konteks);

/** Nama lengkap pengguna login ("" bila belum dimuat / di luar Form RM). */
export const useNamaSaya = () => useContext(Konteks)?.data?.nama ?? "";

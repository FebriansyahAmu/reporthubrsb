"use client";

import { useEffect, useRef, useState } from "react";
import {
  bacaAwal,
  bacaBerubah,
  bacaHadir,
  bacaStatus,
  dataEvent,
  type AwalAliran,
  type BerubahAliran,
  type OrangHadir,
  type StatusAliran,
} from "@/features/form-rm/aliran-isian";
import { BATAS_SENYAP_MS } from "@/features/form-rm/ttd-siaga/sse";

/**
 * Aliran SSE satu isian form berlanjut (PRD Berlanjut §8.5–8.6), dengan
 * penjagaan yang sama seperti tablet TTD siaga:
 * - dibuka HANYA saat tab terlihat; ditutup saat tersembunyi (kembali terlihat →
 *   `awal` membawa rev terkini, klien mengejar ketinggalan);
 * - watchdog detak (senyap > 45 dtk = putus), sambung ulang manual bertahap
 *   1 → 30 dtk (EventSource berhenti sendiri setelah respons non-200);
 * - sebelum sambung ulang setelah putus, `onPulih` mengambil isi terkini —
 *   sekaligus memeriksa hak: 401/403/404/422 → aliran berhenti (`berhenti`).
 * - `segarkan` (umur aliran habis / tautan dilepas) → sambung ulang segera.
 */

export type KoneksiAliran = "mati" | "menyambung" | "terhubung" | "terputus" | "berhenti";

export type PendengarAliran = {
  onAwal: (a: AwalAliran) => void;
  onBerubah: (e: BerubahAliran) => void;
  onStatus: (e: StatusAliran) => void;
  onHadir: (daftar: OrangHadir[]) => void;
  /** Setelah putus, sebelum sambung ulang: ambil isi terkini. false = berhenti (akses berakhir). */
  onPulih: () => Promise<boolean>;
};

const JEDA_AWAL_MS = 1_000;
const JEDA_MAKS_MS = 30_000;

export function useAliranIsian(a: { aktif: boolean; isianId: string; konteks: string } & PendengarAliran): KoneksiAliran {
  const { aktif, isianId, konteks } = a;
  const [koneksi, setKoneksi] = useState<KoneksiAliran>("mati");
  const ref = useRef<PendengarAliran>(a);
  useEffect(() => {
    ref.current = a;
  });

  useEffect(() => {
    if (!aktif) return;
    const url = `/api/form-rm/isian/${encodeURIComponent(isianId)}/aliran?konteks=${encodeURIComponent(konteks)}`;
    let es: EventSource | null = null;
    let mati = false;
    let berjalan = false;
    let perluPulih = false;
    let jeda = JEDA_AWAL_MS;
    let terakhir = Date.now();
    let timerUlang: ReturnType<typeof setTimeout> | undefined;

    const putus = () => {
      if (!es) return;
      es.close();
      es = null;
      ref.current.onHadir([]);
    };
    const berhenti = () => {
      mati = true;
      putus();
      clearTimeout(timerUlang);
      setKoneksi("berhenti");
    };
    const jadwalUlang = () => {
      if (mati) return;
      putus();
      perluPulih = true;
      setKoneksi("terputus");
      clearTimeout(timerUlang);
      timerUlang = setTimeout(() => void sambung(), jeda);
      jeda = Math.min(jeda * 2, JEDA_MAKS_MS);
    };

    const sambung = async () => {
      if (mati || berjalan || document.visibilityState !== "visible") return;
      berjalan = true;
      try {
        setKoneksi("menyambung");
        if (perluPulih) {
          let lanjut: boolean;
          try {
            lanjut = await ref.current.onPulih();
          } catch {
            jadwalUlang();
            return;
          }
          if (mati) return;
          if (!lanjut) return berhenti();
          perluPulih = false;
        }
        putus();
        const sumber = new EventSource(url);
        es = sumber;
        terakhir = Date.now();
        const segar = () => {
          terakhir = Date.now();
        };
        sumber.addEventListener("awal", (ev) => {
          segar();
          const d = bacaAwal(dataEvent((ev as MessageEvent).data));
          if (!d) return;
          jeda = JEDA_AWAL_MS;
          setKoneksi("terhubung");
          ref.current.onAwal(d);
        });
        sumber.addEventListener("berubah", (ev) => {
          segar();
          const d = bacaBerubah(dataEvent((ev as MessageEvent).data));
          if (d) ref.current.onBerubah(d);
        });
        sumber.addEventListener("status", (ev) => {
          segar();
          const d = bacaStatus(dataEvent((ev as MessageEvent).data));
          if (d) ref.current.onStatus(d);
        });
        sumber.addEventListener("hadir", (ev) => {
          segar();
          const d = bacaHadir(dataEvent((ev as MessageEvent).data));
          if (d) ref.current.onHadir(d.daftar);
        });
        sumber.addEventListener("detak", segar);
        sumber.addEventListener("segarkan", () => {
          if (es !== sumber) return;
          putus();
          jeda = JEDA_AWAL_MS;
          void sambung();
        });
        sumber.onerror = () => {
          if (es === sumber) jadwalUlang();
        };
      } finally {
        berjalan = false;
      }
    };

    const anjing = setInterval(() => {
      if (es && Date.now() - terakhir > BATAS_SENYAP_MS) jadwalUlang();
    }, 5_000);
    const lihat = () => {
      if (mati) return;
      if (document.visibilityState !== "visible") {
        // Tab tersembunyi: aliran ditutup (hemat koneksi); kembali terlihat → `awal` membawa rev terkini.
        clearTimeout(timerUlang);
        putus();
        setKoneksi("mati");
        return;
      }
      if (es) return;
      clearTimeout(timerUlang);
      jeda = JEDA_AWAL_MS;
      void sambung();
    };
    document.addEventListener("visibilitychange", lihat);
    window.addEventListener("online", lihat);
    void sambung();

    return () => {
      mati = true;
      putus();
      clearTimeout(timerUlang);
      clearInterval(anjing);
      document.removeEventListener("visibilitychange", lihat);
      window.removeEventListener("online", lihat);
    };
  }, [aktif, isianId, konteks]);

  return aktif ? koneksi : "mati";
}

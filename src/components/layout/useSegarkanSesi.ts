"use client";

import { useEffect, useRef } from "react";
import {
  KUNCI_LOCK_SEGAR,
  KUNCI_SEGAR,
  bacaWaktuBersama,
  keluarBerjalan,
  perluSegarkan,
  tulisWaktuBersama,
} from "@/lib/sesi";

type HasilSegar = { jenis: "ok"; sisaSesiMs: number | null } | { jenis: "berakhir" } | { jenis: "gagal" };

/** Rotasi refresh token (POST tanpa `callbackUrl` = penyegaran latar, jawaban JSON). */
async function mintaSegarkan(): Promise<HasilSegar> {
  try {
    const res = await fetch("/api/auth/refresh", {
      method: "POST",
      cache: "no-store",
      headers: { Accept: "application/json" },
    });
    if (res.status === 401) return { jenis: "berakhir" };
    if (!res.ok) return { jenis: "gagal" };
    const json: unknown = await res.json().catch(() => null);
    const sisa = (json as { data?: { sesi?: { sisaMs?: unknown } } } | null)?.data?.sesi?.sisaMs;
    return { jenis: "ok", sisaSesiMs: typeof sisa === "number" ? sisa : null };
  } catch {
    // Jaringan putus / server mati: coba lagi pada putaran berikutnya.
    return { jenis: "gagal" };
  }
}

/** Satu tab saja yang merotasi; tab lain menunggu lalu melihat catatan yang sudah baru. */
async function denganKunci(kerja: () => Promise<void>): Promise<void> {
  if (typeof navigator !== "undefined" && navigator.locks) {
    await navigator.locks.request(KUNCI_LOCK_SEGAR, kerja);
  } else {
    await kerja();
  }
}

/** Putaran pemeriksaan; timer tab latar diperlambat browser hingga ±1 menit. */
const PUTARAN_MS = 30_000;

/**
 * Penyegaran sesi di latar: selama ada tab aplikasi terbuka, refresh token
 * dirotasi setiap `jedaMs` (sebelum access token habis), walau pengguna tidak
 * menyentuh apa pun — idle tidak mengeluarkan pengguna. Jadwal dibagi antar-tab
 * lewat localStorage + Web Lock, jadi banyak tab ≠ banyak rotasi.
 *
 * - Berhasil → `onSisaSesi(sisa ms sampai batas mutlak | null)`.
 * - 401 (sesi dicabut / kedaluwarsa / batas) → `onBerakhir()`.
 * - Gangguan sementara (jaringan, 5xx) → diam, dicoba lagi pada putaran berikutnya.
 */
export function useSegarkanSesi({
  jedaMs,
  onSisaSesi,
  onBerakhir,
}: {
  jedaMs: number;
  onSisaSesi: (sisaMs: number | null) => void;
  onBerakhir: () => void;
}) {
  const cbSisa = useRef(onSisaSesi);
  const cbBerakhir = useRef(onBerakhir);
  useEffect(() => {
    cbSisa.current = onSisaSesi;
    cbBerakhir.current = onBerakhir;
  });

  useEffect(() => {
    if (jedaMs <= 0) return;
    let berhenti = false;
    let sibuk = false;

    const periksa = async () => {
      if (berhenti || sibuk || keluarBerjalan()) return;
      if (!perluSegarkan(bacaWaktuBersama(KUNCI_SEGAR), Date.now(), jedaMs)) return;
      sibuk = true;
      try {
        await denganKunci(async () => {
          // Periksa ulang di dalam kunci: tab lain mungkin baru saja menyegarkan.
          if (berhenti || keluarBerjalan() || !perluSegarkan(bacaWaktuBersama(KUNCI_SEGAR), Date.now(), jedaMs)) return;
          const hasil = await mintaSegarkan();
          if (hasil.jenis === "ok") {
            tulisWaktuBersama(KUNCI_SEGAR, Date.now());
            if (!berhenti) cbSisa.current(hasil.sisaSesiMs);
          } else if (hasil.jenis === "berakhir" && !berhenti) {
            cbBerakhir.current();
          }
        });
      } finally {
        sibuk = false;
      }
    };
    const jalankan = () => void periksa();
    const terlihat = () => {
      if (document.visibilityState === "visible") jalankan();
    };

    jalankan();
    const id = window.setInterval(jalankan, PUTARAN_MS);
    document.addEventListener("visibilitychange", terlihat);
    window.addEventListener("online", jalankan);
    window.addEventListener("focus", jalankan);
    return () => {
      berhenti = true;
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", terlihat);
      window.removeEventListener("online", jalankan);
      window.removeEventListener("focus", jalankan);
    };
  }, [jedaMs]);
}

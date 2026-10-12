import { useSyncExternalStore } from "react";
import { JALUR_AWAL_DESKTOP } from "./desktop-jalur";

/**
 * Aplikasi desktop (Tauri, `desktop/`) menyuntikkan `window.__AUDITTRAIL_DESKTOP__`
 * (versi aplikasi) sebelum halaman dimuat. Hanya penanda tampilan — bukan
 * kapabilitas; tidak ada IPC antara halaman dan aplikasi.
 */
export function diAplikasiDesktop(): boolean {
  return typeof window !== "undefined" && "__AUDITTRAIL_DESKTOP__" in window;
}

/** Tujuan bawaan setelah masuk bila tidak ada `callbackUrl`. */
export function tujuanBawaanMasuk(): string {
  return diAplikasiDesktop() ? JALUR_AWAL_DESKTOP : "/dashboard";
}

const tanpaLangganan = () => () => {};

/** Tawarkan unduhan installer: ada rilis di server, browser Windows, bukan di dalam aplikasi desktop. */
export function useTawarkanUnduhDesktop(adaRilis: boolean): boolean {
  return useSyncExternalStore(
    tanpaLangganan,
    () => adaRilis && /Windows/i.test(navigator.userAgent) && !diAplikasiDesktop(),
    () => false,
  );
}

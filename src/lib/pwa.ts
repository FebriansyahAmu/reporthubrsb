/**
 * PWA di klien: pendaftaran service worker + ajakan "Pasang aplikasi".
 *
 * Service worker hanya terdaftar di konteks aman (HTTPS / localhost) dan di build
 * produksi; di HTTP LAN browser memang menolaknya (lihat PRD K4). Ajakan pasang
 * (`beforeinstallprompt`) hanya ada di Chromium — browser lain memakai menu
 * bawaannya sendiri.
 */
import { useSyncExternalStore } from "react";

type AjakanPasang = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

let ajakan: AjakanPasang | null = null;
const pendengar = new Set<() => void>();
const kabari = () => pendengar.forEach((f) => f());

function langganan(f: () => void): () => void {
  pendengar.add(f);
  return () => pendengar.delete(f);
}

/** Simpan ajakan pasang agar bisa dipicu dari menu; kembalikan fungsi pembersih. */
export function tangkapAjakanPasang(): () => void {
  const saatAda = (e: Event) => {
    e.preventDefault(); // tanpa bilah pasang otomatis; menu pengguna yang menawarkan
    ajakan = e as AjakanPasang;
    kabari();
  };
  const saatTerpasang = () => {
    ajakan = null;
    kabari();
  };
  window.addEventListener("beforeinstallprompt", saatAda);
  window.addEventListener("appinstalled", saatTerpasang);
  return () => {
    window.removeEventListener("beforeinstallprompt", saatAda);
    window.removeEventListener("appinstalled", saatTerpasang);
  };
}

export function useBisaDipasang(): boolean {
  return useSyncExternalStore(
    langganan,
    () => ajakan !== null,
    () => false,
  );
}

/** Tampilkan dialog pasang bawaan browser (sekali pakai per ajakan). */
export async function pasangAplikasi(): Promise<void> {
  const a = ajakan;
  if (!a) return;
  ajakan = null;
  kabari();
  await a.prompt();
  await a.userChoice.catch(() => undefined);
}

export function daftarkanServiceWorker(): void {
  if (process.env.NODE_ENV !== "production") return;
  if (!("serviceWorker" in navigator) || !window.isSecureContext) return;
  navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).catch(() => {
    // Gagal daftar tidak mengganggu aplikasi — hanya tanpa halaman "tidak terhubung".
  });
}

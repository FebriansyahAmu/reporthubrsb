"use client";

import { useEffect } from "react";
import { daftarkanServiceWorker, tangkapAjakanPasang } from "@/lib/pwa";

/** Daftarkan service worker & tangkap ajakan pasang aplikasi (tanpa UI). */
export function PendaftarPwa() {
  useEffect(() => tangkapAjakanPasang(), []);
  useEffect(() => daftarkanServiceWorker(), []);
  return null;
}

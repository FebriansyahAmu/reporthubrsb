import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /**
   * Origin yang boleh meminta aset dev internal (`/_next/*`, HMR) di `next dev`.
   * WAJIB memuat IP LAN agar HP bisa membuka & meng-hydrate halaman (mis. /sign
   * TTD jarak jauh) — tanpa ini, dari IP LAN halaman ter-render tapi JS client
   * tak jalan (tidak ter-hydrate). Samakan dengan SIGN_PUBLIC_ORIGIN di .env.
   */
  allowedDevOrigins: ["10.202.100.127"],
};

export default nextConfig;

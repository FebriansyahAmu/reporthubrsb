import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /**
   * Build mandiri (self-contained) untuk Docker: menghasilkan `.next/standalone`
   * berisi server + node_modules ter-trace sehingga image runtime kecil & tak
   * perlu `npm install` lagi.
   */
  output: "standalone",

  /** Jangan umumkan framework/versi lewat header `X-Powered-By`. */
  poweredByHeader: false,

  /**
   * Paket sisi-server yang TIDAK di-bundle (di-require dari node_modules saat
   * runtime): Prisma client + driver adapter mariadb. Wajib agar driver adapter
   * & query engine ikut ter-trace ke output standalone dengan benar.
   */
  serverExternalPackages: ["@prisma/client", "@prisma/adapter-mariadb", "mariadb"],

  /**
   * Origin yang boleh meminta aset dev internal (`/_next/*`, HMR) di `next dev`.
   * WAJIB memuat IP LAN agar HP bisa membuka & meng-hydrate halaman (mis. /sign
   * TTD jarak jauh) — tanpa ini, dari IP LAN halaman ter-render tapi JS client
   * tak jalan (tidak ter-hydrate). Samakan dengan SIGN_PUBLIC_ORIGIN di .env.
   */
  allowedDevOrigins: ["10.202.100.127", "10.10.102.20"],

  /**
   * Service worker PWA: selalu dicek ulang (pembaruan langsung berlaku) dan
   * hanya boleh memuat skrip dari origin sendiri.
   */
  async headers() {
    return [
      {
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, max-age=0, must-revalidate" },
          { key: "Content-Security-Policy", value: "default-src 'self'; script-src 'self'" },
          { key: "X-Content-Type-Options", value: "nosniff" },
        ],
      },
    ];
  },

  experimental: {
    /**
     * Body request yang melewati `src/proxy.ts` di-buffer & DIPOTONG DIAM-DIAM
     * di batas ini (default 10 MB). Sisipan Paket Klaim maks 10 MB + overhead
     * multipart → 12 MB agar unggahan tidak rusak.
     */
    proxyClientMaxBodySize: "12mb",
  },
};

export default nextConfig;

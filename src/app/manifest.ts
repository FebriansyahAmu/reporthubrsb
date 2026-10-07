import type { MetadataRoute } from "next";

/**
 * Manifest PWA (PRD Form RM Terpadu F5): aplikasi bisa dipasang sebagai jendela
 * sendiri dengan ikon di taskbar/layar utama. Pemasangan penuh butuh HTTPS (K4);
 * di HTTP LAN browser tetap bisa "Buat pintasan → buka sebagai jendela".
 * Diambil browser TANPA cookie → dikecualikan dari proxy auth.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "AuditTrail RS BOLTIM",
    short_name: "AuditTrail",
    description: "Pelaporan, formulir rekam medis, dan cetak RSUD Bolaang Mongondow Timur.",
    lang: "id",
    dir: "ltr",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    orientation: "any",
    background_color: "#f2f7fb",
    theme_color: "#0b3658",
    categories: ["medical", "productivity"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}

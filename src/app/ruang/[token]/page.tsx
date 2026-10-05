import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import { bacaInventarisPublik } from "@/server/modules/inventaris/publik.service";
import { HalamanInventarisPublik } from "@/features/inventaris/publik/HalamanInventarisPublik";

/**
 * Halaman PUBLIK (tanpa login) daftar barang satu ruangan — dibuka dengan
 * memindai QR label ruangan. Token di URL = satu-satunya izin. Pengamanan
 * berlapis: proxy (metode, laju, CSP ber-nonce, header keamanan) → service
 * (validasi format, status aktif, data minimal) → 404 seragam untuk semua
 * kegagalan. Dirender di server; tak ada API JSON publik untuk disedot.
 */

export const runtime = "nodejs";
// Wajib dinamis: nonce CSP per request & pencabutan tautan berlaku seketika.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Inventaris Ruangan · RSUD Boltim",
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
  referrer: "no-referrer",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#0b3658" };

export default async function InventarisPublikPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const data = await bacaInventarisPublik(token);
  if (!data) notFound();
  return <HalamanInventarisPublik data={data} />;
}

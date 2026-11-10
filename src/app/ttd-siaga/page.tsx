import type { Metadata, Viewport } from "next";
import { cookies, headers } from "next/headers";
import { LayarTtdSiaga } from "@/features/form-rm/ttd-siaga/LayarTtdSiaga";
import { UnauthorizedError } from "@/server/lib/errors";
import { ipKlien } from "@/server/lib/request";
import { namaCookiePerangkat } from "@/server/modules/ttd-siaga/kredensial.aturan";
import { bacaTokenDariNilai, headerAman } from "@/server/modules/ttd-siaga/kredensial";
import { autentikasiPerangkat } from "@/server/modules/ttd-siaga/perangkat.sesi";

/**
 * Halaman tablet TTD siaga (docs/PRD_TTD_Perangkat_Siaga.md §5.1–5.2). PUBLIK
 * (tanpa sesi pengguna): proxy memasang CSP ber-nonce + header keamanan; yang
 * menentukan tampilan hanyalah cookie PERANGKAT. Tanpa data pasien apa pun —
 * hanya nama perangkat ketika sudah terpasang. Rotasi kredensial terjadi di
 * klien lewat `POST /api/ttd-siaga/segarkan` (Server Component tak bisa
 * memasang cookie).
 */

export const runtime = "nodejs";
// Wajib dinamis: nonce CSP per request & status pemasangan selalu terbaru.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "TTD Siaga · RSUD Boltim",
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
  referrer: "no-referrer",
};

/** Kunci zoom: sentuhan di layar untuk menggambar tanda tangan, bukan pinch/zoom. */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#0b3658",
};

export default async function TtdSiagaPage() {
  const [c, h] = await Promise.all([cookies(), headers()]);
  const token = bacaTokenDariNilai(c.get(namaCookiePerangkat(headerAman(h)))?.value);
  let nama: string | null = null;
  if (token) {
    try {
      nama = (await autentikasiPerangkat(token, { ip: ipKlien(h), rotasi: false })).perangkat.nama;
    } catch (err) {
      // Tak sah → layar pasang. Galat lain (DB sibuk) → tetap siaga; klien memastikan lewat `segarkan`.
      nama = err instanceof UnauthorizedError ? null : "";
    }
  }
  return <LayarTtdSiaga awal={nama === null ? null : { nama }} />;
}

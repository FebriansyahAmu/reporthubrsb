import type { NextRequest } from "next/server";

/**
 * IP klien dari header reverse proxy, atau null bila tak ada. Produksi: container
 * hanya terbuka ke 127.0.0.1 di balik reverse proxy, jadi:
 * 1. `X-Real-IP` — reverse proxy MENIMPA nilainya (`proxy_set_header X-Real-IP
 *    $remote_addr`), jadi tak bisa dikarang klien;
 * 2. entri PALING KANAN `X-Forwarded-For` — yang ditambahkan hop terakhir. Entri
 *    paling kiri dikirim klien apa adanya, jadi TIDAK dipakai. Tanpa reverse
 *    proxy, Next sendiri mengisi XFF dengan alamat socket.
 */
export function ipKlien(headers: Headers): string | null {
  const kanan = headers.get("x-forwarded-for")?.split(",").map((s) => s.trim()).filter(Boolean).at(-1);
  const ip = headers.get("x-real-ip")?.trim() || kanan;
  return ip ? ip.slice(0, 64) : null;
}

/** IP klien untuk jejak audit (lihat `ipKlien`). */
export function clientIp(req: NextRequest): string | null {
  return ipKlien(req.headers);
}

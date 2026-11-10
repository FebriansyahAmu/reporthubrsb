/**
 * Daftar TERTUTUP rute publik perangkat TTD siaga (docs/PRD_TTD_Perangkat_Siaga.md
 * §7.4, §8.5). Dipakai `src/proxy.ts`: jalur di bawah `/ttd-siaga` atau
 * `/api/ttd-siaga` yang tak terdaftar → 404, metode lain → 405, dan laju per IP
 * per rute. MURNI (tanpa `server-only`) agar proxy & uji unit bisa memakainya.
 */

export const PREFIKS_TTD_SIAGA = ["/ttd-siaga", "/api/ttd-siaga"] as const;

export type RuteTtdSiaga = {
  nama: string;
  pola: RegExp;
  metode: readonly string[];
  /** Permintaan per menit per IP (lapis luar; route handler bisa lebih ketat). */
  lajuPerMenit: number;
  /** Halaman HTML (CSP ber-nonce), bukan API JSON/SSE. */
  halaman?: boolean;
};

export const RUTE_TTD_SIAGA: readonly RuteTtdSiaga[] = [
  { nama: "halaman", pola: /^\/ttd-siaga$/, metode: ["GET", "HEAD"], lajuPerMenit: 60, halaman: true },
  { nama: "pasang", pola: /^\/api\/ttd-siaga\/pasang$/, metode: ["POST"], lajuPerMenit: 20 },
  { nama: "segarkan", pola: /^\/api\/ttd-siaga\/segarkan$/, metode: ["POST"], lajuPerMenit: 30 },
  { nama: "aliran", pola: /^\/api\/ttd-siaga\/aliran$/, metode: ["GET"], lajuPerMenit: 12 },
  // ID permintaan = 22 karakter base64url; format lain tak pernah sampai ke route handler.
  { nama: "tampil", pola: /^\/api\/ttd-siaga\/permintaan\/[A-Za-z0-9_-]{22}\/tampil$/, metode: ["POST"], lajuPerMenit: 30 },
  { nama: "kirim", pola: /^\/api\/ttd-siaga\/permintaan\/[A-Za-z0-9_-]{22}$/, metode: ["POST"], lajuPerMenit: 20 },
];

export const diBawahTtdSiaga = (pathname: string): boolean =>
  PREFIKS_TTD_SIAGA.some((p) => pathname === p || pathname.startsWith(`${p}/`));

export type HasilRute = { jenis: "ok"; rute: RuteTtdSiaga } | { jenis: "metode"; rute: RuteTtdSiaga } | { jenis: "tak-ada" };

export function cocokRuteTtdSiaga(pathname: string, metode: string): HasilRute {
  const rute = RUTE_TTD_SIAGA.find((r) => r.pola.test(pathname));
  if (!rute) return { jenis: "tak-ada" };
  return rute.metode.includes(metode.toUpperCase()) ? { jenis: "ok", rute } : { jenis: "metode", rute };
}

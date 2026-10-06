/**
 * Perlindungan CSRF untuk permintaan yang mengubah data, tanpa token: browser
 * modern selalu mengirim `Sec-Fetch-Site`, dan browser lama mengirim `Origin`
 * pada POST/PATCH lintas situs. Algoritmanya sama dengan
 * `http.CrossOriginProtection` (Go 1.25):
 *
 * 1. `Sec-Fetch-Site` ada → hanya `same-origin` / `none` yang diterima.
 * 2. Tanpa itu, `Origin` ada → host-nya harus sama dengan host permintaan
 *    (atau host yang diizinkan, mis. origin publik dari env).
 * 3. Tanpa keduanya → bukan permintaan browser lintas situs (klien non-browser
 *    tak membawa cookie korban), diterima.
 *
 * Melengkapi cookie `SameSite=Lax` (pertahanan berlapis). Murni → mudah diuji.
 */
export function permintaanLintasSitus(headers: Headers, hostDiizinkan: readonly string[] = []): boolean {
  const situs = headers.get("sec-fetch-site");
  if (situs) return situs !== "same-origin" && situs !== "none";

  const origin = headers.get("origin");
  if (!origin) return false;
  let host: string;
  try {
    host = new URL(origin).host;
  } catch {
    return true; // "null" atau origin rusak
  }
  const hostPermintaan = [headers.get("x-forwarded-host"), headers.get("host")].filter(Boolean);
  return !hostPermintaan.includes(host) && !hostDiizinkan.includes(host);
}

import "server-only";

/**
 * Origin publik aplikasi (mis. `https://reporthub.rsudboltim.go.id`) untuk
 * tautan yang dibagikan ke luar sesi — QR label ruangan, TTD jarak jauh.
 *
 * SENGAJA hanya dari konfigurasi, TIDAK dari header `Host`/`X-Forwarded-*`
 * request (rawan host-header injection → QR menunjuk domain penyerang).
 * Urutan: `PUBLIC_APP_ORIGIN`, lalu `SIGN_PUBLIC_ORIGIN` (sudah dipakai TTD).
 * Nilai harus origin http(s) murni (tanpa path/query); selain itu → null.
 */
export function asalPublik(): string | null {
  for (const nama of ["PUBLIC_APP_ORIGIN", "SIGN_PUBLIC_ORIGIN"] as const) {
    const mentah = process.env[nama]?.trim();
    if (!mentah) continue;
    try {
      const u = new URL(mentah);
      const murni = (u.pathname === "/" || u.pathname === "") && !u.search && !u.hash && !u.username && !u.password;
      if ((u.protocol === "https:" || u.protocol === "http:") && murni) return u.origin;
    } catch {
      /* jatuh ke pesan di bawah */
    }
    console.error(`[public-origin] ${nama} bukan origin http(s) yang valid — diabaikan`);
  }
  return null;
}

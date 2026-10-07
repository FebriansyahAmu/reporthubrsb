/**
 * Validasi tujuan pengalihan (`callbackUrl`) — hanya path internal origin ini.
 *
 * `startsWith("/") && !startsWith("//")` saja TIDAK cukup: parser URL WHATWG
 * memperlakukan `\` sebagai `/` (`/\evil.com` → `//evil.com`), membuang
 * tab/baris baru diam-diam, dan menormalkan segmen titik (`/.//evil.com`,
 * `/%2e//evil.com` → path `//evil.com`). Hasil yang diawali `//` dibaca sebagai
 * URL tanpa skema (host asing) begitu di-resolve terhadap origin aplikasi →
 * open redirect. Karena itu input diperiksa, lalu HASIL normalisasinya diperiksa
 * ulang. Murni (aman di klien, server, maupun proxy).
 */

const BASIS = "http://jalur.invalid";
const KARAKTER_TERLARANG = /[\\\u0000-\u001f\u007f]/;

function tetapDiOrigin(v: string): URL | null {
  try {
    const u = new URL(v, BASIS);
    return u.origin === BASIS ? u : null;
  } catch {
    return null;
  }
}

/** Path internal yang aman (`/a?b#c`), atau null bila bukan path internal. */
export function jalurInternal(v: string | null | undefined): string | null {
  if (!v || v.length > 2048 || !v.startsWith("/") || v.startsWith("//")) return null;
  if (KARAKTER_TERLARANG.test(v)) return null;
  const u = tetapDiOrigin(v);
  if (!u) return null;
  const hasil = u.pathname + u.search + u.hash;
  // Diperiksa ulang: hasil normalisasi yang dipakai pemanggil, bukan input mentah.
  if (hasil.startsWith("//") || KARAKTER_TERLARANG.test(hasil) || !tetapDiOrigin(hasil)) return null;
  return hasil;
}

/**
 * Klasifikasi "Penyakit Menular" berdasarkan kode ICD-10, dipakai bersama oleh
 * laporan RL (4.1, 5.1, dst). Definisi transparan & mudah diaudit:
 *
 *  - **Bab I ICD-10 (A00–B99)** — Penyakit Infeksi & Parasit (semua kode A/B),
 *  - **Infeksi saluran napas akut (J00–J06, J09–J22)** — ISPA, influenza,
 *    pneumonia, bronkitis/bronkiolitis akut (mengecualikan penyakit napas
 *    kronik J30+/J40+ yang bukan menular),
 *  - **COVID-19 / SARS (U04, U07)**.
 *
 * Menangkap penyakit menular nyata di data RS (dengue A90/A91, tifoid A01,
 * TB A15–A19, gastroenteritis A0x, ISPA J06, pneumonia J18, dll). Tidak ada
 * input pengguna di kondisi SQL (hanya huruf/prefiks tetap) → aman injeksi.
 */

/** Prefiks 3-karakter ICD-10 menular DI LUAR Bab I (A/B). */
export const MENULAR_EXTRA_PREFIXES: readonly string[] = [
  // Infeksi saluran napas akut atas & influenza/pneumonia & bawah akut
  "J00", "J01", "J02", "J03", "J04", "J05", "J06",
  "J09", "J10", "J11", "J12", "J13", "J14", "J15", "J16", "J17", "J18",
  "J20", "J21", "J22",
  // COVID-19 / SARS
  "U04", "U07",
];

/** Mode filter kelompok penyakit. */
export type MenularMode = "all" | "menular" | "non";

/** Label ringkas mode filter untuk tampilan & Excel/PDF. */
export const MENULAR_MODE_LABEL: Record<MenularMode, string> = {
  all: "Semua diagnosa",
  menular: "Penyakit menular",
  non: "Non-menular",
};

/** Deskripsi definisi (untuk catatan laporan). */
export const MENULAR_DEFINISI =
  "Penyakit menular = ICD-10 Bab I (A00–B99) + infeksi saluran napas akut (J00–J06, J09–J22) + COVID/SARS (U04, U07)";

/** True bila kode ICD-10 termasuk penyakit menular (sesuai definisi di atas). */
export function isMenular(kode: string | null | undefined): boolean {
  if (!kode) return false;
  const k = kode.trim().toUpperCase();
  if (!k) return false;
  const c0 = k[0];
  if (c0 === "A" || c0 === "B") return true;
  return MENULAR_EXTRA_PREFIXES.includes(k.slice(0, 3));
}

/**
 * Kondisi SQL menular untuk ekspresi kode tertentu (mis. `"md.KODE"`).
 * Hanya huruf/prefiks tetap yang di-inline → aman.
 */
export function menularSqlCondition(kodeExpr: string): string {
  const list = MENULAR_EXTRA_PREFIXES.map((p) => `'${p}'`).join(", ");
  return `(LEFT(${kodeExpr}, 1) IN ('A', 'B') OR LEFT(${kodeExpr}, 3) IN (${list}))`;
}

/**
 * Fragmen WHERE tambahan untuk mode filter (diawali spasi; kosong utk "all").
 * Contoh: `menularWhereFragment("menular", "md.KODE")` → `AND (LEFT(...))`.
 */
export function menularWhereFragment(mode: MenularMode, kodeExpr: string): string {
  if (mode === "menular") return ` AND ${menularSqlCondition(kodeExpr)}`;
  if (mode === "non") return ` AND NOT ${menularSqlCondition(kodeExpr)}`;
  return "";
}

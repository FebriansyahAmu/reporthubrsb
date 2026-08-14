/**
 * Konstanta & util modul Master (dipakai FE form & BE schema). Bebas server-only.
 */

export const MASTER_PENGGUNA = "master.pengguna";
export const MASTER_PERAN = "master.peran";

/** Agama — data milik aplikasi (bukan referensi SIMGOS). */
export const AGAMA_VALUES = [
  "Islam",
  "Kristen",
  "Katolik",
  "Hindu",
  "Buddha",
  "Konghucu",
  "Lainnya",
] as const;
export type Agama = (typeof AGAMA_VALUES)[number];

/**
 * Normalisasi nomor HP/WA Indonesia → E.164 "+62…".
 * Mengembalikan "" bila kosong, atau `null` bila format tidak valid.
 */
export function normalizePhone(raw: string): string | null {
  const t = (raw ?? "").trim();
  if (!t) return "";
  const cleaned = t.replace(/[\s\-().]/g, "");
  let d: string;
  if (/^\+62\d+$/.test(cleaned)) d = cleaned.slice(1); // +62xxx → 62xxx
  else if (/^62\d+$/.test(cleaned)) d = cleaned; // 62xxx
  else if (/^0\d+$/.test(cleaned)) d = "62" + cleaned.slice(1); // 0xxx → 62xxx
  else return null;
  if (!/^62\d{7,13}$/.test(d)) return null;
  return "+" + d;
}

/** Format tampil nomor telepon (biarkan apa adanya bila bukan +62). */
export function displayPhone(v: string | null | undefined): string {
  return v ? v : "—";
}

/** Rakit nama lengkap dgn gelar: "dr. Budi Santoso, Sp.PD". */
export function fullName(u: {
  gelarDepan?: string | null;
  name: string;
  gelarBelakang?: string | null;
}): string {
  const depan = (u.gelarDepan ?? "").trim();
  const belakang = (u.gelarBelakang ?? "").trim();
  const head = [depan, u.name.trim()].filter(Boolean).join(" ");
  return belakang ? `${head}, ${belakang}` : head;
}

/** Samarkan NIK → tampilkan 4 digit terakhir. */
export function maskNik(nik: string | null | undefined): string | null {
  if (!nik) return null;
  const s = nik.trim();
  if (s.length < 4) return "•".repeat(s.length);
  return "•".repeat(s.length - 4) + s.slice(-4);
}

/** Sandi acak kuat (untuk tombol "Buat sandi" di modal). */
export function generatePassword(len = 14): string {
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const lower = "abcdefghijkmnpqrstuvwxyz";
  const digit = "23456789";
  const sym = "!@#$%*?";
  const all = upper + lower + digit + sym;
  const pick = (set: string) => set[Math.floor(Math.random() * set.length)];
  const base = [pick(upper), pick(lower), pick(digit), pick(sym)];
  for (let i = base.length; i < len; i++) base.push(pick(all));
  // acak urutan
  for (let i = base.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [base[i], base[j]] = [base[j], base[i]];
  }
  return base.join("");
}

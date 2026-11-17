/** Helper murni petugas ruangan (tanpa DB) — dipakai service & diuji unit. */

/** NIP tanpa spasi (data PJ kerap ditempel dengan spasi pemisah). */
export function normNip(v: string | null | undefined): string {
  return (v ?? "").replace(/\s+/g, "");
}

/** NIP layak dicocokkan: cukup panjang & berisi angka (bukan "-" / "0"). */
export function nipBermakna(n: string): boolean {
  return n.length >= 8 && /\d/.test(n);
}

/** NIP tersamar untuk daftar pencarian akun: 4 depan … 4 belakang. */
export function samarkanNip(v: string | null | undefined): string | null {
  const n = normNip(v);
  if (!n) return null;
  if (n.length <= 8) return "•".repeat(n.length);
  return `${n.slice(0, 4)}…${n.slice(-4)}`;
}

/** Nama lengkap bergelar: "dr. Nama, Sp.PD". */
export function namaAkun(u: { name: string; gelarDepan: string | null; gelarBelakang: string | null }): string {
  const depan = u.gelarDepan?.trim();
  const belakang = u.gelarBelakang?.trim();
  return `${depan ? `${depan} ` : ""}${u.name.trim()}${belakang ? `, ${belakang}` : ""}`;
}

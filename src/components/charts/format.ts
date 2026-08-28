import { formatNumber } from "@/lib/format";

const MONTHS_ID = [
  "Jan", "Feb", "Mar", "Apr", "Mei", "Jun",
  "Jul", "Agu", "Sep", "Okt", "Nov", "Des",
];

/** Angka gaya Indonesia (ribuan titik) — memakai formatter bersama. */
export function nf(n: number): string {
  return formatNumber(Math.round(n));
}

/** 'YYYY-MM-DD' → 'DD/MM'. */
export function fmtDayShort(iso: string): string {
  const [, m, d] = iso.split("-");
  return `${d}/${m}`;
}

/** 'YYYY-MM-DD' → 'DD Mmm'. */
export function fmtDayLong(iso: string): string {
  const [, m, d] = iso.split("-");
  const mi = Number(m) - 1;
  return `${Number(d)} ${MONTHS_ID[mi] ?? m}`;
}

/** Batas atas sumbu yang "rapi" (1/2/5 × 10^k) ≥ nilai maksimum. */
export function niceMax(v: number): number {
  if (v <= 5) return 5;
  const pow = Math.pow(10, Math.floor(Math.log10(v)));
  const n = v / pow;
  const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10;
  return step * pow;
}

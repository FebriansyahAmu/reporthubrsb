import { tambahHari } from "@/server/modules/surat-kontrol/surat-kontrol.filter";

/** Saringan rentang tanggal bersama tab "Terbit saat pulang" & "Kontrol = SEP" (tak melewati hari ini). */

export const awalBulan = (iso: string) => `${iso.slice(0, 8)}01`;
const akhirBulan = (iso: string) => new Date(Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)), 0)).toISOString().slice(0, 10);

export const PRESET_RENTANG = [
  { key: "hari-ini", label: "Hari ini", rentang: (t: string) => [t, t] },
  { key: "kemarin", label: "Kemarin", rentang: (t: string) => [tambahHari(t, -1), tambahHari(t, -1)] },
  { key: "7-hari", label: "7 hari terakhir", rentang: (t: string) => [tambahHari(t, -6), t] },
  { key: "bulan-ini", label: "Bulan ini", rentang: (t: string) => [awalBulan(t), t] },
  {
    key: "bulan-lalu",
    label: "Bulan lalu",
    rentang: (t: string) => {
      const a = awalBulan(tambahHari(awalBulan(t), -1));
      return [a, akhirBulan(a)];
    },
  },
] as const satisfies readonly { key: string; label: string; rentang: (t: string) => string[] }[];

/** Jaga [from, to] sah setelah satu ujung diubah: from ≤ to ≤ hari ini, lebar ≤ `maksHari`. */
export function jepitRentang(from: string, to: string, diubah: "from" | "to", hariIni: string, maksHari: number): [string, string] {
  const lebar = maksHari - 1;
  let f = from > hariIni ? hariIni : from;
  let t = to > hariIni ? hariIni : to;
  if (diubah === "from") {
    if (t < f) t = f;
    if (t > tambahHari(f, lebar)) t = tambahHari(f, lebar);
  } else {
    if (f > t) f = t;
    if (f < tambahHari(t, -lebar)) f = tambahHari(t, -lebar);
  }
  return [f, t];
}

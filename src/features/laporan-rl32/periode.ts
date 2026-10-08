/**
 * State pemilih periode RL 3.2 (murni, tanpa React): bulan, triwulan, atau
 * rentang tanggal bebas. Tiap mode menyimpan pilihannya sendiri supaya
 * berpindah mode tidak menghapus pilihan sebelumnya yang masih relevan.
 */
import { RL32_MAKS_HARI } from "@/server/modules/rl32/rl32.constants";
import {
  rentangBulan,
  rentangTriwulan,
  selisihHari,
  tambahHari,
  triwulanDari,
  type Triwulan,
} from "@/server/modules/rl32/rl32.periode";

export type ModePeriode = "bulan" | "triwulan" | "rentang";
export type Bulan = { tahun: number; bulan: number }; // bulan 1..12
export type TriwulanTahun = { tahun: number; tw: Triwulan };
export type Rentang = { from: string; to: string };

export type PilihanPeriode = {
  mode: ModePeriode;
  bulan: Bulan;
  triwulan: TriwulanTahun;
  rentang: Rentang;
};

/** Data SIMGOS tersedia sejak 2023. */
export const TAHUN_AWAL = 2023;
export const TANGGAL_AWAL = `${TAHUN_AWAL}-01-01`;

export const bulanDari = (ymd: string): Bulan => ({ tahun: Number(ymd.slice(0, 4)), bulan: Number(ymd.slice(5, 7)) });

export function geserBulan(b: Bulan, n: number): Bulan {
  const i = b.tahun * 12 + (b.bulan - 1) + n;
  return { tahun: Math.floor(i / 12), bulan: (i % 12) + 1 };
}

export function geserTriwulan(q: TriwulanTahun, n: number): TriwulanTahun {
  const i = q.tahun * 4 + (q.tw - 1) + n;
  return { tahun: Math.floor(i / 4), tw: ((i % 4) + 1) as Triwulan };
}

/** Jaga bulan di antara Januari TAHUN_AWAL dan bulan berjalan. */
export function batasBulan(b: Bulan, kini: Bulan): Bulan {
  const i = b.tahun * 12 + b.bulan;
  if (i > kini.tahun * 12 + kini.bulan) return kini;
  if (b.tahun < TAHUN_AWAL) return { tahun: TAHUN_AWAL, bulan: 1 };
  return b;
}

/** Jaga triwulan di antara Triwulan I TAHUN_AWAL dan triwulan berjalan. */
export function batasTriwulan(q: TriwulanTahun, kini: TriwulanTahun): TriwulanTahun {
  if (q.tahun * 4 + q.tw > kini.tahun * 4 + kini.tw) return kini;
  if (q.tahun < TAHUN_AWAL) return { tahun: TAHUN_AWAL, tw: 1 };
  return q;
}

export function rentangPilihan(p: PilihanPeriode): Rentang {
  if (p.mode === "bulan") return rentangBulan(p.bulan.tahun, p.bulan.bulan);
  if (p.mode === "triwulan") return rentangTriwulan(p.triwulan.tahun, p.triwulan.tw);
  return p.rentang;
}

/** Bawaan: bulan lalu (laporan RL 3.2 dikirim setelah bulan berakhir). */
export function pilihanAwal(hariIni: string): PilihanPeriode {
  const lalu = geserBulan(bulanDari(hariIni), -1);
  return {
    mode: "bulan",
    bulan: lalu,
    triwulan: { tahun: lalu.tahun, tw: triwulanDari(lalu.bulan) },
    rentang: rentangBulan(lalu.tahun, lalu.bulan),
  };
}

/**
 * Pindah mode. Pilihan mode tujuan dipertahankan bila masih beririsan dengan
 * periode yang sedang tampil; selain itu diturunkan dari periode itu
 * (mis. Juli 2026 → Triwulan III 2026 → rentang 1 Jul – 30 Sep 2026).
 */
export function gantiMode(p: PilihanPeriode, mode: ModePeriode, hariIni: string): PilihanPeriode {
  if (p.mode === mode) return p;
  const aktif = rentangPilihan(p);
  const iris = (r: Rentang) => r.from <= aktif.to && aktif.from <= r.to;
  const awal = bulanDari(aktif.from);
  if (mode === "bulan") {
    return { ...p, mode, bulan: iris(rentangBulan(p.bulan.tahun, p.bulan.bulan)) ? p.bulan : awal };
  }
  if (mode === "triwulan") {
    const q = iris(rentangTriwulan(p.triwulan.tahun, p.triwulan.tw))
      ? p.triwulan
      : { tahun: awal.tahun, tw: triwulanDari(awal.bulan) };
    return { ...p, mode, triwulan: q };
  }
  const r = iris(p.rentang) ? p.rentang : { from: aktif.from, to: aktif.to < hariIni ? aktif.to : hariIni };
  return { ...p, mode, rentang: r };
}

/**
 * Ubah satu ujung rentang; ujung lain menyesuaikan supaya rentang tetap sah
 * (awal ≤ akhir, paling lama RL32_MAKS_HARI hari, tidak melewati hari ini,
 * tidak sebelum TANGGAL_AWAL).
 */
export function ubahRentang(r: Rentang, ujung: "from" | "to", nilai: string, hariIni: string): Rentang {
  let from = ujung === "from" ? nilai : r.from;
  let to = ujung === "to" ? nilai : r.to;
  if (from < TANGGAL_AWAL) from = TANGGAL_AWAL;
  if (to > hariIni) to = hariIni;
  if (from > hariIni) from = hariIni;
  if (ujung === "from") {
    if (to < from) to = from;
    if (selisihHari(from, to) >= RL32_MAKS_HARI) to = tambahHari(from, RL32_MAKS_HARI - 1);
  } else {
    if (from > to) from = to;
    if (selisihHari(from, to) >= RL32_MAKS_HARI) from = tambahHari(to, -(RL32_MAKS_HARI - 1));
    if (from < TANGGAL_AWAL) from = TANGGAL_AWAL;
  }
  return { from, to };
}

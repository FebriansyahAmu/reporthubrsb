/**
 * Pembatas laju jendela-tetap di memori proses (proxy Next 16 = runtime
 * Node.js, satu proses per container → cukup tanpa Redis). Murni & tanpa
 * dependensi agar mudah diuji; jam bisa disuntikkan.
 *
 * Memori dibatasi `maksKunci`: entri kedaluwarsa dibuang dulu, lalu yang
 * tertua (Map menjaga urutan sisip) — banjir IP palsu tak bisa menghabiskan RAM.
 */

import { ipKlien } from "./request";

export type HasilLaju ={ izin: true } | { izin: false; ulangDetik: number };

export type PembatasLaju = (kunci: string, sekarang?: number) => HasilLaju;

export function buatPembatasLaju(opsi: { batas: number; jendelaMs: number; maksKunci?: number }): PembatasLaju {
  const { batas, jendelaMs, maksKunci = 10_000 } = opsi;
  const ember = new Map<string, { mulai: number; jumlah: number }>();

  const rapikan = (sekarang: number) => {
    for (const [k, e] of ember) if (sekarang - e.mulai >= jendelaMs) ember.delete(k);
    for (const k of ember.keys()) {
      if (ember.size < maksKunci) break;
      ember.delete(k);
    }
  };

  return (kunci, sekarang = Date.now()) => {
    let e = ember.get(kunci);
    if (!e || sekarang - e.mulai >= jendelaMs) {
      if (!e && ember.size >= maksKunci) rapikan(sekarang);
      e = { mulai: sekarang, jumlah: 0 };
      ember.set(kunci, e);
    }
    e.jumlah++;
    if (e.jumlah <= batas) return { izin: true };
    return { izin: false, ulangDetik: Math.max(1, Math.ceil((e.mulai + jendelaMs - sekarang) / 1000)) };
  };
}

/**
 * Kunci IP klien untuk pembatasan laju (aturan pemilihan header: `ipKlien`).
 * Bila header dipalsukan pun, pembatas global tetap membatasi beban total.
 */
export function kunciIpKlien(headers: Headers): string {
  return ipKlien(headers) ?? "tanpa-ip";
}

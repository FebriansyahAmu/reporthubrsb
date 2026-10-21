import type { KunciLayanan } from "./domisili.constants";

/** Kunjungan = pendaftaran (episode); pasien = NORM unik. */
export type Hitung = { kunjungan: number; pasien: number };

/** Per layanan + gabungan. `semua.pasien` ≠ jumlah per layanan (satu pasien bisa ke beberapa layanan). */
export type NilaiLayanan = Record<KunciLayanan | "semua", Hitung>;

export type KelasDomisili = "dalam" | "luar" | "tidakDiketahui";

/** Baris rincian wilayah: kecamatan (dalam kabupaten) atau kabupaten/kota (luar). */
export type BarisWilayah = {
  /** Kode `master.wilayah`; "" = kecamatan tidak tercatat. */
  kode: string;
  nama: string;
  /** Provinsi (hanya rincian luar kabupaten). */
  provinsi?: string;
  nilai: NilaiLayanan;
};

export type DomisiliResult = {
  periode: { from: string; to: string };
  kabupaten: { kode: string; nama: string };
  ringkasan: Record<KelasDomisili | "total", NilaiLayanan>;
  /** Semua kecamatan kabupaten (termasuk yang nol), + "tidak tercatat" bila ada. */
  kecamatan: BarisWilayah[];
  /** Kabupaten/kota asal pasien luar kabupaten, terbanyak lebih dulu. */
  luar: BarisWilayah[];
  updatedAt: string;
};

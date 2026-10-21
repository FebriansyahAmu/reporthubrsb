/**
 * Laporan Klasifikasi Kunjungan per Domisili — konstanta (edge/klien aman).
 */

/**
 * Kabupaten Bolaang Mongondow Timur di `master.wilayah` (JENIS 2, kode Kemendagri
 * 4 digit). Domisili pasien = `LEFT(master.pasien.WILAYAH, 4)` — kolom itu berisi
 * kode desa 10 digit (sebagian kecil hanya kode kabupaten/kecamatan), sama
 * dengan cara fungsi SIMGOS `master.getAlamatPasien` menurunkan kabupaten.
 */
export const KODE_KAB_BOLTIM = "7110";

/** Rentang periode maksimal (hari) — satu tahun penuh muat; sama dengan pemilih periode RL 3.2. */
export const DOMISILI_MAKS_HARI = 366;

/** Jenis layanan = `master.ruangan.JENIS_KUNJUNGAN` ruangan tujuan pendaftaran. */
export const LAYANAN = [
  { key: "igd", jenis: 2, label: "IGD", panjang: "Gawat Darurat" },
  { key: "rj", jenis: 1, label: "Rawat Jalan", panjang: "Rawat Jalan" },
  { key: "ri", jenis: 3, label: "Rawat Inap", panjang: "Rawat Inap" },
] as const;

export type KunciLayanan = (typeof LAYANAN)[number]["key"];

export const KELAS_DOMISILI = {
  dalam: "Dalam Kab. Bolaang Mongondow Timur",
  luar: "Luar Kab. Bolaang Mongondow Timur",
  tidakDiketahui: "Domisili tidak tercatat",
} as const;

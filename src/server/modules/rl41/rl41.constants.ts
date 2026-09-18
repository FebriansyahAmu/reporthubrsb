/**
 * Konstanta laporan RL 4.1 (Data Morbiditas & Mortalitas Pasien Rawat Inap,
 * format SIRS Kemenkes). 25 kelompok umur resmi RL 4.1 — dipakai bersama oleh
 * server (agregasi & Excel) dan klien (label tabel).
 *
 * CATATAN: di SIMGOS logika ini ada di SP `laporan.LaporanRL41Revisi` yang
 * memakai fungsi `master.getKelompokUmurRevisi` — fungsi itu TIDAK ada di
 * instalasi ini sehingga SP selalu gagal (`ER_SP_DOES_NOT_EXIST`). Laporan
 * di-PORT ke aplikasi sebagai SELECT read-only (SIMGOS tidak diubah — HIGH ALERT),
 * dengan pengelompokan umur dihitung sendiri sesuai daftar di bawah.
 */

export type Rl41AgeGroup = {
  /** 1..25 sesuai urutan resmi. */
  id: number;
  /** Label lengkap untuk header Excel. */
  label: string;
  /** Label ringkas untuk tampilan sempit. */
  short: string;
};

export const RL41_AGE_GROUPS: Rl41AgeGroup[] = [
  { id: 1, label: "< 1 jam", short: "<1j" },
  { id: 2, label: "1 - 23 jam", short: "1-23j" },
  { id: 3, label: "1 - 7 hari", short: "1-7h" },
  { id: 4, label: "8 - 28 hari", short: "8-28h" },
  { id: 5, label: "29 hari - < 3 bln", short: "29h-3bl" },
  { id: 6, label: "3 - < 6 bulan", short: "3-6bl" },
  { id: 7, label: "6 - 11 bulan", short: "6-11bl" },
  { id: 8, label: "1 - 4 tahun", short: "1-4" },
  { id: 9, label: "5 - 9 tahun", short: "5-9" },
  { id: 10, label: "10 - 14 tahun", short: "10-14" },
  { id: 11, label: "15 - 19 tahun", short: "15-19" },
  { id: 12, label: "20 - 24 tahun", short: "20-24" },
  { id: 13, label: "25 - 29 tahun", short: "25-29" },
  { id: 14, label: "30 - 34 tahun", short: "30-34" },
  { id: 15, label: "35 - 39 tahun", short: "35-39" },
  { id: 16, label: "40 - 44 tahun", short: "40-44" },
  { id: 17, label: "45 - 49 tahun", short: "45-49" },
  { id: 18, label: "50 - 54 tahun", short: "50-54" },
  { id: 19, label: "55 - 59 tahun", short: "55-59" },
  { id: 20, label: "60 - 64 tahun", short: "60-64" },
  { id: 21, label: "65 - 69 tahun", short: "65-69" },
  { id: 22, label: "70 - 74 tahun", short: "70-74" },
  { id: 23, label: "75 - 79 tahun", short: "75-79" },
  { id: 24, label: "80 - 84 tahun", short: "80-84" },
  { id: 25, label: "≥ 85 tahun", short: "≥85" },
];

/** Nama bulan Indonesia (index 0 = Januari). */
export const MONTHS_ID = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

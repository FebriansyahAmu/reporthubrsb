/**
 * Tipe bersama modul kunjungan (dipakai server DAL/mapper/service, mock, dan UI).
 * File ini murni tipe/konstanta — tanpa `server-only` — sehingga aman diimpor
 * (type-only) oleh komponen client.
 */

export type KategoriKunjungan = "Rawat Inap" | "Rawat Jalan Klinik" | "IGD";

/**
 * Peta kode `master.ruangan.JENIS_KUNJUNGAN` → kategori.
 * (1 = klinik/poli, 2 = IGD, 3 = ruang rawat inap; kode lain = penunjang/farmasi
 * yang tidak dipakai untuk Resume Medis.)
 */
export const JENIS_KUNJUNGAN_KATEGORI: Record<number, KategoriKunjungan> = {
  1: "Rawat Jalan Klinik",
  2: "IGD",
  3: "Rawat Inap",
};

/** Kategori yang relevan untuk Resume Medis (dipakai di filter WHERE). */
export const KATEGORI_JENIS_KUNJUNGAN = [1, 2, 3] as const;

/** Opsi ruangan untuk dropdown filter (hanya ID 9-digit, kategori RI/RJ/IGD). */
export type RuanganOption = {
  id: string;
  nama: string;
  kategori: KategoriKunjungan;
};

/** Satu baris kunjungan siap tampil di kartu. */
export type KunjunganResumeItem = {
  /** id = NOPEN (dipakai untuk /print/resume-medis/[id]). */
  id: string;
  norm: string;
  nama: string;
  jenisKelamin: string;
  umur: string | null;
  kategori: KategoriKunjungan;
  ruang: string;
  dpjp: string | null;
  diagnosa: string | null;
  /** ISO lokal (tanpa Z). */
  tglMasuk: string;
  /** ISO lokal, atau null bila kolom KELUAR masih kosong (belum final). */
  tglKeluar: string | null;
};

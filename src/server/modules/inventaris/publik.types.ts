/**
 * DTO halaman publik daftar barang ruangan. SATU-SATUNYA bentuk data yang
 * keluar ke pengunjung tanpa login — sengaja tanpa ID, kode barang, harga,
 * merk, nomor seri, maupun penanggung jawab. Menambah field di sini = membuka
 * data ke publik; tinjau dulu.
 */

export type TonePublik = "success" | "warning" | "danger" | "neutral";

export type KondisiPublik = { nama: string; tone: TonePublik; jumlah: number };

/** Satu baris = barang bernama sama dengan kondisi & tahun sama (digabung). */
export type BarangPublik = {
  nama: string;
  kondisi: string;
  tone: TonePublik;
  tahun: number | null;
  jumlah: number;
};

export type InventarisPublik = {
  ruangan: string;
  totalUnit: number;
  kondisi: KondisiPublik[];
  barang: BarangPublik[];
  /** true bila jumlah unit melebihi batas tampilan. */
  terpotong: boolean;
  /** Waktu data disusun (ISO). */
  disusunPada: string;
};

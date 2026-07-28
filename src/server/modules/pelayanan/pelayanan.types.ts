/**
 * Tipe bersama modul Monitoring Pelayanan (server + client, type-only).
 * Mengacu kategori ruangan yang sama dengan modul kunjungan.
 */
import type { PageMeta } from "@/lib/types";
import type { KategoriKunjungan } from "@/server/modules/kunjungan/kunjungan.types";

export type { KategoriKunjungan };

/** Satu kunjungan untuk tab "Kunjungan" (dengan lama rawat). */
export type KunjunganPelayananItem = {
  /** kunjungan.NOMOR — PK unik per kunjungan (dipakai sebagai key React). */
  nomor: string;
  /** NOPEN (nomor pendaftaran; bisa sama untuk beberapa kunjungan). */
  nopen: string;
  norm: string;
  nama: string;
  jenisKelamin: string;
  umur: string | null;
  kategori: KategoriKunjungan;
  ruang: string;
  ruanganId: string;
  /** ISO lokal (tanpa Z). */
  masuk: string;
  /** ISO lokal, atau null bila KELUAR masih kosong (belum difinalkan). */
  keluar: string | null;
  /** Lama dirawat dalam menit (MASUK→KELUAR, atau MASUK→sekarang bila berjalan). */
  lamaMenit: number;
  /** true bila KELUAR terisi (sudah difinalkan). */
  final: boolean;
};

export type KunjunganPelayananSummary = {
  total: number;
  belumFinal: number;
  final: number;
  /** Rata-rata lama rawat (menit) untuk kunjungan yang sudah final. */
  rataLamaMenit: number | null;
};

/** Jumlah per kategori (memperhitungkan pencarian, sebelum filter tab kategori). */
export type KunjunganPelayananCounts = Record<"Semua" | KategoriKunjungan, number>;

export type KunjunganPelayananResult = {
  /** Potongan halaman (server-side pagination). */
  data: KunjunganPelayananItem[];
  meta: PageMeta;
  summary: KunjunganPelayananSummary;
  counts: KunjunganPelayananCounts;
  updatedAt: string;
};

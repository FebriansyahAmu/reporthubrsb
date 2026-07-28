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

// ---------------------------------------------------------------------------
// Belum Difinalkan (Aging) — kunjungan KELUAR NULL, dikelompokkan umur tunggakan.
// ---------------------------------------------------------------------------

export type AgingBucket = "b1" | "b2" | "b3" | "b4";

export const AGING_BUCKETS: {
  key: AgingBucket;
  label: string;
  tone: "warning" | "danger";
}[] = [
  { key: "b1", label: "< 1 hari", tone: "warning" },
  { key: "b2", label: "1–2 hari", tone: "warning" },
  { key: "b3", label: "2–7 hari", tone: "danger" },
  { key: "b4", label: "> 7 hari", tone: "danger" },
];

/** Tentukan bucket umur tunggakan dari lama terbuka (menit). */
export function agingBucket(lamaMenit: number): AgingBucket {
  const hari = lamaMenit / 1440;
  if (hari < 1) return "b1";
  if (hari < 2) return "b2";
  if (hari < 7) return "b3";
  return "b4";
}

export type BelumFinalItem = KunjunganPelayananItem & { bucket: AgingBucket };

export type BelumFinalCounts = Record<"Semua" | AgingBucket, number>;

export type BelumFinalResult = {
  data: BelumFinalItem[];
  meta: PageMeta;
  counts: BelumFinalCounts;
  updatedAt: string;
};

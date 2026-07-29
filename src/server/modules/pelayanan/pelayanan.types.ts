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

// ---------------------------------------------------------------------------
// Kelengkapan Diagnosa (ICD) — kunjungan FINAL vs medicalrecord.diagnosa.
// ---------------------------------------------------------------------------

export type DiagnosaStatus = "TANPA_DX" | "TANPA_ICD" | "TANPA_UTAMA" | "LENGKAP";

export const DIAGNOSA_STATUS_META: Record<
  DiagnosaStatus,
  { label: string; tone: "danger" | "warning" | "success" }
> = {
  TANPA_DX: { label: "Tanpa Diagnosa", tone: "danger" },
  TANPA_ICD: { label: "Tanpa Kode ICD", tone: "warning" },
  TANPA_UTAMA: { label: "Tanpa Diagnosa Utama", tone: "warning" },
  LENGKAP: { label: "Lengkap", tone: "success" },
};

/** Urutan status paling parah → paling lengkap (untuk tab). */
export const DIAGNOSA_STATUS_ORDER: DiagnosaStatus[] = [
  "TANPA_DX",
  "TANPA_ICD",
  "TANPA_UTAMA",
  "LENGKAP",
];

/** Turunkan status kelengkapan dari agregat diagnosa (UTAMA=1 primer, KODE=ICD). */
export function diagnosaStatus(jml: number, jmlKode: number, jmlUtama: number): DiagnosaStatus {
  if (jml <= 0) return "TANPA_DX";
  if (jmlKode <= 0) return "TANPA_ICD";
  if (jmlUtama <= 0) return "TANPA_UTAMA";
  return "LENGKAP";
}

export type DiagnosaItem = {
  nomor: string;
  nopen: string;
  norm: string;
  nama: string;
  jenisKelamin: string;
  umur: string | null;
  kategori: KategoriKunjungan;
  ruang: string;
  ruanganId: string;
  masuk: string;
  keluar: string | null;
  status: DiagnosaStatus;
  jmlDiagnosa: number;
  /** Diagnosa representatif (utama bila ada) untuk ditampilkan. */
  diagnosaNama: string | null;
  diagnosaKode: string | null;
};

export type DiagnosaCounts = Record<"Semua" | DiagnosaStatus, number>;

export type DiagnosaResult = {
  data: DiagnosaItem[];
  meta: PageMeta;
  counts: DiagnosaCounts;
  updatedAt: string;
};

// ---------------------------------------------------------------------------
// Kelengkapan Resume Medis — kunjungan FINAL vs medicalrecord.resume (per NOPEN).
// Resume medis (ringkasan pulang) melekat pada NOPEN/episode, bukan per-leg.
// ---------------------------------------------------------------------------

export type ResumeStatus = "TANPA_RESUME" | "RESUME_MINIM" | "LENGKAP";

export const RESUME_STATUS_META: Record<
  ResumeStatus,
  { label: string; tone: "danger" | "warning" | "success" }
> = {
  TANPA_RESUME: { label: "Tanpa Resume", tone: "danger" },
  RESUME_MINIM: { label: "Resume Belum Lengkap", tone: "warning" },
  LENGKAP: { label: "Lengkap", tone: "success" },
};

/** Urutan status paling parah → paling lengkap (untuk tab). */
export const RESUME_STATUS_ORDER: ResumeStatus[] = [
  "TANPA_RESUME",
  "RESUME_MINIM",
  "LENGKAP",
];

/**
 * Komponen INTI resume yang wajib terisi (di SIMGOS berupa int-ref; 0 = kosong).
 * Hanya komponen naratif yang konsisten dipakai — RPS/TANDA_VITAL/diagnosa-json
 * sengaja diabaikan karena hampir selalu kosong (dicatat di modul lain).
 */
export const RESUME_CORE_COMPONENTS = [
  { key: "ANAMNESIS", label: "Anamnesis" },
  { key: "KELUHAN_UTAMA", label: "Keluhan utama" },
  { key: "RPP", label: "Riwayat penyakit" },
  { key: "RENCANA_TERAPI", label: "Rencana terapi" },
] as const;

export type ResumeItem = {
  nomor: string;
  nopen: string;
  norm: string;
  nama: string;
  jenisKelamin: string;
  umur: string | null;
  kategori: KategoriKunjungan;
  ruang: string;
  ruanganId: string;
  masuk: string;
  keluar: string | null;
  status: ResumeStatus;
  /** ISO lokal kapan resume dibuat, atau null bila tak ada resume. */
  resumeTanggal: string | null;
  /** Label komponen inti yang belum diisi (untuk status RESUME_MINIM). */
  komponenKurang: string[];
};

export type ResumeCounts = Record<"Semua" | ResumeStatus, number>;

export type ResumeResult = {
  data: ResumeItem[];
  meta: PageMeta;
  counts: ResumeCounts;
  updatedAt: string;
};

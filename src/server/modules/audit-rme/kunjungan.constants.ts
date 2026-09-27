/**
 * Konstanta Fase 2 — kepatuhan pengimputan berbasis KUNJUNGAN (read-only SIMGOS).
 *
 * File ini BEBAS server-only (dipakai juga oleh view untuk label/tone). Nama
 * tabel/kolom SQL TIDAK ada di sini — allow-list sumber ada di `kunjungan.dal.ts`.
 *
 * Sumber & keputusan: docs/PRD_Audit_Trail_RME_Fase2_Kepatuhan.md (§2, §4, §10).
 */

import type { BadgeTone } from "./audit.constants";

/* ------------------------------------------------------------ kategori (scope) */

/** 5 kategori pengimputan yang diaudit (TERKUNCI, PRD §10). */
export const KATEGORI_KEYS = ["ASESMEN", "CPPT", "TTV", "DIAGNOSIS", "TINDAKAN"] as const;
export type KategoriKey = (typeof KATEGORI_KEYS)[number];

export type KategoriMeta = {
  key: KategoriKey;
  label: string;
  /** Label ringkas untuk pip kartu. */
  short: string;
  /** Diagnosis dicatat per episode (NOPEN), bukan per ruangan kunjungan. */
  perEpisode: boolean;
};

export const KATEGORI: Record<KategoriKey, KategoriMeta> = {
  ASESMEN: { key: "ASESMEN", label: "Asesmen", short: "ASM", perEpisode: false },
  CPPT: { key: "CPPT", label: "CPPT", short: "CPPT", perEpisode: false },
  TTV: { key: "TTV", label: "Tanda Vital", short: "TTV", perEpisode: false },
  DIAGNOSIS: { key: "DIAGNOSIS", label: "Diagnosis", short: "DX", perEpisode: true },
  TINDAKAN: { key: "TINDAKAN", label: "Tindakan", short: "TIN", perEpisode: false },
};

/* --------------------------------------------- jenis kunjungan (referensi 15) */

/** `master.ruangan.JENIS_KUNJUNGAN` → `master.referensi JENIS=15` (diverifikasi 26 Sep 2026). */
export const JENIS_KUNJUNGAN: Record<number, { label: string; short: string; tone: BadgeTone }> = {
  1: { label: "Rawat Jalan", short: "RJ", tone: "brand" },
  2: { label: "Gawat Darurat", short: "IGD", tone: "danger" },
  3: { label: "Rawat Inap", short: "RI", tone: "accent" },
  4: { label: "Laboratorium", short: "LAB", tone: "success" },
  5: { label: "Radiologi", short: "RAD", tone: "success" },
  6: { label: "Kamar Operasi", short: "OK", tone: "warning" },
  7: { label: "Hemodialisa", short: "HD", tone: "neutral" },
  11: { label: "Farmasi", short: "FAR", tone: "neutral" },
  12: { label: "Kamar Bersalin", short: "VK", tone: "neutral" },
  18: { label: "Bukan Ruangan Pelayanan", short: "LAIN", tone: "neutral" },
};

/** Urutan tampil jenis kunjungan di rail/filter. */
export const JENIS_KUNJUNGAN_ORDER = [3, 2, 1, 4, 5, 6, 11, 7, 12, 18] as const;

export function jenisKunjunganLabel(id: number | null | undefined): string {
  if (id == null) return "—";
  return JENIS_KUNJUNGAN[id]?.label ?? `Jenis #${id}`;
}

/**
 * Kelompok jenis kunjungan. "KLINIS" = layanan yang wajib 5 kategori RME —
 * default papan agar kunjungan penunjang (farmasi/lab, mayoritas volume) tidak
 * menenggelamkan data kepatuhan klinis.
 */
export const KELOMPOK_JENIS = {
  KLINIS: [1, 2, 3],
} as const;
export type KelompokJenis = keyof typeof KELOMPOK_JENIS;
export const KELOMPOK_LABEL: Record<KelompokJenis, string> = { KLINIS: "Layanan klinis" };

/** Jenis kunjungan yang boleh dipilih di filter (validasi Zod). */
export const JENIS_KUNJUNGAN_IDS = Object.keys(JENIS_KUNJUNGAN).map(Number);

/**
 * Kategori WAJIB per jenis kunjungan → dasar skor kelengkapan kunjungan (PRD §4.1).
 * Penunjang (Lab/Rad/OK) cukup Tindakan. Farmasi dilacak lewat Tindakan juga
 * (keputusan §10.3) tapi tidak diwajibkan → kelengkapan "tidak berlaku".
 */
const KLINIS: readonly KategoriKey[] = KATEGORI_KEYS;
export const KATEGORI_WAJIB: Record<number, readonly KategoriKey[]> = {
  1: KLINIS,
  2: KLINIS,
  3: KLINIS,
  4: ["TINDAKAN"],
  5: ["TINDAKAN"],
  6: ["TINDAKAN"],
};

export function kategoriWajib(jenis: number | null | undefined): readonly KategoriKey[] {
  return jenis == null ? [] : (KATEGORI_WAJIB[jenis] ?? []);
}

/* ------------------------------------------ status kunjungan (kunjungan.STATUS) */

/** `pendaftaran.kunjungan.STATUS`: 0 batal · 1 sedang dilayani · 2 selesai. */
export type StatusKunjungan = "BATAL" | "AKTIF" | "SELESAI";

export function statusKunjungan(s: number | null | undefined): StatusKunjungan {
  if (s === 0) return "BATAL";
  if (s === 1) return "AKTIF";
  return "SELESAI";
}

export const STATUS_KUNJUNGAN_LABEL: Record<StatusKunjungan, string> = {
  AKTIF: "Sedang dilayani",
  SELESAI: "Selesai",
  BATAL: "Batal",
};

/* --------------------------------------------------- profesi (referensi 36) */

/** `master.pegawai.PROFESI` → `master.referensi JENIS=36`. */
export const PROFESI: Record<number, string> = {
  1: "Administrasi",
  2: "Analis",
  3: "Bidan",
  4: "Dokter",
  5: "Farmasi",
  6: "Perawat",
  7: "Perekam Medis",
  8: "Radiografer",
  9: "Fisioterapis",
  10: "Penata Anastesi",
  11: "Terapis Gigi",
  12: "Dietisen",
  13: "Tenaga Sanitasi Lingkungan",
};
export const PROFESI_DOKTER = 4;
export const PROFESI_PERAWAT = 6;
export const PROFESI_BIDAN = 3;

export function profesiLabel(id: number | null | undefined): string {
  if (id == null) return "Tidak diketahui";
  return PROFESI[id] ?? `Profesi #${id}`;
}

/** Urutan tampil profesi (klinis dulu). */
export const PROFESI_ORDER = [4, 6, 3, 5, 2, 8, 9, 10, 11, 12, 7, 1, 13] as const;

/* --------------------------------------------- peran penulis CPPT (referensi 32) */

/** `medicalrecord.cppt.JENIS` → `master.referensi JENIS=32` (Jenis Petugas Medis). */
export const CPPT_PERAN: Record<number, string> = {
  1: "Dokter",
  2: "Anastesi",
  3: "Paramedis",
  4: "Apoteker",
  5: "Bidan",
  6: "Analis",
  7: "Penata Anastesi",
};
export const CPPT_PERAN_DOKTER = 1;
export const CPPT_PERAN_PARAMEDIS = 3;

/* ------------------------------------------------------- shift & target (RI) */

export type ShiftKey = "PAGI" | "SIANG" | "MALAM";

/** Jam shift WITA (PRD §10.1). `end` eksklusif; Malam melintasi tengah malam. */
export const SHIFTS: readonly { key: ShiftKey; label: string; start: number; end: number }[] = [
  { key: "PAGI", label: "Pagi", start: 7, end: 14 },
  { key: "SIANG", label: "Siang", start: 14, end: 21 },
  { key: "MALAM", label: "Malam", start: 21, end: 7 },
];

export function shiftOfHour(hour: number): ShiftKey {
  if (hour >= 7 && hour < 14) return "PAGI";
  if (hour >= 14 && hour < 21) return "SIANG";
  return "MALAM";
}

/** Target kepatuhan Rawat Inap per 24 jam (default PRD §4.2 — dapat diubah). */
export const TARGET_RI = {
  /** CPPT oleh Paramedis/Perawat per shift. */
  cpptPerawatPerShift: 1,
  /** CPPT oleh Dokter (visite) per 24 jam. */
  cpptDokterPerHari: 1,
  /** Pemeriksaan TTV per 24 jam. */
  ttvPerHari: 3,
} as const;

/** Ambang keterlambatan input TTV (menit) — `TANGGAL − WAKTU_PEMERIKSAAN`. */
export const TTV_TERLAMBAT_MENIT = 60;

/* ------------------------------------------------------------- batas rentang */

/** RI yang masuk sebelum rentang tetap ikut bila masih dirawat — batas lookback index. */
export const LOOKBACK_RI_HARI = 60;
/** Rentang maksimal papan kunjungan (hari). */
export const RENTANG_MAKS_HARI = 31;

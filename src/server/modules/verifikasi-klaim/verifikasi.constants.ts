/**
 * Konstanta modul Verifikasi Klaim BPJS — AMAN untuk client (tanpa I/O, tanpa
 * `server-only`). Sumber tunggal status, transisi, penanggung jawab & batas.
 * PRD: docs/PRD_Verifikasi_Klaim_BPJS.md §4–§7.
 */

/* ------------------------------------------------------------ jenis layanan */

export const KATEGORI = ["RI", "IGD", "RJ"] as const;
export type Kategori = (typeof KATEGORI)[number];

export const KATEGORI_LABEL: Record<Kategori, string> = {
  RI: "Rawat Inap",
  IGD: "IGD",
  RJ: "Rawat Jalan",
};

/** `pendaftaran.penjamin.JENIS` (REF 10): 2 = BPJS / JKN. */
export const PENJAMIN_BPJS = 2;

/** Cakupan penjamin antrean: default BPJS (PRD §11-2), "semua" lewat filter. */
export const CAKUPAN_PENJAMIN = ["bpjs", "semua"] as const;
export type CakupanPenjamin = (typeof CAKUPAN_PENJAMIN)[number];

/* ------------------------------------------------------ status & transisi */

export const STATUS_VERIFIKASI = [
  "BELUM_DIPERIKSA",
  "TIDAK_LENGKAP",
  "LOLOS_RM",
  "KOREKSI_KODING",
  "LOLOS_KLAIM",
  "FINAL",
] as const;
export type StatusVerifikasi = (typeof STATUS_VERIFIKASI)[number];

export const STATUS_AWAL: StatusVerifikasi = "BELUM_DIPERIKSA";

export type Tone = "neutral" | "danger" | "info" | "warning" | "accent" | "success";

export const STATUS_META: Record<StatusVerifikasi, { label: string; tone: Tone; pemilik: string }> = {
  BELUM_DIPERIKSA: { label: "Belum Diperiksa", tone: "neutral", pemilik: "Verifikator RM" },
  TIDAK_LENGKAP: { label: "Tidak Lengkap", tone: "danger", pemilik: "Unit / DPJP" },
  LOLOS_RM: { label: "Lolos RM", tone: "info", pemilik: "Verifikator Klaim / Coder" },
  KOREKSI_KODING: { label: "Koreksi Koding", tone: "warning", pemilik: "Petugas RM / DPJP" },
  LOLOS_KLAIM: { label: "Siap Final", tone: "accent", pemilik: "Petugas Paket Klaim" },
  FINAL: { label: "Final", tone: "success", pemilik: "—" },
};

/** Modul RBAC (lihat src/server/rbac/modules.ts). */
export const MODUL_VERIFIKASI = {
  RM: "berkas-klaim.verifikasi-rm",
  KLAIM: "berkas-klaim.verifikasi-klaim",
  PAKET: "berkas-klaim.paket",
  TINDAK_LANJUT: "berkas-klaim.tindak-lanjut",
} as const;

/** Modul yang boleh membuka antrean Verifikasi Klaim (salah satu cukup). */
export const MODUL_ANTREAN = [MODUL_VERIFIKASI.RM, MODUL_VERIFIKASI.KLAIM, MODUL_VERIFIKASI.PAKET] as const;

export type AksiVerifikasi =
  | "LOLOSKAN_RM"
  | "TANDAI_TIDAK_LENGKAP"
  | "KEMBALIKAN_KE_RM"
  | "AJUKAN_KOREKSI"
  | "KOREKSI_SESUAI"
  | "LOLOSKAN_KLAIM"
  | "KUNCI_FINAL"
  | "BUKA_KUNCI";

export type Transisi = {
  aksi: AksiVerifikasi;
  label: string;
  dari: readonly StatusVerifikasi[];
  ke: StatusVerifikasi;
  /** Modul + aksi RBAC yang berhak. `null` = hanya sistem (deteksi otomatis). */
  izin: { modul: string; aksi: "update" | "create" } | null;
  alasanWajib?: boolean;
};

/**
 * Mesin status (PRD §4). HANYA transisi di sini yang sah — divalidasi di server
 * (bukan hanya UI). Dicari lewat `cariTransisi`.
 */
export const TRANSISI: readonly Transisi[] = [
  {
    aksi: "LOLOSKAN_RM", label: "Loloskan berkas RM",
    dari: ["BELUM_DIPERIKSA", "TIDAK_LENGKAP"], ke: "LOLOS_RM",
    izin: { modul: MODUL_VERIFIKASI.RM, aksi: "update" },
  },
  {
    aksi: "TANDAI_TIDAK_LENGKAP", label: "Tandai tidak lengkap",
    dari: ["BELUM_DIPERIKSA", "TIDAK_LENGKAP"], ke: "TIDAK_LENGKAP",
    izin: { modul: MODUL_VERIFIKASI.RM, aksi: "update" },
  },
  {
    aksi: "KEMBALIKAN_KE_RM", label: "Kembalikan ke Tahap 1",
    dari: ["LOLOS_RM", "KOREKSI_KODING"], ke: "TIDAK_LENGKAP",
    izin: { modul: MODUL_VERIFIKASI.KLAIM, aksi: "update" }, alasanWajib: true,
  },
  {
    aksi: "AJUKAN_KOREKSI", label: "Ajukan koreksi koding",
    dari: ["LOLOS_RM"], ke: "KOREKSI_KODING",
    izin: { modul: MODUL_VERIFIKASI.KLAIM, aksi: "update" },
  },
  {
    aksi: "KOREKSI_SESUAI", label: "Koreksi sudah diterapkan di SIMRS",
    dari: ["KOREKSI_KODING"], ke: "LOLOS_KLAIM",
    izin: null,
  },
  {
    aksi: "LOLOSKAN_KLAIM", label: "Loloskan klaim",
    dari: ["LOLOS_RM"], ke: "LOLOS_KLAIM",
    izin: { modul: MODUL_VERIFIKASI.KLAIM, aksi: "update" },
  },
  {
    aksi: "KUNCI_FINAL", label: "Kunci FINAL",
    dari: ["LOLOS_KLAIM"], ke: "FINAL",
    izin: { modul: MODUL_VERIFIKASI.PAKET, aksi: "create" },
  },
  {
    aksi: "BUKA_KUNCI", label: "Buka kunci FINAL",
    dari: ["FINAL"], ke: "LOLOS_KLAIM",
    izin: { modul: MODUL_VERIFIKASI.KLAIM, aksi: "update" }, alasanWajib: true,
  },
];

/** Transisi sah untuk (status sekarang, aksi) — `null` bila ilegal. */
export function cariTransisi(dari: StatusVerifikasi, aksi: AksiVerifikasi): Transisi | null {
  return TRANSISI.find((t) => t.aksi === aksi && t.dari.includes(dari)) ?? null;
}

/* -------------------------------------------------- penanggung jawab item */

export const PENANGGUNG_JAWAB = {
  ADMISI: "Admisi / Pendaftaran",
  DPJP: "DPJP",
  PERAWAT: "Perawat Ruangan",
  IGD: "IGD",
  PENUNJANG: "Laboratorium / Radiologi",
  KASIR: "Kasir",
  KEPALA_RUANGAN: "Kepala Ruangan",
} as const;
export type PenanggungJawab = keyof typeof PENANGGUNG_JAWAB;

/* ------------------------------------------------------ batas anti-overload */

export const BATAS = {
  /** Rentang tanggal pulang maksimum satu permintaan antrean (PRD §7.2-3). */
  RENTANG_MAKS_HARI: 31,
  /** Ukuran `IN (…)` per query batch SIMGOS (PRD §7.2-2). */
  BATCH_NOPEN: 500,
  /** Pengaman jumlah episode satu rentang (31 hari ≈ 620 episode final). */
  EPISODE_MAKS: 3000,
  /** Umur cache hasil cek per rentang (PRD §7.2-4). */
  CACHE_TTL_MS: 60_000,
  /** Maks komputasi batch SIMGOS bersamaan (tiap komputasi = 1 koneksi, berurutan). */
  KOMPUTASI_PARALEL: 2,
  /** Ukuran halaman antrean. */
  HALAMAN_MAKS: 100,
} as const;

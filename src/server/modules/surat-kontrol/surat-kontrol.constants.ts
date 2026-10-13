/**
 * Audit Surat Kontrol — konstanta bersama server & klien (bebas server-only).
 *
 * Sumber kebenaran tanggal rencana = BPJS (webservice SIMGOS `plugins/bpjs/
 * rencanaKontrol`, real-time ke VClaim); dibandingkan dengan jadwal di SIMRS
 * (`medicalrecord.jadwal_kontrol` untuk Surat Kontrol, `medicalrecord.
 * perencanaan_rawat_inap` untuk SPRI) dan catatan penerbitan lokal
 * (`bpjs.rencana_kontrol`). Lihat docs/audit-surat-kontrol.md.
 */

/** `jnsKontrol` BPJS: 1 = SPRI (Surat Perintah Rawat Inap), 2 = Surat Kontrol. */
export const JENIS_KONTROL = {
  1: { label: "SPRI", panjang: "Surat Perintah Rawat Inap" },
  2: { label: "Surat Kontrol", panjang: "Surat Kontrol (rencana kontrol rawat jalan)" },
} as const;
export type JenisKontrol = keyof typeof JENIS_KONTROL;
export const JENIS_KONTROL_KEYS = [2, 1] as const satisfies readonly JenisKontrol[];

/** Batas rentang tanggal rencana per permintaan (beban webservice BPJS). */
export const RENTANG_MAKS_HARI = 31;
/** Rencana kontrol bisa diterbitkan untuk tanggal mendatang — izinkan s.d. N hari ke depan. */
export const MAKS_HARI_KE_DEPAN = 90;

export type Nada = "danger" | "warning" | "accent" | "neutral";

/**
 * Katalog temuan audit. `berat` menentukan status baris:
 * - "masalah"  → data tidak sesuai / tak terverifikasi (wajib diperbaiki),
 * - "tinjau"   → perlu ditinjau petugas,
 * - "info"     → catatan, tidak mengubah status (mis. jam bentrok, belum dipakai).
 */
export const TEMUAN = {
  TANGGAL_BEDA: {
    label: "Tanggal beda",
    berat: "masalah",
    nada: "danger",
    jelas: "Tanggal jadwal di SIMRS berbeda dengan tanggal rencana kontrol yang terbit di BPJS.",
  },
  TIDAK_DI_BPJS: {
    label: "Tak ada di BPJS",
    berat: "masalah",
    nada: "danger",
    jelas: "Jadwal SIMRS merujuk nomor surat yang tidak ditemukan / sudah dihapus di BPJS.",
  },
  TANPA_JADWAL: {
    label: "Tanpa jadwal SIMRS",
    berat: "tinjau",
    nada: "warning",
    jelas: "Surat terbit di BPJS, tetapi tidak ada jadwal kontrol / SPRI aktif yang merujuknya di SIMRS.",
  },
  JADWAL_BATAL: {
    label: "Jadwal dibatalkan",
    berat: "tinjau",
    nada: "warning",
    jelas: "Jadwal di SIMRS berstatus batal, tetapi surat di BPJS masih aktif.",
  },
  POLI_BEDA: {
    label: "Poli beda",
    berat: "tinjau",
    nada: "warning",
    jelas: "Poli tujuan jadwal SIMRS (dipetakan ke kode BPJS) berbeda dengan poli kontrol di BPJS.",
  },
  BELUM_BRIDGING: {
    label: "Belum terbit di BPJS",
    berat: "tinjau",
    nada: "warning",
    jelas: "Jadwal kontrol pasien BPJS di SIMRS tanpa nomor surat kontrol BPJS (belum di-bridging).",
  },
  LOKAL_BEDA: {
    label: "Catatan lokal beda",
    berat: "info",
    nada: "accent",
    jelas: "Catatan penerbitan lokal (bpjs.rencana_kontrol) tidak sama dengan data BPJS terkini (tanggal/status).",
  },
  JAM_BENTROK: {
    label: "Jam bentrok",
    berat: "info",
    nada: "accent",
    jelas: "Lebih dari satu pasien dijadwalkan pada dokter, tanggal, dan jam yang sama di SIMRS.",
  },
  BELUM_DIPAKAI: {
    label: "Belum dipakai",
    berat: "info",
    nada: "neutral",
    jelas: "Tanggal rencana sudah lewat, tetapi SEP kontrol belum terbit di BPJS (pasien belum/tidak datang).",
  },
} as const satisfies Record<string, { label: string; berat: "masalah" | "tinjau" | "info"; nada: Nada; jelas: string }>;

export type TemuanKey = keyof typeof TEMUAN;
export const TEMUAN_KEYS = Object.keys(TEMUAN) as TemuanKey[];

export const STATUS_AUDIT = {
  MASALAH: { label: "Bermasalah", nada: "danger" },
  TINJAU: { label: "Perlu ditinjau", nada: "warning" },
  SESUAI: { label: "Sesuai", nada: "success" },
} as const;
export type StatusAudit = keyof typeof STATUS_AUDIT;
export const STATUS_AUDIT_KEYS = Object.keys(STATUS_AUDIT) as StatusAudit[];

/** Status baris = temuan terberat (info tidak dihitung). */
export function statusDariTemuan(temuan: readonly TemuanKey[]): StatusAudit {
  if (temuan.some((t) => TEMUAN[t].berat === "masalah")) return "MASALAH";
  if (temuan.some((t) => TEMUAN[t].berat === "tinjau")) return "TINJAU";
  return "SESUAI";
}

/** Asal data BPJS pada satu respons: live (webservice) atau cadangan lokal. */
export type SumberBpjs = "LIVE" | "LOKAL";

/**
 * Audit "Kontrol = SEP" — konstanta bersama server & klien (bebas server-only).
 *
 * Populasi = SEMUA surat (Surat Kontrol & SPRI) hasil webservice BPJS
 * `plugins/bpjs/rencanaKontrol` untuk rentang TANGGAL RENCANA (= daftar
 * Monitoring Rencana Kontrol VClaim). Tiap surat ditautkan ke SEP yang
 * memakainya (`bpjs.kunjungan.noSuratSKDP`). Bila tanggal entri Surat Kontrol
 * (`tglTerbitKontrol`) SAMA dengan tanggal SEP kunjungan kontrol, surat itu
 * baru dibuat saat pasien datang — tidak diterbitkan saat pasien pulang.
 * Lihat docs/audit-surat-kontrol.md §11.
 */
import type { NadaPulang } from "./surat-kontrol.pulang.constants";

/** Urutan kunci = urutan prioritas tampilan (temuan dulu). */
export const STATUS_SEP = {
  SAMA_HARI: {
    label: "Terbit bersama SEP",
    pendek: "Surat = SEP",
    nada: "danger",
    jelas: "Tanggal entri surat di BPJS SAMA dengan tanggal SEP yang memakainya — surat baru dibuat saat pasien datang, tidak diterbitkan sebelumnya.",
  },
  SETELAH_SEP: {
    label: "Terbit setelah SEP",
    pendek: "Setelah SEP",
    nada: "warning",
    jelas: "Tanggal entri surat di BPJS SETELAH tanggal SEP yang memakainya (surat dientri belakangan).",
  },
  TAK_TERBACA: {
    label: "Tanggal entri belum terbaca",
    pendek: "Belum terbaca",
    nada: "neutral",
    jelas: "Surat sudah dipakai SEP, tetapi tanggal entrinya belum terbaca dari BPJS. Tekan “Segarkan dari BPJS”.",
  },
  SEP_TAK_TERCATAT: {
    label: "SEP tak tercatat di SIMGOS",
    pendek: "SEP tak tercatat",
    nada: "neutral",
    jelas: "BPJS menandai surat sudah dipakai SEP, tetapi SEP-nya tidak ada (atau batal) di bpjs.kunjungan SIMGOS — mungkin dibuat langsung di VClaim.",
  },
  SEBELUM_SEP: {
    label: "Terbit sebelum SEP",
    pendek: "Sebelum SEP",
    nada: "success",
    jelas: "Surat sudah terbit di BPJS sebelum hari SEP dibuat.",
  },
  BELUM_DIPAKAI: {
    label: "Belum dipakai SEP",
    pendek: "Belum dipakai",
    nada: "brand",
    jelas: "Surat sudah terbit di BPJS tetapi belum dipakai SEP mana pun (pasien belum / tidak datang pada rencana kontrol).",
  },
} as const satisfies Record<string, { label: string; pendek: string; nada: NadaPulang; jelas: string }>;

export type StatusSep = keyof typeof STATUS_SEP;
export const STATUS_SEP_KEYS = Object.keys(STATUS_SEP) as StatusSep[];
/** Status surat yang SUDAH dipakai SEP dengan tanggal entri terbaca — penyebut persentase. */
export const STATUS_SEP_TERBACA = ["SEBELUM_SEP", "SETELAH_SEP", "SAMA_HARI"] as const satisfies readonly StatusSep[];
/** Seri grafik harian (dasar → atas). */
export const STATUS_SEP_GRAFIK = ["SEBELUM_SEP", "SETELAH_SEP", "SAMA_HARI", "BELUM_DIPAKAI"] as const satisfies readonly StatusSep[];

/** Layanan SEP (`bpjs.kunjungan.jenisPelayanan`: 1 = Rawat Inap, 2 = Rawat Jalan). */
export const LAYANAN_SEP = {
  RI: { label: "Rawat Inap", pendek: "RI" },
  RJ: { label: "Rawat Jalan", pendek: "RJ" },
} as const;
export type LayananSep = keyof typeof LAYANAN_SEP;

/** Rentang tanggal rencana per permintaan (± 500 surat / bulan; VClaim memecah per 30 hari). */
export const RENTANG_SEP_MAKS_HARI = 31;

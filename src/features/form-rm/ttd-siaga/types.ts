/** Tipe bersama (klien & server) perangkat TTD siaga — docs/PRD_TTD_Perangkat_Siaga.md. */

import type { StatusPermintaan } from "./status";

/** BELUM = belum pernah/tidak sedang terpasang; DICABUT = dicabut pengelola. */
export type StatusPasang = "BELUM" | "TERPASANG" | "DICABUT";

/**
 * Baris daftar pengelola. SENGAJA tanpa kolom kredensial (hash, hash lama,
 * waktu rotasi) dan tanpa ID pembuat — DTO ditulis eksplisit (OWASP API3).
 */
export type PerangkatTtdDto = {
  id: string;
  nama: string;
  ruanganId: string | null;
  ruanganNama: string | null;
  status: StatusPasang;
  /** Aliran SSE tablet sedang tersambung ke server (hanya untuk perangkat terpasang). */
  terhubung: boolean;
  dipasangAt: string | null;
  terakhirAktifAt: string | null;
  dicabutAt: string | null;
  /** Kode pasang aktif berlaku sampai (ms epoch) — kodenya sendiri tak pernah dikirim ulang. */
  kodeSampai: number | null;
  dibuatAt: string;
};

/** Hasil "Buat kode pasang" — kode mentah HANYA di respons ini. */
export type KodePasangDto = {
  /** "XXXX-XXXX". */
  kode: string;
  sampai: number;
  /** `<origin>/ttd-siaga#kode=…` bila origin publik dikonfigurasi; selain itu null. */
  url: string | null;
  /** QR SVG data-URI dari `url`, atau null. */
  qr: string | null;
};

export type OpsiRuanganPerangkat = { id: string; nama: string; kategori: string };

export const JALUR_TTD_SIAGA = "/ttd-siaga";

/* ------------------------------------------------- permintaan TTD (Langkah 3) */

/** Status perangkat di pemilih petugas. */
export type StatusPerangkatPilih = "SIAP" | "SIBUK" | "TERPUTUS";

/** Perangkat di pemilih petugas: tanpa kredensial, tanpa siapa yang sedang memakai. */
export type PerangkatPilihDto = {
  id: string;
  nama: string;
  /** Nama ruangan lokasi (SIMGOS, baca saja); null bila tak diisi/tak terbaca. */
  lokasi: string | null;
  status: StatusPerangkatPilih;
};

/** Kenapa permintaan berakhir (selain diterima). */
export type AlasanAkhir = "pc" | "pc-pergi" | "perangkat-dicabut" | "tenggat";

/** Respons pembuatan permintaan. */
export type PermintaanDibuatDto = {
  id: string;
  /** Sisa tenggat menggambar (ms) — dihitung server, bebas selisih jam PC. */
  sisaMs: number;
  perangkat: { id: string; nama: string };
};

/** Data event `status` di aliran PC. */
export type StatusPermintaanPc = {
  status: StatusPermintaan;
  sisaMs: number;
  putaran: number;
  /** Aliran tablet tujuan sedang tersambung. */
  terhubung: boolean;
  alasan: AlasanAkhir | null;
};

/** Data event `ttd` di aliran PC dan respons "Pakai": PNG ternormalisasi server. */
export type TtdMasukDto = { png: string; sha256: string };

/** Data event `permintaan` di aliran tablet: HANYA ID + putaran (K2). */
export type PermintaanTabletDto = { id: string; putaran: number };

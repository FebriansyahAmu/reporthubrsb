/** Tipe bersama (klien & server) perangkat TTD siaga — docs/PRD_TTD_Perangkat_Siaga.md. */

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

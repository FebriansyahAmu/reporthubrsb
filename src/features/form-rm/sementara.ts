import { z } from "zod";

/**
 * ISIAN SEBELUM PASIEN TERDAFTAR (mis. triase pasien yang baru tiba di IGD).
 * Isian diisi dengan identitas sementara, berstatus "Belum tertaut", lalu
 * ditautkan ke pendaftaran (NOPEN) setelah pasien didaftarkan di SIMRS.
 * Finalisasi menunggu tautan (dokumen RM final wajib beridentitas pasien).
 * Murni & aman untuk klien.
 */

export const JK_SEMENTARA = ["", "L", "P"] as const;
export type JkSementara = (typeof JK_SEMENTARA)[number];
export const LABEL_JK_SEMENTARA: Record<JkSementara, string> = { "": "Tidak diketahui", L: "Laki-laki", P: "Perempuan" };

export const SEBUTAN_MAKS = 60;
export const UMUR_MAKS = 30;
export const CIRI_MAKS = 300;

const tanpaKontrol = (s: string) => Array.from(s, (c) => (c < " " || c === "\u007f" ? " " : c)).join("");

/** Teks satu baris: karakter kontrol jadi spasi, spasi dirapikan. */
const satuBaris = (maks: number) =>
  z
    .string()
    .max(maks * 4)
    .transform((s) => tanpaKontrol(s).replace(/\s+/g, " ").trim())
    .pipe(z.string().max(maks, `Maksimal ${maks} karakter`));

/** Identitas sementara yang dicatat sebelum pasien terdaftar (strict: kunci asing → 422). */
export const identitasSementaraSchema = z.strictObject({
  sebutan: satuBaris(SEBUTAN_MAKS).pipe(z.string().min(2, "Isi nama atau sebutan pasien (mis. Tn. X)")),
  jenisKelamin: z.enum(JK_SEMENTARA).default(""),
  perkiraanUmur: satuBaris(UMUR_MAKS).default(""),
  ciri: satuBaris(CIRI_MAKS).default(""),
});
export type IdentitasSementaraInput = z.input<typeof identitasSementaraSchema>;
export type IdentitasSementaraNilai = z.output<typeof identitasSementaraSchema>;

/** Identitas sementara pada DTO isian (+ jejak penautan). */
export type IdentitasSementara = IdentitasSementaraNilai & {
  dibuatAt: string;
  /** Diisi setelah ditautkan ke pendaftaran. */
  ditautkanAt: string | null;
  ditautkanOlehNama: string | null;
};

/** "Tn. X · L · ±40 tahun" — ringkas untuk daftar & kepala halaman. */
export function ringkasSementara(s: Pick<IdentitasSementaraNilai, "sebutan" | "jenisKelamin" | "perkiraanUmur">): string {
  return [s.sebutan, s.jenisKelamin || null, s.perkiraanUmur || null].filter(Boolean).join(" · ");
}

/** Isian belum tertaut lebih lama dari ini diberi tanda peringatan. */
export const JAM_PERINGATAN_BELUM_TERTAUT = 6;

export const terlaluLamaBelumTertaut = (dibuatAt: string, sekarang: number): boolean =>
  sekarang - new Date(dibuatAt).getTime() >= JAM_PERINGATAN_BELUM_TERTAUT * 3_600_000;

/** Alasan baku menutup isian yang pasiennya tidak pernah didaftarkan (tetap bisa ditulis bebas). */
export const ALASAN_TIDAK_TERDAFTAR = [
  "Pasien pulang sebelum didaftarkan",
  "Pasien menolak dirawat",
  "Pasien dirujuk sebelum didaftarkan",
  "Pasien meninggal sebelum didaftarkan",
  "Salah input / duplikat",
] as const;

/** Syarat FINAL tambahan untuk isian belum tertaut. */
export const SYARAT_TERTAUT = "Tautkan ke pasien yang sudah terdaftar di SIMRS";

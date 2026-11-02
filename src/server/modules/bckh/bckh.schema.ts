import { z } from "zod";
import { bersihkanTeks, selisihHari, tanggalSah } from "./bckh.aturan";
import {
  KATEGORI,
  MAKS_KEGIATAN_PER_HARI,
  MAKS_KETERANGAN,
  MAKS_RENTANG_HARI,
  MAKS_URAIAN,
  STATUS_BEKERJA,
  STATUS_HARI,
  STATUS_WAJIB_KEGIATAN,
  TARGET,
} from "./bckh.constants";

/** Tanggal kalender `YYYY-MM-DD` yang sah (tolak 2026-02-30). */
export const tanggalSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Format tanggal harus YYYY-MM-DD")
  .refine(tanggalSah, "Tanggal tidak valid");

export const bulanSchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Format bulan harus YYYY-MM");

/** ID pengguna target (`?u=`) — cuid / id akun; kosong = diri sendiri. */
export const targetSchema = z
  .string()
  .regex(/^[A-Za-z0-9_-]{1,191}$/, "ID pengguna tidak valid")
  .optional();

/** Teks bebas: buang karakter kontrol & rapatkan spasi, lalu batasi panjang. */
const teks = (maks: number, pesan: string) =>
  z.string().max(maks * 4).transform(bersihkanTeks).pipe(z.string().max(maks, pesan));
const teksWajib = (maks: number, label: string) =>
  z.string().max(maks * 4).transform(bersihkanTeks).pipe(z.string().min(1, `${label} wajib diisi`).max(maks, `${label} maksimal ${maks} karakter`));

/* ---------------------------------------------------------------- catatan */

const kegiatanSchema = z.strictObject({
  /** id kegiatan lama (diubah); tanpa id = kegiatan baru. */
  id: z.string().regex(/^[a-z0-9]{1,30}$/, "ID kegiatan tidak valid").nullish(),
  uraian: teksWajib(MAKS_URAIAN, "Uraian kegiatan"),
  kategori: z.enum(KATEGORI),
  target: z.enum(TARGET),
});

export const simpanHariSchema = z
  .strictObject({
    status: z.enum(STATUS_HARI),
    keterangan: teks(MAKS_KETERANGAN, `Keterangan maksimal ${MAKS_KETERANGAN} karakter`).default(""),
    kegiatan: z.array(kegiatanSchema).max(MAKS_KEGIATAN_PER_HARI, `Maksimal ${MAKS_KEGIATAN_PER_HARI} kegiatan per hari`),
    /** `versi` catatan yang dibaca (ISO updated_at); null = membuat catatan baru. */
    versi: z.iso.datetime().nullable(),
  })
  .refine((v) => !STATUS_WAJIB_KEGIATAN.has(v.status) || v.kegiatan.length > 0, {
    message: "Hari masuk / remote wajib berisi minimal satu kegiatan",
    path: ["kegiatan"],
  })
  .refine((v) => STATUS_BEKERJA.has(v.status) || v.kegiatan.length === 0, {
    message: "Hari tidak bekerja (Off/Cuti/Sakit/Izin/Libur) tidak berisi kegiatan",
    path: ["kegiatan"],
  })
  .refine((v) => {
    const ids = v.kegiatan.map((k) => k.id).filter(Boolean);
    return new Set(ids).size === ids.length;
  }, { message: "Kegiatan ganda dalam satu permintaan", path: ["kegiatan"] });

export type SimpanHariInput = z.infer<typeof simpanHariSchema>;

export const hapusHariSchema = z.strictObject({ versi: z.iso.datetime() });

/* ----------------------------------------------------------------- query */

export const profilQuerySchema = z.strictObject({
  tahun: z.coerce.number().int().min(2000).max(2100).optional(),
  u: targetSchema,
});

export const rentangQuerySchema = z
  .strictObject({ dari: tanggalSchema, sampai: tanggalSchema, u: targetSchema })
  .refine((v) => v.dari <= v.sampai, { message: "Tanggal awal tidak boleh melebihi tanggal akhir", path: ["dari"] })
  .refine((v) => selisihHari(v.dari, v.sampai) < MAKS_RENTANG_HARI, {
    message: `Rentang maksimal ${MAKS_RENTANG_HARI} hari`,
    path: ["sampai"],
  });

export const hariQuerySchema = z.strictObject({ u: targetSchema });

export const logQuerySchema = z.strictObject({
  sebelum: z.coerce.number().int().positive().optional(),
  u: targetSchema,
});

export const laporanQuerySchema = z.strictObject({
  bulan: bulanSchema,
  u: targetSchema,
  unduh: z.enum(["0", "1"]).optional(),
});

export const timQuerySchema = z.strictObject({ bulan: bulanSchema });

/** URLSearchParams → objek biasa (untuk strictObject: parameter tak dikenal ditolak). */
export const paramObjek = (sp: URLSearchParams) => Object.fromEntries(sp.entries());

/* ---------------------------------------------------------- profil & atur */

const NIP = (label: string) =>
  teks(40, `${label} maksimal 40 karakter`).pipe(z.string().regex(/^[0-9 .\-]*$/, `${label} hanya berisi angka, spasi, titik, atau tanda hubung`));

export const simpanProfilSchema = z.strictObject({
  namaLengkap: teksWajib(191, "Nama lengkap"),
  namaTtd: teksWajib(191, "Nama tanda tangan"),
  jabatan: teks(191, "Jabatan maksimal 191 karakter"),
  nip: NIP("NIP"),
  unit: teks(191, "Unit maksimal 191 karakter"),
  atasanNama: teks(191, "Nama atasan maksimal 191 karakter"),
  atasanNip: NIP("NIP atasan"),
});
export type SimpanProfilInput = z.infer<typeof simpanProfilSchema>;

export const simpanPengaturanSchema = z.strictObject({
  kop1: teksWajib(120, "Kop baris 1"),
  kop2: teksWajib(120, "Kop baris 2"),
  instansi1: teksWajib(120, "Instansi baris 1"),
  instansi2: teksWajib(120, "Instansi baris 2"),
  mengetahuiJabatan: teksWajib(191, "Jabatan penandatangan"),
  mengetahuiNama: teksWajib(191, "Nama penandatangan"),
  mengetahuiNip: NIP("NIP penandatangan"),
});
export type SimpanPengaturanInput = z.infer<typeof simpanPengaturanSchema>;

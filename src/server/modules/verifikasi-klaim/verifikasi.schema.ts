import { z } from "zod";
import {
  AKSI_TAHAP1,
  BATAS,
  CAKUPAN_PENJAMIN,
  KATEGORI,
  LINGKUP_TINDAK_LANJUT,
  STATUS_VERIFIKASI,
} from "./verifikasi.constants";
import { ATURAN_TAHAP1, CEK_MANUAL } from "./verifikasi.rules";

/* ------------------------------------------------------------ util tanggal */

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 86_400_000;

/** `YYYY-MM-DD` + n hari (kalender, UTC — bebas zona waktu server). */
export function tambahHari(iso: string, n: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Selisih hari kalender `b − a` (keduanya `YYYY-MM-DD…`). */
export function selisihHari(a: string, b: string): number {
  return Math.round((Date.parse(`${b.slice(0, 10)}T00:00:00Z`) - Date.parse(`${a.slice(0, 10)}T00:00:00Z`)) / DAY_MS);
}

/* ------------------------------------------------------------ query antrean */

const tanggal = z.string().regex(ISO_DATE, "format tanggal harus YYYY-MM-DD");
const KODE_ATURAN = ATURAN_TAHAP1.map((a) => a.key) as [string, ...string[]];

/** Rentang tanggal pulang + filter dasar (kategori/ruangan/cari) — dipakai antrean & loloskan massal. */
const filterDasar = {
  from: tanggal,
  to: tanggal,
  cakupan: z.enum(CAKUPAN_PENJAMIN).default("bpjs"),
  kategori: z.enum(KATEGORI).optional(),
  /** Prefiks ID ruangan SIMGOS (hierarki: 7 digit bangsal, 9 digit ruang). */
  ruangan: z.string().trim().regex(/^\d{1,9}$/, "ID ruangan tidak valid").optional(),
  q: z.string().trim().max(60).optional(),
};

type RentangShape = { from: string; to: string };
const rentangSah = <T extends z.ZodType<RentangShape>>(s: T) =>
  s
    .refine((v) => v.from <= v.to, { message: "Tanggal awal tidak boleh melebihi tanggal akhir", path: ["from"] })
    .refine((v) => selisihHari(v.from, v.to) < BATAS.RENTANG_MAKS_HARI, {
      message: `Rentang maksimal ${BATAS.RENTANG_MAKS_HARI} hari`,
      path: ["to"],
    });

/**
 * GET antrean verifikasi: rentang TANGGAL PULANG (inklusif, maks 31 hari) +
 * filter di memori + paginasi. `segar=1` = hitung ulang dari SIMGOS (lewati cache).
 */
export const antreanQuerySchema = rentangSah(
  z.object({
    ...filterDasar,
    status: z.enum(STATUS_VERIFIKASI).optional(),
    /** Kunci aturan yang GAGAL (chip masalah). */
    masalah: z.enum(KODE_ATURAN).optional(),
    lengkap: z.enum(["ya", "tidak"]).optional(),
    /** Hanya TIDAK_LENGKAP yang seluruh tindak lanjutnya selesai. */
    siap: z.enum(["1"]).optional(),
    page: z.coerce.number().int().min(1).max(10_000).default(1),
    pageSize: z.coerce.number().int().min(1).max(BATAS.HALAMAN_MAKS).default(25),
    segar: z.enum(["1"]).optional(),
  }),
);

export type AntreanQuery = z.infer<typeof antreanQuerySchema>;
export type AntreanFilter = Pick<AntreanQuery, "from" | "to" | "cakupan" | "kategori" | "ruangan" | "q">;

/** NOPEN SIMGOS: 10 digit (char). Longgar sedikit untuk format lama. */
export const nopenSchema = z.string().trim().regex(/^\d{6,20}$/, "NOPEN tidak valid");

/* ------------------------------------------------------ keputusan Tahap 1 */

const KODE_ITEM = [...KODE_ATURAN, ...CEK_MANUAL.map((c) => c.key)] as [string, ...string[]];
const KODE_MANUAL = CEK_MANUAL.map((c) => c.key) as [string, ...string[]];
const catatan = z.string().trim().max(BATAS.CATATAN_MAKS).optional();

/**
 * Keputusan verifikator RM. `versi` = versi berkas yang dilihat (null = belum
 * pernah diputuskan) — optimistic locking. `manual` = cek manual yang
 * DIKONFIRMASI; `item` = kekurangan yang dikirim sebagai tindak lanjut.
 */
export const keputusanSchema = z
  .object({
    aksi: z.enum(AKSI_TAHAP1),
    versi: z.number().int().min(1).nullable(),
    catatan,
    manual: z.array(z.enum(KODE_MANUAL)).max(KODE_MANUAL.length).default([]),
    item: z.array(z.enum(KODE_ITEM)).max(KODE_ITEM.length).default([]),
  })
  .strict()
  .refine((v) => v.aksi !== "TANDAI_TIDAK_LENGKAP" || v.item.length > 0, {
    message: "Pilih minimal satu item yang perlu dilengkapi",
    path: ["item"],
  });

export type KeputusanInput = z.infer<typeof keputusanSchema>;

/** Loloskan massal: semua berkas BELUM_DIPERIKSA yang lengkap otomatis pada filter ini. */
export const massalSchema = rentangSah(
  z
    .object({
      ...filterDasar,
      /** Verifikator menyatakan sudah memeriksa cek manual berkas-berkas ini. */
      konfirmasiManual: z.literal(true, { message: "Konfirmasi pemeriksaan manual wajib dicentang" }),
    })
    .strict(),
);

export type MassalInput = z.infer<typeof massalSchema>;

/* ------------------------------------------------------------ tindak lanjut */

export const tindakLanjutQuerySchema = z.object({
  status: z.enum(["OPEN", "SELESAI"]).default("OPEN"),
  lingkup: z.enum(LINGKUP_TINDAK_LANJUT).default("saya"),
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
  segar: z.enum(["1"]).optional(),
});

export type TindakLanjutQuery = z.infer<typeof tindakLanjutQuerySchema>;

export const idTindakLanjutSchema = z.string().trim().regex(/^[a-z0-9]{10,30}$/i, "ID tindak lanjut tidak valid");

export const selesaiManualSchema = z.object({ catatan }).strict();

import { z } from "zod";
import {
  AKSI_PAKET,
  AKSI_TAHAP1,
  AKSI_TAHAP2,
  BATAS,
  CAKUPAN_PENJAMIN,
  JENIS_ICD,
  KATEGORI,
  LINGKUP_TINDAK_LANJUT,
  STATUS_VERIFIKASI,
} from "./verifikasi.constants";
import { KODE_ATURAN_TAHAP2 } from "./koding.rules";
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
    /** Kunci aturan yang GAGAL (chip masalah) — Tahap 1, atau Tahap 2 untuk berkas pekerjaan coder. */
    masalah: z.enum([...KODE_ATURAN, ...KODE_ATURAN_TAHAP2] as [string, ...string[]]).optional(),
    lengkap: z.enum(["ya", "tidak"]).optional(),
    /** Hanya TIDAK_LENGKAP yang seluruh tindak lanjutnya selesai. */
    siap: z.enum(["1"]).optional(),
    /** Hanya Lolos RM tanpa aturan koding yang gagal. */
    koding: z.enum(["bersih"]).optional(),
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

/* ------------------------------------------------------ keputusan Tahap 2 */

/** Kode ICD ketikan: huruf besar, [A-Z0-9.] — keberadaan & validitas dicek ke master di service. */
const kodeIcd = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z0-9][A-Z0-9.]{1,9}$/, "Kode ICD tidak valid");

export const usulanSchema = z
  .object({
    diagnosa: z
      .array(z.object({ kode: kodeIcd, utama: z.boolean() }).strict())
      .min(1, "Minimal satu diagnosa")
      .max(BATAS.USULAN_MAKS),
    prosedur: z.array(z.object({ kode: kodeIcd }).strict()).max(BATAS.USULAN_MAKS).default([]),
  })
  .strict()
  .refine((u) => u.diagnosa.filter((d) => d.utama).length === 1, {
    message: "Pilih tepat satu diagnosa utama",
    path: ["diagnosa"],
  })
  .refine((u) => new Set(u.diagnosa.map((d) => d.kode)).size === u.diagnosa.length, {
    message: "Kode diagnosa ganda",
    path: ["diagnosa"],
  })
  .refine((u) => new Set(u.prosedur.map((p) => p.kode)).size === u.prosedur.length, {
    message: "Kode prosedur ganda",
    path: ["prosedur"],
  });

/**
 * Keputusan coder: ajukan koreksi (dengan usulan), loloskan klaim, atau
 * kembalikan ke Tahap 1. `versi` = versi berkas yang dilihat (optimistic locking).
 */
export const kodingKeputusanSchema = z
  .object({
    aksi: z.enum(AKSI_TAHAP2),
    versi: z.number().int().min(1).nullable(),
    catatan,
    usulan: usulanSchema.optional(),
  })
  .strict()
  .refine((v) => v.aksi !== "AJUKAN_KOREKSI" || !!v.usulan, { message: "Usulan koreksi wajib diisi", path: ["usulan"] })
  .refine((v) => v.aksi === "AJUKAN_KOREKSI" || !v.usulan, { message: "Usulan hanya untuk ajukan koreksi", path: ["usulan"] });

export type KodingKeputusanInput = z.infer<typeof kodingKeputusanSchema>;

/** GET pencarian ICD INA-CBG: kode (awalan) atau teks nama. */
export const icdQuerySchema = z.object({
  jenis: z.enum(JENIS_ICD),
  q: z.string().trim().min(1, "Ketik kode atau nama").max(60),
});

/* ------------------------------------------------------------ paket klaim */

/** Kunci komponen paket (registri `paket.sources`): tetap, atau CPPT per leg (`cppt-<nomor kunjungan>`). */
export const kunciKomponenSchema = z.string().trim().regex(/^(sep|resume-medis|spri|cppt|cppt-\d{6,30})$/, "Komponen tidak dikenal");
export const idLampiranSchema = z.string().trim().regex(/^[a-z0-9]{10,30}$/i, "ID sisipan tidak valid");

const itemSusunanSchema = z.discriminatedUnion("tipe", [
  z.object({ tipe: z.literal("komponen"), key: kunciKomponenSchema }).strict(),
  z.object({ tipe: z.literal("lampiran"), id: idLampiranSchema }).strict(),
]);

/**
 * Gabung paket: susunan AKTIF berurutan (komponen SIMGOS + sisipan). `versi` =
 * versi berkas yang dilihat. `segar` = ambil ulang dari SIMRS walau susunan
 * sama dengan paket draf terakhir (tanpa `segar`, paket yang sama dipakai ulang).
 */
export const gabungSchema = z
  .object({
    versi: z.number().int().min(1),
    susunan: z
      .array(itemSusunanSchema)
      .min(1, "Pilih minimal satu dokumen untuk digabung")
      .max(BATAS.LAMPIRAN_MAKS + 40),
    segar: z.boolean().default(false),
  })
  .strict()
  .refine((v) => new Set(v.susunan.map((i) => (i.tipe === "komponen" ? `k:${i.key}` : `l:${i.id}`))).size === v.susunan.length, {
    message: "Dokumen ganda dalam susunan",
    path: ["susunan"],
  });

export type GabungInput = z.infer<typeof gabungSchema>;

/** Kunci FINAL (paket draf versi `paketVersi`) / buka kunci (alasan wajib). */
export const paketKeputusanSchema = z
  .object({
    aksi: z.enum(AKSI_PAKET),
    versi: z.number().int().min(1),
    paketVersi: z.number().int().min(1).optional(),
    catatan,
  })
  .strict()
  .refine((v) => v.aksi !== "KUNCI_FINAL" || v.paketVersi !== undefined, {
    message: "Versi paket yang dikunci wajib dikirim",
    path: ["paketVersi"],
  });

export type PaketKeputusanInput = z.infer<typeof paketKeputusanSchema>;

export const keteranganLampiranSchema = z.string().trim().max(255, "Keterangan maksimal 255 karakter").optional();

/** Mode unduh PDF paket: lihat (pratinjau) · cetak · unduh — dua terakhir tercatat di audit. */
export const modePdfSchema = z.enum(["lihat", "cetak", "unduh"]).default("lihat");

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

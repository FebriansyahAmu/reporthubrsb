import { z } from "zod";

/**
 * Skema Master Barang (unit aset). 1 baris = 1 unit fisik dengan `kodeBarang`
 * unik (tag permanen). Dipakai API route untuk validasi input & query.
 */

/* --------------------------------------------------------------- status aset */

/** Status administratif aset (BEDA dari kondisi fisik Baik/RR/RB). */
export const STATUS_ASET = ["AKTIF", "PERBAIKAN", "DIPINJAM", "DIHAPUS"] as const;
export type StatusAset = (typeof STATUS_ASET)[number];

export const STATUS_ASET_LABEL: Record<StatusAset, string> = {
  AKTIF: "Aktif",
  PERBAIKAN: "Perbaikan",
  DIPINJAM: "Dipinjam",
  DIHAPUS: "Dihapus",
};

/** Tone badge per status (selaras token desain; tidak mengandalkan warna saja). */
export const STATUS_ASET_TONE: Record<StatusAset, "success" | "warning" | "accent" | "neutral"> = {
  AKTIF: "success",
  PERBAIKAN: "warning",
  DIPINJAM: "accent",
  DIHAPUS: "neutral",
};

export function isStatusAset(v: string): v is StatusAset {
  return (STATUS_ASET as readonly string[]).includes(v);
}

/* ---------------------------------------------------------------- foto unit */

/**
 * Batas foto unit aset. Foto HP sebesar apa pun (≤ `masukanMaks`, mis. 20 MB /
 * 50 MP) dikompres dulu di browser — sisi terpanjang ≤ `sisiMaks` (cukup tajam
 * untuk membaca label/nomor seri saat di-zoom), WebP/JPEG — lalu foto +
 * miniatur diunggah; server menegakkan ukuran & jenis.
 */
export const FOTO_BARANG = {
  /** Berkas asli yang boleh dipilih pengguna (sebelum dikompres di browser). */
  masukanMaks: 30 * 1024 * 1024,
  /** Foto utama hasil kompres yang diterima server. */
  ukuranMaks: 5 * 1024 * 1024,
  /** Target ukuran foto hasil kompres; di atasnya mutu diturunkan bertahap. */
  ukuranTarget: 1024 * 1024,
  /** Miniatur (daftar barang). */
  thumbMaks: 512 * 1024,
  sisiMaks: 2560,
  sisiThumb: 360,
} as const;

/* --------------------------------------------------------------- helpers zod */

/** String opsional: "" / whitespace → undefined. */
const optStr = (max: number) =>
  z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
    z.string().trim().max(max).optional(),
  );

/** ID FK opsional (cuid) — "" → undefined. */
const optId = z.preprocess(
  (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
  z.string().trim().max(40).optional(),
);

/** Angka opsional dari input string/number — "" → undefined. */
const optNum = (opts: { min?: number; max?: number; int?: boolean }) =>
  z.preprocess((v) => {
    if (v == null || (typeof v === "string" && v.trim() === "")) return undefined;
    if (typeof v === "string") {
      const n = Number(v.replace(/[^\d.-]/g, ""));
      return Number.isNaN(n) ? v : n;
    }
    return v;
  }, (() => {
    let s = z.number();
    if (opts.int) s = s.int();
    if (opts.min != null) s = s.min(opts.min);
    if (opts.max != null) s = s.max(opts.max);
    return s.optional();
  })());

/** Tanggal "YYYY-MM-DD" opsional. */
const optYmd = z.preprocess(
  (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
  z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Tanggal harus format YYYY-MM-DD")
    .optional(),
);

/* ------------------------------------------------------------------- schemas */

/** Field bersama create & update (tanpa kodeBarang — kode itu permanen). */
const barangCore = {
  nama: z.string().trim().min(1, "Nama barang wajib diisi").max(160),
  register: optNum({ int: true, min: 0, max: 999999999 }),
  merk: optStr(120),
  nomorSeri: optStr(120),
  kategoriId: optId,
  sumberAnggaranId: optId,
  satuanId: optId,
  kondisiId: optId,
  ruanganId: z.string().trim().min(1, "Ruangan wajib dipilih").max(40),
  tahunPerolehan: optNum({ int: true, min: 1900, max: 2100 }),
  tglPerolehan: optYmd,
  harga: optNum({ min: 0, max: 999999999999 }),
  statusAset: z.enum(STATUS_ASET).default("AKTIF"),
  keterangan: optStr(2000),
};

/** Buat barang baru. `kodeBarang` opsional → auto `<PREFIX>-<urut>` bila kosong. */
export const barangCreateSchema = z.object({
  kodeBarang: z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
    z
      .string()
      .trim()
      .max(40)
      .regex(/^[A-Za-z0-9.\-/]+$/, "Kode hanya huruf/angka/titik/strip/garis miring")
      .optional(),
  ),
  ...barangCore,
});
export type BarangCreateInput = z.infer<typeof barangCreateSchema>;

/** Perbarui barang. Kode barang TIDAK bisa diubah (tag permanen). */
export const barangUpdateSchema = z.object(barangCore);
export type BarangUpdateInput = z.infer<typeof barangUpdateSchema>;

/** Query daftar barang (filter + paginasi + urut). */
export const barangQuerySchema = z.object({
  search: optStr(120),
  ruanganId: optId,
  kategoriId: optId,
  kondisiId: optId,
  sumberAnggaranId: optId,
  status: z.enum(STATUS_ASET).optional(),
  tahun: optNum({ int: true, min: 1900, max: 2100 }),
  sort: z.enum(["terbaru", "kode", "nama", "tahun", "harga"]).default("terbaru"),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(20),
});
export type BarangQuery = z.infer<typeof barangQuerySchema>;

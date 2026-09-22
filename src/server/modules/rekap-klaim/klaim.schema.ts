import { z } from "zod";

/**
 * Skema & konstanta modul Rekap Klaim BPJS (INA-CBG's & Rujukan Ambulans).
 * Enum disimpan sebagai String di DB, divalidasi di sini. Uang = rupiah penuh
 * (BigInt di DB; di app diproses sebagai number lalu dikonversi ke BigInt).
 */

/* ------------------------------------------------------------- jenis klaim */

export const JENIS_KLAIM = ["REGULER", "PENDING", "SUSULAN"] as const;
export type JenisKlaim = (typeof JENIS_KLAIM)[number];
export const JENIS_KLAIM_LABEL: Record<JenisKlaim, string> = {
  REGULER: "Reguler",
  PENDING: "Pending",
  SUSULAN: "Susulan",
};
export const JENIS_KLAIM_TONE: Record<JenisKlaim, "success" | "warning" | "accent"> = {
  REGULER: "success",
  PENDING: "warning",
  SUSULAN: "accent",
};

/* ----------------------------------------------------------- jenis layanan */

export const JENIS_LAYANAN = ["RITL", "RJTL"] as const;
export type JenisLayanan = (typeof JENIS_LAYANAN)[number];
export const JENIS_LAYANAN_LABEL: Record<JenisLayanan, string> = {
  RITL: "Rawat Inap (RITL)",
  RJTL: "Rawat Jalan (RJTL)",
};

/* -------------------------------------------------------------- kategori */

export const KATEGORI_KLAIM = ["INA_CBGS", "RUJUKAN_AMBULANS"] as const;
export type KategoriKlaim = (typeof KATEGORI_KLAIM)[number];
export const KATEGORI_KLAIM_LABEL: Record<KategoriKlaim, string> = {
  INA_CBGS: "INA-CBG's",
  RUJUKAN_AMBULANS: "Rujukan Ambulans",
};

/* ---------------------------------------------------------------- status */

export const STATUS_KLAIM = ["SUBMITTED", "APPROVED", "RECEIVED", "PARTIAL", "EXPIRED", "REJECTED"] as const;
export type StatusKlaim = (typeof STATUS_KLAIM)[number];
export const STATUS_KLAIM_LABEL: Record<StatusKlaim, string> = {
  SUBMITTED: "Diajukan",
  APPROVED: "Disetujui",
  RECEIVED: "Diterima",
  PARTIAL: "Diterima Sebagian",
  EXPIRED: "Kedaluwarsa",
  REJECTED: "Ditolak",
};
export const STATUS_KLAIM_TONE: Record<StatusKlaim, "neutral" | "brand" | "success" | "warning" | "danger"> = {
  SUBMITTED: "neutral",
  APPROVED: "brand",
  RECEIVED: "success",
  PARTIAL: "warning",
  EXPIRED: "danger",
  REJECTED: "danger",
};

/* ------------------------------------------------------------ jenis potongan */

export const POTONGAN_JENIS = ["AAK", "KELEBIHAN_BAYAR", "VPK", "POTONGAN_BERKALA", "PENGEMBALIAN"] as const;
export type PotonganJenis = (typeof POTONGAN_JENIS)[number];
export const POTONGAN_JENIS_LABEL: Record<PotonganJenis, string> = {
  AAK: "AAK (Ambulatory Adjustment Klaster)",
  KELEBIHAN_BAYAR: "Kelebihan Bayar",
  VPK: "VPK (Verifikasi Penjaminan Klaim)",
  POTONGAN_BERKALA: "Potongan Bertahap / Cicilan",
  PENGEMBALIAN: "Pengembalian Dana",
};

/* ------------------------------------------------------------------ bulan */

export const BULAN_LABEL = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
] as const;

/* --------------------------------------------------------------- helpers zod */

/** String opsional: "" / whitespace → undefined. */
const optStr = (max: number) =>
  z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
    z.string().trim().max(max).optional(),
  );

/** Rupiah (int ≥ 0) dari string/number — buang "Rp", titik ribuan, spasi. */
const rupiah = z.preprocess((v) => {
  if (v == null || (typeof v === "string" && v.trim() === "")) return undefined;
  if (typeof v === "string") {
    const n = Number(v.replace(/[^\d-]/g, ""));
    return Number.isNaN(n) ? v : n;
  }
  return v;
}, z.number().int().min(0));

/** Rupiah opsional. */
const optRupiah = z.preprocess((v) => {
  if (v == null || (typeof v === "string" && v.trim() === "")) return undefined;
  if (typeof v === "string") {
    const n = Number(v.replace(/[^\d-]/g, ""));
    return Number.isNaN(n) ? v : n;
  }
  return v;
}, z.number().int().min(0).optional());

/** Bilangan bulat opsional (mis. jumlah kasus, cicilan). */
const optInt = (min: number, max: number) =>
  z.preprocess((v) => {
    if (v == null || (typeof v === "string" && v.trim() === "")) return undefined;
    if (typeof v === "string") {
      const n = Number(v.replace(/[^\d-]/g, ""));
      return Number.isNaN(n) ? v : n;
    }
    return v;
  }, z.number().int().min(min).max(max).optional());

/** Tanggal opsional ISO (YYYY-MM-DD) → Date | undefined. */
const optDate = z.preprocess(
  (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
  z.coerce.date().optional(),
);

const currentYear = new Date().getFullYear();

/* ----------------------------------------------------------- skema klaim */

export const klaimCreateSchema = z.object({
  nomorKlaim: optStr(60),
  jenisKlaim: z.enum(JENIS_KLAIM),
  jenisLayanan: z.enum(JENIS_LAYANAN),
  kategori: z.enum(KATEGORI_KLAIM).default("INA_CBGS"),
  bulanPelayanan: z.coerce.number().int().min(1).max(12),
  tahunPelayanan: z.coerce.number().int().min(2015).max(currentYear + 1),
  jumlah: rupiah,
  jumlahDiajukan: optRupiah,
  jumlahKasus: optInt(0, 100000),
  tglMasukRekening: optDate,
  status: z.enum(STATUS_KLAIM).default("SUBMITTED"),
  refBa: optStr(100),
  catatan: optStr(2000),
});
export type KlaimCreateInput = z.infer<typeof klaimCreateSchema>;

/** Update = semua field opsional (partial), minimal satu terkirim. */
export const klaimUpdateSchema = klaimCreateSchema.partial();
export type KlaimUpdateInput = z.infer<typeof klaimUpdateSchema>;

/* --------------------------------------------------------- skema potongan */

export const potonganCreateSchema = z.object({
  klaimId: z.string().trim().min(1).max(40),
  jenis: z.enum(POTONGAN_JENIS),
  jumlah: rupiah,
  cicilanKe: optInt(1, 100),
  totalCicilan: optInt(1, 100),
  refBa: optStr(100),
  deskripsi: optStr(2000),
  tglTerapkan: optDate,
});
export type PotonganCreateInput = z.infer<typeof potonganCreateSchema>;

export const potonganUpdateSchema = potonganCreateSchema.partial().omit({ klaimId: true });
export type PotonganUpdateInput = z.infer<typeof potonganUpdateSchema>;

/* --------------------------------------------------------------- query */

export const klaimListQuerySchema = z.object({
  tahun: z.coerce.number().int().min(2015).max(currentYear + 1).optional(),
  bulan: z.coerce.number().int().min(1).max(12).optional(),
  jenisKlaim: z.enum(JENIS_KLAIM).optional(),
  jenisLayanan: z.enum(JENIS_LAYANAN).optional(),
  kategori: z.enum(KATEGORI_KLAIM).optional(),
  status: z.enum(STATUS_KLAIM).optional(),
  q: z.string().trim().max(120).optional(),
});
export type KlaimListQuery = z.infer<typeof klaimListQuerySchema>;

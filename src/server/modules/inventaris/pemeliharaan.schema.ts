import { z } from "zod";

/**
 * Skema Pemeliharaan/Pengecekan aset (tabel inv_pemeliharaan). Satu baris = satu
 * kegiatan perawatan/inspeksi pada satu unit barang.
 */

/* ------------------------------------------------------------------- konstanta */

export const JENIS_PEMELIHARAAN = ["RUTIN", "PERBAIKAN", "KALIBRASI", "INSPEKSI"] as const;
export type JenisPemeliharaan = (typeof JENIS_PEMELIHARAAN)[number];
export const JENIS_LABEL: Record<JenisPemeliharaan, string> = {
  RUTIN: "Perawatan Rutin",
  PERBAIKAN: "Perbaikan",
  KALIBRASI: "Kalibrasi",
  INSPEKSI: "Inspeksi/Pengecekan",
};

/** Hasil penilaian setelah kegiatan. */
export const HASIL_PEMELIHARAAN = ["BAIK", "PERLU_PERBAIKAN", "RUSAK"] as const;
export type HasilPemeliharaan = (typeof HASIL_PEMELIHARAAN)[number];
export const HASIL_LABEL: Record<HasilPemeliharaan, string> = {
  BAIK: "Baik / Normal",
  PERLU_PERBAIKAN: "Perlu Perbaikan",
  RUSAK: "Rusak",
};
export const HASIL_TONE: Record<HasilPemeliharaan, "success" | "warning" | "danger"> = {
  BAIK: "success",
  PERLU_PERBAIKAN: "warning",
  RUSAK: "danger",
};

/** Status jatuh tempo pemeliharaan berikutnya (dihitung server). */
export const DUE_STATUS = ["overdue", "soon", "scheduled", "none"] as const;
export type DueStatus = (typeof DUE_STATUS)[number];
export const DUE_LABEL: Record<DueStatus, string> = {
  overdue: "Jatuh tempo",
  soon: "Segera",
  scheduled: "Terjadwal",
  none: "Belum dijadwalkan",
};
export const DUE_TONE: Record<DueStatus, "danger" | "warning" | "success" | "neutral"> = {
  overdue: "danger",
  soon: "warning",
  scheduled: "success",
  none: "neutral",
};

/** Ambang "segera jatuh tempo" (hari). */
export const SOON_DAYS = 30;

/* --------------------------------------------------------------- helper zod */

const optStr = (max: number) =>
  z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
    z.string().trim().max(max).optional(),
  );
const optId = z.preprocess(
  (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
  z.string().trim().max(40).optional(),
);
const optMoney = z.preprocess((v) => {
  if (v == null || (typeof v === "string" && v.trim() === "")) return undefined;
  if (typeof v === "string") {
    const n = Number(v.replace(/[^\d]/g, ""));
    return Number.isNaN(n) ? v : n;
  }
  return v;
}, z.number().min(0).max(999999999999).optional());
const ymd = (msg: string) => z.string().regex(/^\d{4}-\d{2}-\d{2}$/, msg);
const optYmd = z.preprocess(
  (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
  z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Tanggal harus YYYY-MM-DD").optional(),
);

/* ------------------------------------------------------------------- schema */

export const pemeliharaanCreateSchema = z.object({
  tanggal: ymd("Tanggal kegiatan wajib diisi (YYYY-MM-DD)"),
  jenis: z.enum(JENIS_PEMELIHARAAN).default("RUTIN"),
  hasil: z.enum(HASIL_PEMELIHARAAN).default("BAIK"),
  kondisiSesudahId: optId,
  petugas: optStr(120),
  biaya: optMoney,
  catatan: optStr(2000),
  jatuhTempoBerikutnya: optYmd,
});
export type PemeliharaanCreateInput = z.infer<typeof pemeliharaanCreateSchema>;

export const pemeliharaanUpdateSchema = pemeliharaanCreateSchema;
export type PemeliharaanUpdateInput = z.infer<typeof pemeliharaanUpdateSchema>;

export const pemeliharaanQuerySchema = z.object({
  search: optStr(120),
  ruanganId: optId,
  status: z.enum(DUE_STATUS).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(20),
});
export type PemeliharaanQuery = z.infer<typeof pemeliharaanQuerySchema>;

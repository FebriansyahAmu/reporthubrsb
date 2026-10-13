import { z } from "zod";
import { ValidationError } from "@/server/lib/errors";
import { MAKS_HARI_KE_DEPAN, RENTANG_MAKS_HARI, STATUS_AUDIT_KEYS, TEMUAN_KEYS, type StatusAudit, type TemuanKey } from "./surat-kontrol.constants";
import { tambahHari } from "./surat-kontrol.filter";

const isoTanggal = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Format tanggal YYYY-MM-DD")
  .refine((v) => !Number.isNaN(Date.parse(`${v}T00:00:00Z`)) && new Date(`${v}T00:00:00Z`).toISOString().startsWith(v), "Tanggal tidak valid");

export const suratKontrolQuerySchema = z.object({
  from: isoTanggal.optional(),
  to: isoTanggal.optional(),
  /** 2 = Surat Kontrol (bawaan), 1 = SPRI, semua. */
  jenis: z.enum(["2", "1", "semua"]).default("2"),
  /** "1" = abaikan cache BPJS (dibatasi tiap 30 dtk per rentang). */
  segar: z.literal("1").optional(),
});
export type SuratKontrolQuery = z.infer<typeof suratKontrolQuerySchema>;

/** Filter tampilan yang ikut ke ekspor (agar isi berkas = layar). */
export const eksporQuerySchema = suratKontrolQuerySchema.omit({ segar: true }).extend({
  status: z.enum(STATUS_AUDIT_KEYS as [StatusAudit, ...StatusAudit[]]).optional(),
  temuan: z.enum(TEMUAN_KEYS as [TemuanKey, ...TemuanKey[]]).optional(),
  poli: z.string().trim().max(120).optional(),
  tanggal: isoTanggal.optional(),
  q: z.string().trim().max(80).optional(),
});
export type EksporQuery = z.infer<typeof eksporQuerySchema>;

/** Rentang bawaan = bulan berjalan (WITA); validasi batas lebar & tanggal depan. */
export function tentukanRentang(q: { from?: string; to?: string }, hariIni: string): { from: string; to: string } {
  const awalBulan = `${hariIni.slice(0, 8)}01`;
  // Hari ke-0 bulan berikutnya = hari terakhir bulan ini.
  const akhirBulan = new Date(Date.UTC(Number(hariIni.slice(0, 4)), Number(hariIni.slice(5, 7)), 0)).toISOString().slice(0, 10);
  let from = q.from ?? (q.to ? tambahHari(q.to, -(RENTANG_MAKS_HARI - 1)) : awalBulan);
  let to = q.to ?? (q.from ? tambahHari(q.from, RENTANG_MAKS_HARI - 1) : akhirBulan);
  if (from > to) [from, to] = [to, from];
  const batasDepan = tambahHari(hariIni, MAKS_HARI_KE_DEPAN);
  if (to > batasDepan) to = batasDepan;
  if (from > to) from = to;
  if (tambahHari(from, RENTANG_MAKS_HARI - 1) < to) {
    throw new ValidationError({ formErrors: [], fieldErrors: { to: [`Rentang maksimal ${RENTANG_MAKS_HARI} hari`] } });
  }
  return { from, to };
}

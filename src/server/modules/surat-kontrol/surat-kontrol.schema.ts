import { z } from "zod";
import { ValidationError } from "@/server/lib/errors";
import { MAKS_HARI_KE_DEPAN, RENTANG_MAKS_HARI, STATUS_AUDIT_KEYS, TEMUAN_KEYS, type StatusAudit, type TemuanKey } from "./surat-kontrol.constants";
import { tambahHari } from "./surat-kontrol.filter";
import {
  LAYANAN_PULANG_KEYS,
  RENTANG_PULANG_MAKS_HARI,
  STATUS_PULANG_KEYS,
  type LayananPulang,
  type StatusPulang,
} from "./surat-kontrol.pulang.constants";

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

/** "Terbit saat pulang": rentang TANGGAL PULANG (tidak boleh melewati hari ini). */
export const pulangQuerySchema = z.object({
  from: isoTanggal.optional(),
  to: isoTanggal.optional(),
  /** "1" = segarkan tanggal terbit dari webservice BPJS (dibatasi tiap 30 dtk per rentang). */
  segar: z.literal("1").optional(),
});
export type PulangQuery = z.infer<typeof pulangQuerySchema>;

export const eksporPulangQuerySchema = pulangQuerySchema.omit({ segar: true }).extend({
  layanan: z.enum(LAYANAN_PULANG_KEYS as [LayananPulang, ...LayananPulang[]]).optional(),
  status: z.enum(STATUS_PULANG_KEYS as [StatusPulang, ...StatusPulang[]]).optional(),
  ruangan: z.string().trim().max(120).optional(),
  tanggal: isoTanggal.optional(),
  q: z.string().trim().max(80).optional(),
});
export type EksporPulangQuery = z.infer<typeof eksporPulangQuerySchema>;

/** Rentang tanggal pulang bawaan = awal bulan s.d. hari ini (WITA); maks. 31 hari, tak melewati hari ini. */
export function tentukanRentangPulang(q: { from?: string; to?: string }, hariIni: string): { from: string; to: string } {
  const lebar = RENTANG_PULANG_MAKS_HARI - 1;
  let to = q.to ?? (q.from ? tambahHari(q.from, lebar) : hariIni);
  let from = q.from ?? (q.to ? tambahHari(to, -lebar) : `${hariIni.slice(0, 8)}01`);
  if (from > to) [from, to] = [to, from];
  if (to > hariIni) to = hariIni;
  if (from > to) from = to;
  if (tambahHari(from, lebar) < to) {
    throw new ValidationError({ formErrors: [], fieldErrors: { to: [`Rentang maksimal ${RENTANG_PULANG_MAKS_HARI} hari`] } });
  }
  return { from, to };
}

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

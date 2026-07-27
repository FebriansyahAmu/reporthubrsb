import { z } from "zod";

/** Query monitoring antrean BPJS: tanggal wajib + filter opsional + paginasi. */
export const antreanQuerySchema = z.object({
  tanggal: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "format tanggal harus YYYY-MM-DD"),
  search: z.string().trim().max(60).optional(),
  poli: z.string().trim().max(60).optional(), // nama poli atau "ALL"
  status: z.enum(["BERLANGSUNG", "TERLAMBAT", "SELESAI", "ALL"]).optional(),
  tahap: z.coerce.number().int().min(1).max(7).optional(),
  page: z.coerce.number().int().min(1).max(10000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(10),
});

export type AntreanQuery = z.infer<typeof antreanQuerySchema>;

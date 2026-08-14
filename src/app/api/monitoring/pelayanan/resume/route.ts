import { NextRequest } from "next/server";
import { resumeQuerySchema } from "@/server/modules/pelayanan/pelayanan.schema";
import { getResumeKelengkapan } from "@/server/modules/pelayanan/pelayanan.service";
import { authorize } from "@/server/rbac/guard";
import { ok, fail } from "@/server/lib/http";

export const runtime = "nodejs";

/**
 * GET /api/monitoring/pelayanan/resume?from=YYYY-MM-DD&to=YYYY-MM-DD[&ruangan&kategori&status&search&page&pageSize]
 * Kelengkapan resume medis untuk kunjungan final pada rentang tanggal.
 */
export async function GET(req: NextRequest) {
  try {
    await authorize("monitoring.pelayanan", "view");
    const sp = Object.fromEntries(req.nextUrl.searchParams);
    const input = resumeQuerySchema.parse(sp);
    const data = await getResumeKelengkapan(input);
    return ok(data);
  } catch (err) {
    return fail(err);
  }
}

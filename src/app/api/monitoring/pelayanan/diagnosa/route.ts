import { NextRequest } from "next/server";
import { diagnosaQuerySchema } from "@/server/modules/pelayanan/pelayanan.schema";
import { getDiagnosaKelengkapan } from "@/server/modules/pelayanan/pelayanan.service";
import { authorize } from "@/server/rbac/guard";
import { ok, fail } from "@/server/lib/http";

export const runtime = "nodejs";

/**
 * GET /api/monitoring/pelayanan/diagnosa?from=YYYY-MM-DD&to=YYYY-MM-DD[&ruangan&kategori&status&search&page&pageSize]
 * Kelengkapan diagnosa (ICD) untuk kunjungan final pada rentang tanggal.
 */
export async function GET(req: NextRequest) {
  try {
    await authorize("monitoring.pelayanan", "view");
    const sp = Object.fromEntries(req.nextUrl.searchParams);
    const input = diagnosaQuerySchema.parse(sp);
    const data = await getDiagnosaKelengkapan(input);
    return ok(data);
  } catch (err) {
    return fail(err);
  }
}

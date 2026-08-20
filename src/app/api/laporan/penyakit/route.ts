import { NextRequest } from "next/server";
import { penyakitQuerySchema } from "@/server/modules/penyakit/penyakit.schema";
import { getPenyakitTerbanyak } from "@/server/modules/penyakit/penyakit.service";
import { authorize } from "@/server/rbac/guard";
import { ok, fail } from "@/server/lib/http";

export const runtime = "nodejs";

/**
 * GET /api/laporan/penyakit?from&to[&jenis&caraBayar&utama&metric]
 * 10 penyakit terbanyak (ICD-10) pada periode + filter. Read-only SIMGOS.
 */
export async function GET(req: NextRequest) {
  try {
    await authorize("laporan", "view");
    const sp = Object.fromEntries(req.nextUrl.searchParams);
    const input = penyakitQuerySchema.parse(sp);
    const data = await getPenyakitTerbanyak(input);
    return ok(data);
  } catch (err) {
    return fail(err);
  }
}

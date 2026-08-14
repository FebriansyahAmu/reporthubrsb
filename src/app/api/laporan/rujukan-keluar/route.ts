import { NextRequest } from "next/server";
import { rujukanKeluarQuerySchema } from "@/server/modules/rujukan/rujukan.schema";
import { getRujukanKeluar } from "@/server/modules/rujukan/rujukan.service";
import { authorize } from "@/server/rbac/guard";
import { ok, fail } from "@/server/lib/http";

export const runtime = "nodejs";

/**
 * GET /api/laporan/rujukan-keluar[?from&to&jnsPelayanan&search&page&pageSize]
 * Daftar rujukan keluar BPJS (default 10 terakhir) + nama pasien hasil join noSep.
 */
export async function GET(req: NextRequest) {
  try {
    await authorize("laporan", "view");
    const sp = Object.fromEntries(req.nextUrl.searchParams);
    const input = rujukanKeluarQuerySchema.parse(sp);
    const data = await getRujukanKeluar(input);
    return ok(data);
  } catch (err) {
    return fail(err);
  }
}

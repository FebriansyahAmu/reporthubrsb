import { NextRequest } from "next/server";
import { rl41QuerySchema } from "@/server/modules/rl41/rl41.schema";
import { getRl41 } from "@/server/modules/rl41/rl41.service";
import { authorize } from "@/server/rbac/guard";
import { ok, fail } from "@/server/lib/http";

export const runtime = "nodejs";

/**
 * GET /api/laporan/rl41?from&to
 * RL 4.1 — Data Morbiditas & Mortalitas Pasien Rawat Inap pada periode.
 * Read-only SIMGOS (di-port dari SP LaporanRL41Revisi).
 */
export async function GET(req: NextRequest) {
  try {
    await authorize("laporan", "view");
    const input = rl41QuerySchema.parse(Object.fromEntries(req.nextUrl.searchParams));
    const data = await getRl41(input);
    return ok(data);
  } catch (err) {
    return fail(err);
  }
}

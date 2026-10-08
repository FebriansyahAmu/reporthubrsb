import { NextRequest } from "next/server";
import { rl32QuerySchema } from "@/server/modules/rl32/rl32.schema";
import { getRl32 } from "@/server/modules/rl32/rl32.service";
import { authorize } from "@/server/rbac/guard";
import { ok, fail, tanpaCache } from "@/server/lib/http";

export const runtime = "nodejs";

/**
 * GET /api/laporan/rl32?from&to
 * RL 3.2 (SIRS 6) Rawat Inap per ruangan pada periode. Read-only SIMGOS
 * (port SP LaporanRL32RuanganRevisi) + pemetaan ruangan dari DB aplikasi.
 */
export async function GET(req: NextRequest) {
  try {
    await authorize("laporan", "view");
    const input = rl32QuerySchema.parse(Object.fromEntries(req.nextUrl.searchParams));
    return tanpaCache(ok(await getRl32(input)));
  } catch (err) {
    return fail(err);
  }
}

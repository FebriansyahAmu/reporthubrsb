import { NextRequest } from "next/server";
import { rl35QuerySchema } from "@/server/modules/rl35/rl35.schema";
import { getRl35 } from "@/server/modules/rl35/rl35.service";
import { authorize } from "@/server/rbac/guard";
import { ok, fail, tanpaCache } from "@/server/lib/http";

export const runtime = "nodejs";

/**
 * GET /api/laporan/rl35?from&to
 * RL 3.5 (SIRS 6) Rekapitulasi Kunjungan pada periode. Read-only SIMGOS
 * (port SP LaporanRL35Revisi) + pemetaan ruangan dari DB aplikasi.
 */
export async function GET(req: NextRequest) {
  try {
    await authorize("laporan", "view");
    const input = rl35QuerySchema.parse(Object.fromEntries(req.nextUrl.searchParams));
    return tanpaCache(ok(await getRl35(input)));
  } catch (err) {
    return fail(err);
  }
}

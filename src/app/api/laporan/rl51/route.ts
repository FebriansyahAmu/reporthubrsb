import { NextRequest } from "next/server";
import { rl51QuerySchema } from "@/server/modules/rl51/rl51.schema";
import { getRl51 } from "@/server/modules/rl51/rl51.service";
import { authorize } from "@/server/rbac/guard";
import { ok, fail } from "@/server/lib/http";

export const runtime = "nodejs";

/**
 * GET /api/laporan/rl51?from&to
 * RL 5.1 — Data Morbiditas Pasien Rawat Jalan pada periode.
 * Read-only SIMGOS (di-port dari SP LaporanRL51Revisi, kelompok umur diperbaiki).
 */
export async function GET(req: NextRequest) {
  try {
    await authorize("laporan", "view");
    const input = rl51QuerySchema.parse(Object.fromEntries(req.nextUrl.searchParams));
    const data = await getRl51(input);
    return ok(data);
  } catch (err) {
    return fail(err);
  }
}

import { NextRequest } from "next/server";
import { pengunjungQuerySchema } from "@/server/modules/pengunjung/pengunjung.schema";
import { getPengunjung } from "@/server/modules/pengunjung/pengunjung.service";
import { authorize } from "@/server/rbac/guard";
import { ok, fail } from "@/server/lib/http";

export const runtime = "nodejs";

/**
 * GET /api/laporan/pengunjung?from&to[&jenis&ruangan&caraBayar&tindak&page&pageSize]
 * Daftar pengunjung per pasien (berpaginasi) + ringkasan. Read-only SIMGOS.
 */
export async function GET(req: NextRequest) {
  try {
    await authorize("laporan", "view");
    const input = pengunjungQuerySchema.parse(Object.fromEntries(req.nextUrl.searchParams));
    const data = await getPengunjung(input);
    return ok(data);
  } catch (err) {
    return fail(err);
  }
}

import { NextRequest } from "next/server";
import { belumFinalQuerySchema } from "@/server/modules/pelayanan/pelayanan.schema";
import { getBelumFinal } from "@/server/modules/pelayanan/pelayanan.service";
import { ok, fail } from "@/server/lib/http";

export const runtime = "nodejs";

/**
 * GET /api/monitoring/pelayanan/belum-final[?ruangan&kategori&bucket&search&page&pageSize]
 * Kunjungan belum difinalkan (KELUAR NULL, 90 hari terakhir) + umur tunggakan.
 */
export async function GET(req: NextRequest) {
  try {
    const sp = Object.fromEntries(req.nextUrl.searchParams);
    const input = belumFinalQuerySchema.parse(sp);
    const data = await getBelumFinal(input);
    return ok(data);
  } catch (err) {
    return fail(err);
  }
}

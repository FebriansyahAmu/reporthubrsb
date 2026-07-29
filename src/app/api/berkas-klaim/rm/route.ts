import { NextRequest } from "next/server";
import { berkasKlaimQuerySchema } from "@/server/modules/berkas-klaim/berkas-klaim.schema";
import { getBerkasKlaimRM } from "@/server/modules/berkas-klaim/berkas-klaim.service";
import { ok, fail } from "@/server/lib/http";

export const runtime = "nodejs";

/**
 * GET /api/berkas-klaim/rm?from=YYYY-MM-DD&to=YYYY-MM-DD[&ruangan&kategori&search&page&pageSize]
 * Daftar pasien FINAL (siap berkas klaim) pada rentang tanggal.
 */
export async function GET(req: NextRequest) {
  try {
    const sp = Object.fromEntries(req.nextUrl.searchParams);
    const input = berkasKlaimQuerySchema.parse(sp);
    const data = await getBerkasKlaimRM(input);
    return ok(data);
  } catch (err) {
    return fail(err);
  }
}

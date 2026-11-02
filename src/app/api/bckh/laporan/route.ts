import { NextRequest } from "next/server";
import { aksesBaca } from "@/server/modules/bckh/bckh.akses";
import { laporanBulan } from "@/server/modules/bckh/bckh.laporan";
import { laporanQuerySchema, paramObjek } from "@/server/modules/bckh/bckh.schema";
import { fail, ok, tanpaCache } from "@/server/lib/http";

export const runtime = "nodejs";

/** GET /api/bckh/laporan?bulan=YYYY-MM&u= — pratinjau Laporan Kinerja Harian + kelengkapan. */
export async function GET(req: NextRequest) {
  try {
    const q = laporanQuerySchema.parse(paramObjek(req.nextUrl.searchParams));
    const { target, milikSendiri } = await aksesBaca(q.u);
    return tanpaCache(ok(await laporanBulan(target, q.bulan, milikSendiri)));
  } catch (err) {
    return fail(err);
  }
}

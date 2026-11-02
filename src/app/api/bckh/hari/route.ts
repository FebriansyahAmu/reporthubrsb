import { NextRequest } from "next/server";
import { aksesBaca } from "@/server/modules/bckh/bckh.akses";
import { daftarHari } from "@/server/modules/bckh/bckh.dal";
import { paramObjek, rentangQuerySchema } from "@/server/modules/bckh/bckh.schema";
import { fail, ok, tanpaCache } from "@/server/lib/http";

export const runtime = "nodejs";

/** GET /api/bckh/hari?dari=&sampai=&u= — catatan + kegiatan dalam rentang (≤ 366 hari). */
export async function GET(req: NextRequest) {
  try {
    const q = rentangQuerySchema.parse(paramObjek(req.nextUrl.searchParams));
    const { target } = await aksesBaca(q.u);
    return tanpaCache(ok(await daftarHari(target.id, q.dari, q.sampai)));
  } catch (err) {
    return fail(err);
  }
}

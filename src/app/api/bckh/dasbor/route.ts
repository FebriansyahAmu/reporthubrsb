import { NextRequest } from "next/server";
import { aksesBaca } from "@/server/modules/bckh/bckh.akses";
import { dasbor } from "@/server/modules/bckh/bckh.laporan";
import { paramObjek, rentangQuerySchema } from "@/server/modules/bckh/bckh.schema";
import { fail, ok, tanpaCache } from "@/server/lib/http";

export const runtime = "nodejs";

/** GET /api/bckh/dasbor?dari=&sampai=&u= — persentase kegiatan, kepatuhan, tepat waktu. */
export async function GET(req: NextRequest) {
  try {
    const q = rentangQuerySchema.parse(paramObjek(req.nextUrl.searchParams));
    const { target } = await aksesBaca(q.u);
    return tanpaCache(ok(await dasbor(target, q.dari, q.sampai)));
  } catch (err) {
    return fail(err);
  }
}

import { NextRequest } from "next/server";
import { aksesBaca } from "@/server/modules/bckh/bckh.akses";
import { daftarLog } from "@/server/modules/bckh/bckh.catatan";
import { logQuerySchema, paramObjek } from "@/server/modules/bckh/bckh.schema";
import { fail, ok, tanpaCache } from "@/server/lib/http";

export const runtime = "nodejs";

/** GET /api/bckh/log?halaman=&jenis=semua|catatan|laporan|persetujuan&u= — log terbaru → lama (20 per halaman). */
export async function GET(req: NextRequest) {
  try {
    const q = logQuerySchema.parse(paramObjek(req.nextUrl.searchParams));
    const { target } = await aksesBaca(q.u);
    return tanpaCache(ok(await daftarLog(target.id, q.halaman, q.jenis)));
  } catch (err) {
    return fail(err);
  }
}

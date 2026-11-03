import { NextRequest } from "next/server";
import { kotakMasuk } from "@/server/modules/bckh/bckh.persetujuan";
import { kotakMasukQuerySchema, paramObjek } from "@/server/modules/bckh/bckh.schema";
import { authorize } from "@/server/rbac/guard";
import { fail, ok, tanpaCache } from "@/server/lib/http";
import { clientIp } from "@/server/lib/request";

export const runtime = "nodejs";

/** GET /api/bckh/persetujuan?tab=menunggu|riwayat&halaman= — kotak masuk penanda tangan (`bckh.persetujuan:view`). */
export async function GET(req: NextRequest) {
  try {
    const user = await authorize("bckh.persetujuan", "view");
    const q = kotakMasukQuerySchema.parse(paramObjek(req.nextUrl.searchParams));
    return tanpaCache(ok(await kotakMasuk({ id: user.id, nama: user.name, ip: clientIp(req), role: user.role }, q.tab, q.halaman)));
  } catch (err) {
    return tanpaCache(fail(err));
  }
}

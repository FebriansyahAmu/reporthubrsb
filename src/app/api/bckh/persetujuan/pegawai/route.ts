import { NextRequest } from "next/server";
import { pegawaiSaya } from "@/server/modules/bckh/bckh.persetujuan";
import { paramObjek, timQuerySchema } from "@/server/modules/bckh/bckh.schema";
import { authorize } from "@/server/rbac/guard";
import { fail, ok, tanpaCache } from "@/server/lib/http";
import { clientIp } from "@/server/lib/request";

export const runtime = "nodejs";

/** GET /api/bckh/persetujuan/pegawai?bulan=YYYY-MM — bawahan penampil + kepatuhan & status laporan bulan itu. */
export async function GET(req: NextRequest) {
  try {
    const user = await authorize("bckh.persetujuan", "view");
    const q = timQuerySchema.parse(paramObjek(req.nextUrl.searchParams));
    return tanpaCache(ok(await pegawaiSaya({ id: user.id, nama: user.name, ip: clientIp(req), role: user.role }, q.bulan)));
  } catch (err) {
    return tanpaCache(fail(err));
  }
}

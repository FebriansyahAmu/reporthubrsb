import { NextRequest } from "next/server";
import { detailPengajuan } from "@/server/modules/bckh/bckh.persetujuan";
import { idPengajuanSchema } from "@/server/modules/bckh/bckh.schema";
import { authorize } from "@/server/rbac/guard";
import { fail, ok, tanpaCache } from "@/server/lib/http";
import { clientIp } from "@/server/lib/request";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

/** GET /api/bckh/persetujuan/<id> — detail pengajuan + snapshot laporan + TTD (penampil wajib berhak atas pemiliknya). */
export async function GET(req: NextRequest, ctx: Ctx) {
  try {
    const user = await authorize("bckh.persetujuan", "view");
    const id = idPengajuanSchema.parse((await ctx.params).id);
    return tanpaCache(ok(await detailPengajuan(id, { id: user.id, nama: user.name, ip: clientIp(req), role: user.role })));
  } catch (err) {
    return tanpaCache(fail(err));
  }
}

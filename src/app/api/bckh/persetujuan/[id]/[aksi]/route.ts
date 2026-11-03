import { NextRequest } from "next/server";
import { jagaTulisBckh } from "@/server/modules/bckh/bckh.akses";
import { batalkan, setujui, tolak } from "@/server/modules/bckh/bckh.persetujuan";
import { alasanSchema, BATAS_BODY_TTD, idPengajuanSchema, setujuiSchema } from "@/server/modules/bckh/bckh.schema";
import { authorize } from "@/server/rbac/guard";
import { NotFoundError } from "@/server/lib/errors";
import { fail, ok, readJsonTerbatas, tanpaCache } from "@/server/lib/http";
import { clientIp } from "@/server/lib/request";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string; aksi: string }> };

/**
 * POST /api/bckh/persetujuan/<id>/setujui { ttd } | /tolak { alasan } | /batalkan { alasan }
 * — hanya akun yang dituju tahap berjalan (`bckh.persetujuan:update`); CSRF & laju dijaga.
 */
export async function POST(req: NextRequest, ctx: Ctx) {
  try {
    const user = await authorize("bckh.persetujuan", "update");
    jagaTulisBckh(req, user);
    const p = await ctx.params;
    const id = idPengajuanSchema.parse(p.id);
    const penampil = { id: user.id, nama: user.name, ip: clientIp(req), role: user.role };
    const body = await readJsonTerbatas(req, BATAS_BODY_TTD);
    switch (p.aksi) {
      case "setujui":
        return tanpaCache(ok(await setujui(id, penampil, setujuiSchema.parse(body).ttd)));
      case "tolak":
        await tolak(id, penampil, alasanSchema.parse(body).alasan);
        return tanpaCache(ok({ ditolak: id }));
      case "batalkan":
        await batalkan(id, penampil, alasanSchema.parse(body).alasan);
        return tanpaCache(ok({ dibatalkan: id }));
      default:
        throw new NotFoundError();
    }
  } catch (err) {
    return tanpaCache(fail(err));
  }
}

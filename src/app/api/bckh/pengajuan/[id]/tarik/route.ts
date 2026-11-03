import { NextRequest } from "next/server";
import { jagaTulisBckh } from "@/server/modules/bckh/bckh.akses";
import { tarik } from "@/server/modules/bckh/bckh.persetujuan";
import { idPengajuanSchema } from "@/server/modules/bckh/bckh.schema";
import { authorize } from "@/server/rbac/guard";
import { fail, ok, tanpaCache } from "@/server/lib/http";
import { clientIp } from "@/server/lib/request";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

/** POST /api/bckh/pengajuan/<id>/tarik — pegawai menarik pengajuannya (catatan bulan terbuka lagi). */
export async function POST(req: NextRequest, ctx: Ctx) {
  try {
    const user = await authorize("bckh", "update");
    jagaTulisBckh(req, user);
    const id = idPengajuanSchema.parse((await ctx.params).id);
    await tarik(id, { id: user.id, nama: user.name, ip: clientIp(req) });
    return tanpaCache(ok({ ditarik: id }));
  } catch (err) {
    return tanpaCache(fail(err));
  }
}

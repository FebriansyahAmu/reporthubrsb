import { NextRequest } from "next/server";
import { aksesBaca, jagaTulisBckh, penggunaSendiri } from "@/server/modules/bckh/bckh.akses";
import { ajukan, statusBulan } from "@/server/modules/bckh/bckh.persetujuan";
import { ajukanSchema, BATAS_BODY_TTD, paramObjek, statusBulanQuerySchema } from "@/server/modules/bckh/bckh.schema";
import { authorize } from "@/server/rbac/guard";
import { fail, ok, readJsonTerbatas, tanpaCache } from "@/server/lib/http";
import { clientIp } from "@/server/lib/request";

export const runtime = "nodejs";

/**
 * GET /api/bckh/pengajuan?bulan=YYYY-MM&u= — status persetujuan laporan satu bulan
 * (pengajuan aktif + TTD, atau yang terakhir berakhir) + kesiapan mengajukan (milik sendiri).
 */
export async function GET(req: NextRequest) {
  try {
    const q = statusBulanQuerySchema.parse(paramObjek(req.nextUrl.searchParams));
    const { penampil, target, milikSendiri } = await aksesBaca(q.u);
    return tanpaCache(ok(await statusBulan(target, q.bulan, milikSendiri, { id: penampil.id, nama: penampil.name, ip: clientIp(req), role: penampil.role })));
  } catch (err) {
    return tanpaCache(fail(err));
  }
}

/** POST /api/bckh/pengajuan { bulan, sampaiMengetahui, catatan, ttd } — ajukan laporan SENDIRI untuk ditandatangani. */
export async function POST(req: NextRequest) {
  try {
    const user = await authorize("bckh", "update");
    jagaTulisBckh(req, user);
    const input = ajukanSchema.parse(await readJsonTerbatas(req, BATAS_BODY_TTD));
    const hasil = await ajukan(await penggunaSendiri(user), { id: user.id, nama: user.name, ip: clientIp(req), role: user.role }, input);
    return tanpaCache(ok(hasil));
  } catch (err) {
    return tanpaCache(fail(err));
  }
}

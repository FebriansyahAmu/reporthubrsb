import { NextRequest } from "next/server";
import { BATAS_BODY_BCKH, jagaTulisBckh } from "@/server/modules/bckh/bckh.akses";
import { bacaPengaturan, simpanPengaturan } from "@/server/modules/bckh/bckh.laporan";
import { simpanPengaturanSchema } from "@/server/modules/bckh/bckh.schema";
import { authorize } from "@/server/rbac/guard";
import { fail, ok, readJsonTerbatas, tanpaCache } from "@/server/lib/http";
import { clientIp } from "@/server/lib/request";

export const runtime = "nodejs";

/** GET /api/bckh/pengaturan — kop sampul & penandatangan "Mengetahui" (bawaan bila belum disimpan). */
export async function GET() {
  try {
    await authorize("bckh.pengaturan", "view");
    return tanpaCache(ok(await bacaPengaturan()));
  } catch (err) {
    return fail(err);
  }
}

/** PUT /api/bckh/pengaturan — ubah pengaturan laporan global (tercatat di audit_log). */
export async function PUT(req: NextRequest) {
  try {
    const user = await authorize("bckh.pengaturan", "update");
    jagaTulisBckh(req, user);
    const input = simpanPengaturanSchema.parse(await readJsonTerbatas(req, BATAS_BODY_BCKH));
    return tanpaCache(ok(await simpanPengaturan(input, { id: user.id, nama: user.name, ip: clientIp(req) })));
  } catch (err) {
    return fail(err);
  }
}

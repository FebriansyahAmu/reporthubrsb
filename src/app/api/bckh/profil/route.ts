import { NextRequest } from "next/server";
import { aksesBaca, BATAS_BODY_BCKH, jagaTulisBckh, penggunaSendiri } from "@/server/modules/bckh/bckh.akses";
import { profilResult, simpanProfil } from "@/server/modules/bckh/bckh.profil";
import { paramObjek, profilQuerySchema, simpanProfilSchema } from "@/server/modules/bckh/bckh.schema";
import { authorize } from "@/server/rbac/guard";
import { fail, ok, readJsonTerbatas, tanpaCache } from "@/server/lib/http";

export const runtime = "nodejs";

/** GET /api/bckh/profil?tahun=&u= — profil, grafik kegiatan, streak, rutin, aktivitas per bulan. */
export async function GET(req: NextRequest) {
  try {
    const q = profilQuerySchema.parse(paramObjek(req.nextUrl.searchParams));
    const { target, milikSendiri } = await aksesBaca(q.u);
    return tanpaCache(ok(await profilResult(target, q.tahun ?? null, milikSendiri)));
  } catch (err) {
    return fail(err);
  }
}

/** PUT /api/bckh/profil — ubah profil laporan SENDIRI (nama, jabatan, NIP, atasan). */
export async function PUT(req: NextRequest) {
  try {
    const user = await authorize("bckh", "update");
    jagaTulisBckh(req, user);
    const input = simpanProfilSchema.parse(await readJsonTerbatas(req, BATAS_BODY_BCKH));
    return tanpaCache(ok(await simpanProfil(await penggunaSendiri(user), input)));
  } catch (err) {
    return fail(err);
  }
}

import { NextRequest } from "next/server";
import { paramObjek, timQuerySchema } from "@/server/modules/bckh/bckh.schema";
import { daftarTim } from "@/server/modules/bckh/bckh.tim";
import { authorize } from "@/server/rbac/guard";
import { fail, ok, tanpaCache } from "@/server/lib/http";

export const runtime = "nodejs";

/** GET /api/bckh/tim?bulan=YYYY-MM — ringkasan pengisian per pegawai (hanya-lihat). */
export async function GET(req: NextRequest) {
  try {
    await authorize("bckh.tim", "view");
    const q = timQuerySchema.parse(paramObjek(req.nextUrl.searchParams));
    return tanpaCache(ok(await daftarTim(q.bulan)));
  } catch (err) {
    return fail(err);
  }
}

import type { NextRequest } from "next/server";
import { authorize } from "@/server/rbac/guard";
import { fail, ok, readJsonTerbatas, tanpaCache } from "@/server/lib/http";
import { simpanIsianSchema } from "@/server/modules/form-rm/isian.schema";
import { bacaIsian, simpanIsian } from "@/server/modules/form-rm/isian.service";
import { aktorDari, BATAS_BODY, idDariParam, jagaTulis } from "@/server/modules/form-rm/isian.jaga";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

/** GET — isian (data + status + rev). Akses dicatat di audit. */
export async function GET(req: NextRequest, { params }: Ctx) {
  try {
    const user = await authorize("form-rm", "view");
    const id = idDariParam((await params).id);
    return tanpaCache(ok(await bacaIsian(id, aktorDari(user, req))));
  } catch (err) {
    return tanpaCache(fail(err));
  }
}

/** PATCH — simpan draf `{ rev, data }`; `rev` usang → 409. */
export async function PATCH(req: NextRequest, { params }: Ctx) {
  try {
    const user = await authorize("form-rm", "update");
    jagaTulis(req, user);
    const id = idDariParam((await params).id);
    const input = simpanIsianSchema.parse(await readJsonTerbatas(req, BATAS_BODY.simpan));
    return tanpaCache(ok(await simpanIsian(id, input, aktorDari(user, req))));
  } catch (err) {
    return tanpaCache(fail(err));
  }
}

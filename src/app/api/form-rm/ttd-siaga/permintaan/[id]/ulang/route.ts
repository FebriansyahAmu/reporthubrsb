import type { NextRequest } from "next/server";
import { authorizeAny } from "@/server/rbac/guard";
import { NotFoundError } from "@/server/lib/errors";
import { fail, ok, tanpaCache } from "@/server/lib/http";
import { clientIp } from "@/server/lib/request";
import { MODUL_AKSES_FORM_RM } from "@/features/form-rm/kategori";
import { jagaTulis } from "@/server/modules/form-rm/isian.jaga";
import { PERMINTAAN_ID_RE } from "@/server/modules/ttd-siaga/permintaan.schema";
import { ulangTtd } from "@/server/modules/ttd-siaga/permintaan.service";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

/** POST — "Minta ulang" (pemilik): kanvas kosong muncul lagi di tablet dengan tenggat baru. */
export async function POST(req: NextRequest, { params }: Ctx) {
  try {
    const user = await authorizeAny(MODUL_AKSES_FORM_RM, "update");
    jagaTulis(req, user);
    const id = (await params).id;
    if (!PERMINTAAN_ID_RE.test(id)) throw new NotFoundError();
    return tanpaCache(ok(ulangTtd(id, { id: user.id, ip: clientIp(req) })));
  } catch (err) {
    return tanpaCache(fail(err));
  }
}

import type { NextRequest } from "next/server";
import { authorize } from "@/server/rbac/guard";
import { fail, ok, tanpaCache } from "@/server/lib/http";
import { riwayatIsian } from "@/server/modules/form-rm/isian.service";
import { idDariParam } from "@/server/modules/form-rm/isian.jaga";

export const runtime = "nodejs";

/** GET — daftar revisi + hasil pemeriksaan segel integritas. */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await authorize("form-rm", "view");
    const id = idDariParam((await params).id);
    return tanpaCache(ok(await riwayatIsian(id)));
  } catch (err) {
    return tanpaCache(fail(err));
  }
}

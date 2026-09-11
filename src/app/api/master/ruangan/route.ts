import { getRuanganMapping } from "@/server/modules/master/ruangan/ruangan-pejabat.service";
import { authorize } from "@/server/rbac/guard";
import { ok, fail } from "@/server/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET — mapping ruangan (SIMGOS) + penetapan pejabat (reporthub), per instalasi. */
export async function GET() {
  try {
    await authorize("master.ruangan", "view");
    const data = await getRuanganMapping();
    return ok(data);
  } catch (err) {
    return fail(err);
  }
}

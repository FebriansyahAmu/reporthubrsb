import { NextRequest } from "next/server";
import { saveRuanganPejabatSchema } from "@/server/modules/master/ruangan/ruangan-pejabat.schema";
import { saveRuanganPejabat } from "@/server/modules/master/ruangan/ruangan-pejabat.service";
import { getCurrentUser } from "@/server/auth/session";
import { authorize } from "@/server/rbac/guard";
import { ok, fail } from "@/server/lib/http";

export const runtime = "nodejs";

/** POST — simpan/replace penetapan pejabat satu ruangan/instalasi (reporthub). */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ ruanganId: string }> },
) {
  try {
    await authorize("master.ruangan", "update");
    const { ruanganId } = await params;
    const body = await req.json();
    const input = saveRuanganPejabatSchema.parse(body);
    const user = await getCurrentUser();
    await saveRuanganPejabat(ruanganId, input, user?.username ?? null);
    return ok({ ok: true });
  } catch (err) {
    return fail(err);
  }
}

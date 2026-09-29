import { NextRequest } from "next/server";
import { triaseSaveSchema } from "@/server/modules/form-rm/form-rm.schema";
import { getTriaseContext, saveFormRm } from "@/server/modules/form-rm/form-rm.service";
import { TRIASE_JENIS } from "@/features/form-rm/triase.constants";
import { getCurrentUser } from "@/server/auth/session";
import { authorize } from "@/server/rbac/guard";
import { ok, fail } from "@/server/lib/http";
import { NotFoundError } from "@/server/lib/errors";

export const runtime = "nodejs";

/** GET — rekaman Triase tersimpan (bila ada) + header pasien + prefill triase SIMRS. */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ nopen: string }> },
) {
  try {
    await authorize("form-rm", "view");
    const { nopen } = await params;
    const ctx = await getTriaseContext(nopen);
    if (!ctx) return fail(new NotFoundError("NOPEN tidak ditemukan"));
    return ok(ctx);
  } catch (err) {
    return fail(err);
  }
}

/** POST — simpan/replace form Triase (RM.04) ke reporthub. */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ nopen: string }> },
) {
  try {
    await authorize("form-rm", "update");
    const { nopen } = await params;
    const input = triaseSaveSchema.parse(await req.json());
    const user = await getCurrentUser();
    const saved = await saveFormRm(
      nopen,
      TRIASE_JENIS,
      input.data,
      input.header,
      user?.username ?? null,
    );
    return ok(saved);
  } catch (err) {
    return fail(err);
  }
}

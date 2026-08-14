import { NextRequest } from "next/server";
import { consentSaveSchema } from "@/server/modules/form-rm/form-rm.schema";
import { getConsentContext, saveFormRm } from "@/server/modules/form-rm/form-rm.service";
import { CONSENT_JENIS } from "@/features/form-rm/consent.constants";
import { getCurrentUser } from "@/server/auth/session";
import { authorize } from "@/server/rbac/guard";
import { ok, fail } from "@/server/lib/http";

export const runtime = "nodejs";

/** GET — rekaman General Consent tersimpan (bila ada) + header pasien SIMGOS. */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ nopen: string }> },
) {
  try {
    await authorize("form-rm", "view");
    const { nopen } = await params;
    const ctx = await getConsentContext(nopen);
    if (!ctx) return fail(new Error("NOPEN tidak ditemukan"));
    return ok(ctx);
  } catch (err) {
    return fail(err);
  }
}

/** POST — simpan/replace form General Consent (RM.03) ke reporthub. */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ nopen: string }> },
) {
  try {
    await authorize("form-rm", "update");
    const { nopen } = await params;
    const input = consentSaveSchema.parse(await req.json());
    const user = await getCurrentUser();
    const saved = await saveFormRm(
      nopen,
      CONSENT_JENIS,
      input.data,
      input.header,
      user?.username ?? null,
    );
    return ok(saved);
  } catch (err) {
    return fail(err);
  }
}

import { NextRequest } from "next/server";
import { edukasiSaveSchema } from "@/server/modules/form-rm/form-rm.schema";
import { getEdukasiContext, saveFormRm } from "@/server/modules/form-rm/form-rm.service";
import { EDUKASI_JENIS } from "@/features/form-rm/edukasi.constants";
import { getCurrentUser } from "@/server/auth/session";
import { ok, fail } from "@/server/lib/http";

export const runtime = "nodejs";

/** GET — rekaman Edukasi tersimpan (bila ada) + header pasien SIMGOS. */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ nopen: string }> },
) {
  try {
    const { nopen } = await params;
    const ctx = await getEdukasiContext(nopen);
    if (!ctx) return fail(new Error("NOPEN tidak ditemukan"));
    return ok(ctx);
  } catch (err) {
    return fail(err);
  }
}

/** POST — simpan/replace form Edukasi (RM.21) ke reporthub (SIMGOS read-only). */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ nopen: string }> },
) {
  try {
    const { nopen } = await params;
    const body = await req.json();
    const input = edukasiSaveSchema.parse(body);
    const user = await getCurrentUser();
    const saved = await saveFormRm(
      nopen,
      EDUKASI_JENIS,
      input.data,
      input.header,
      user?.username ?? null,
    );
    return ok(saved);
  } catch (err) {
    return fail(err);
  }
}

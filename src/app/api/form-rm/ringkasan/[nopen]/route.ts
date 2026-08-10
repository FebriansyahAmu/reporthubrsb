import { NextRequest } from "next/server";
import { ringkasanSaveSchema } from "@/server/modules/form-rm/form-rm.schema";
import { getRingkasanContext, saveFormRm } from "@/server/modules/form-rm/form-rm.service";
import { RINGKASAN_JENIS } from "@/features/form-rm/ringkasan.constants";
import { getCurrentUser } from "@/server/auth/session";
import { ok, fail } from "@/server/lib/http";

export const runtime = "nodejs";

/** GET — rekaman Ringkasan RM.01 tersimpan (bila ada) + header + prefill SIMGOS. */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ nopen: string }> },
) {
  try {
    const { nopen } = await params;
    const ctx = await getRingkasanContext(nopen);
    if (!ctx) return fail(new Error("NOPEN tidak ditemukan"));
    return ok(ctx);
  } catch (err) {
    return fail(err);
  }
}

/** POST — simpan/replace form Ringkasan Masuk & Keluar (RM.01) ke reporthub. */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ nopen: string }> },
) {
  try {
    const { nopen } = await params;
    const input = ringkasanSaveSchema.parse(await req.json());
    const user = await getCurrentUser();
    const saved = await saveFormRm(
      nopen,
      RINGKASAN_JENIS,
      input.data,
      input.header,
      user?.username ?? null,
    );
    return ok(saved);
  } catch (err) {
    return fail(err);
  }
}

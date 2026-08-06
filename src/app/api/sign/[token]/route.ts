import { NextRequest } from "next/server";
import { ok, fail } from "@/server/lib/http";
import { NotFoundError } from "@/server/lib/errors";
import { signSubmitSchema } from "@/server/modules/sign/sign.schema";
import { getSignView, submitSignature } from "@/server/modules/sign/sign.store";

export const runtime = "nodejs";

/**
 * GET — status sesi (dipakai PC untuk poll & HP untuk menampilkan konteks).
 * Publik: token acak adalah kapabilitasnya. Mengembalikan payload bila sudah
 * ditandatangani agar PC bisa mengisi field.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  try {
    const { token } = await params;
    const v = getSignView(token);
    if (!v) throw new NotFoundError("Sesi tanda tangan tidak ditemukan");
    return ok(v);
  } catch (err) {
    return fail(err);
  }
}

/** POST — kirim TTD dari HP (publik, token-gated). */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  try {
    const { token } = await params;
    const { payload } = signSubmitSchema.parse(await req.json());
    const v = submitSignature(token, payload);
    return ok(v);
  } catch (err) {
    return fail(err);
  }
}

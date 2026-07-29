import { NextRequest } from "next/server";
import { buktiPelayananSaveSchema } from "@/server/modules/berkas-klaim/berkas-klaim.bukti.schema";
import { getBuktiContext, saveBukti } from "@/server/modules/berkas-klaim/berkas-klaim.bukti.service";
import { getCurrentUser } from "@/server/auth/session";
import { ok, fail } from "@/server/lib/http";

export const runtime = "nodejs";

/** GET — rekaman tersimpan + tindakan SIMGOS (prefill) untuk form Bukti Pelayanan. */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ nopen: string }> },
) {
  try {
    const { nopen } = await params;
    const data = await getBuktiContext(nopen);
    return ok(data);
  } catch (err) {
    return fail(err);
  }
}

/** POST — simpan/replace Bukti Pelayanan ke DB reporthub (SIMGOS tetap read-only). */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ nopen: string }> },
) {
  try {
    const { nopen } = await params;
    const body = await req.json();
    const input = buktiPelayananSaveSchema.parse(body);
    const user = await getCurrentUser();
    const saved = await saveBukti(nopen, input.data, input.header, user?.username ?? null);
    return ok(saved);
  } catch (err) {
    return fail(err);
  }
}

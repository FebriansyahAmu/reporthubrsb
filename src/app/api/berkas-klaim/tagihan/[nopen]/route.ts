import { NextRequest } from "next/server";
import { getTagihanLengkap } from "@/server/modules/berkas-klaim/berkas-klaim.tagihan.service";
import { authorize } from "@/server/rbac/guard";
import { ok, fail } from "@/server/lib/http";

export const runtime = "nodejs";

/** GET — total + rincian tagihan (per-komponen & per-item) untuk satu NOPEN. READ-ONLY. */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ nopen: string }> },
) {
  try {
    await authorize("berkas-klaim", "view");
    const { nopen } = await params;
    const data = await getTagihanLengkap(nopen);
    return ok(data);
  } catch (err) {
    return fail(err);
  }
}

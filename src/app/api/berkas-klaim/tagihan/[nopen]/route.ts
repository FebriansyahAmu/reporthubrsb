import { NextRequest } from "next/server";
import {
  getTagihanGabungan,
  getTagihanLengkap,
} from "@/server/modules/berkas-klaim/berkas-klaim.tagihan.service";
import { authorize } from "@/server/rbac/guard";
import { ok, fail } from "@/server/lib/http";

export const runtime = "nodejs";

/**
 * GET — total + rincian tagihan (per-komponen & per-item) untuk satu NOPEN.
 * `?igd=1` → gabungkan dengan tagihan IGD asal (episode RI). READ-ONLY.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ nopen: string }> },
) {
  try {
    await authorize("berkas-klaim", "view");
    const { nopen } = await params;
    const gabung = req.nextUrl.searchParams.get("igd") === "1";
    const data = gabung ? await getTagihanGabungan(nopen) : await getTagihanLengkap(nopen);
    return ok(data);
  } catch (err) {
    return fail(err);
  }
}

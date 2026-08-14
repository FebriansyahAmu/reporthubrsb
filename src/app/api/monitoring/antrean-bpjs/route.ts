import { NextRequest } from "next/server";
import { antreanQuerySchema } from "@/server/modules/antrean/antrean.schema";
import { getAntreanBpjsData } from "@/server/modules/antrean/antrean.service";
import { authorize } from "@/server/rbac/guard";
import { ok, fail } from "@/server/lib/http";

export const runtime = "nodejs";

/**
 * GET /api/monitoring/antrean-bpjs?tanggal=YYYY-MM-DD[&search&poli&status&tahap&page&pageSize]
 * Monitoring progres Task 1–7 antrean BPJS (regonline) untuk satu tanggal.
 */
export async function GET(req: NextRequest) {
  try {
    await authorize("monitoring.antrean-bpjs", "view");
    const sp = Object.fromEntries(req.nextUrl.searchParams);
    const input = antreanQuerySchema.parse(sp);
    const data = await getAntreanBpjsData(input);
    return ok(data);
  } catch (err) {
    return fail(err);
  }
}

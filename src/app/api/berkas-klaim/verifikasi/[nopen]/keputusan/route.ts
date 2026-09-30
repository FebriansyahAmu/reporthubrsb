import { NextRequest } from "next/server";
import { putuskanTahap1 } from "@/server/modules/verifikasi-klaim/keputusan.service";
import { MODUL_ANTREAN } from "@/server/modules/verifikasi-klaim/verifikasi.constants";
import { keputusanSchema, nopenSchema } from "@/server/modules/verifikasi-klaim/verifikasi.schema";
import { authorizeAny } from "@/server/rbac/guard";
import { ok, fail, readJson } from "@/server/lib/http";
import { clientIp } from "@/server/lib/request";

export const runtime = "nodejs";

/**
 * POST /api/berkas-klaim/verifikasi/[nopen]/keputusan — keputusan Tahap 1
 * (`LOLOSKAN_RM` / `TANDAI_TIDAK_LENGKAP`). Izin per transisi, versi (409 bila
 * bentrok), dan kelengkapan dicek di server terhadap data SIMGOS segar.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ nopen: string }> }) {
  try {
    const user = await authorizeAny(MODUL_ANTREAN, "view");
    const nopen = nopenSchema.parse((await params).nopen);
    const input = keputusanSchema.parse(await readJson(req));
    return ok(await putuskanTahap1(nopen, input, user, clientIp(req)));
  } catch (err) {
    return fail(err);
  }
}

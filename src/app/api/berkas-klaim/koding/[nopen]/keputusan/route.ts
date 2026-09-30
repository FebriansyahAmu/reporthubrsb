import { NextRequest } from "next/server";
import { putuskanTahap2 } from "@/server/modules/verifikasi-klaim/koding.service";
import { MODUL_VERIFIKASI } from "@/server/modules/verifikasi-klaim/verifikasi.constants";
import { kodingKeputusanSchema, nopenSchema } from "@/server/modules/verifikasi-klaim/verifikasi.schema";
import { authorize } from "@/server/rbac/guard";
import { ok, fail, readJson } from "@/server/lib/http";
import { clientIp } from "@/server/lib/request";

export const runtime = "nodejs";

/**
 * POST /api/berkas-klaim/koding/[nopen]/keputusan — keputusan coder (Tahap 2):
 * `AJUKAN_KOREKSI` (+usulan), `LOLOSKAN_KLAIM`, `KEMBALIKAN_KE_RM`. Usulan
 * disimpan di reporthub, TIDAK ditulis ke SIMGOS. Transisi, versi (409) &
 * aturan INA-CBG dicek di server terhadap data SIMGOS segar.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ nopen: string }> }) {
  try {
    const user = await authorize(MODUL_VERIFIKASI.KLAIM, "view");
    const nopen = nopenSchema.parse((await params).nopen);
    const input = kodingKeputusanSchema.parse(await readJson(req));
    return ok(await putuskanTahap2(nopen, input, user, clientIp(req)));
  } catch (err) {
    return fail(err);
  }
}

import { NextRequest } from "next/server";
import { cariIcd } from "@/server/modules/verifikasi-klaim/icd.cache";
import { MODUL_VERIFIKASI } from "@/server/modules/verifikasi-klaim/verifikasi.constants";
import { icdQuerySchema } from "@/server/modules/verifikasi-klaim/verifikasi.schema";
import { authorize } from "@/server/rbac/guard";
import { ok, fail } from "@/server/lib/http";

export const runtime = "nodejs";

/**
 * GET /api/berkas-klaim/koding/icd?jenis=10|9&q= — cari kode ICD INA-CBG
 * (ICD-10 / ICD-9-CM edisi IM) per awalan kode atau teks nama. Read-only
 * SIMGOS lewat index, hasil di-cache 24 jam. Untuk coder (Tahap 2).
 */
export async function GET(req: NextRequest) {
  try {
    await authorize(MODUL_VERIFIKASI.KLAIM, "view");
    const q = icdQuerySchema.parse(Object.fromEntries(req.nextUrl.searchParams));
    return ok(await cariIcd(q.jenis, q.q));
  } catch (err) {
    return fail(err);
  }
}

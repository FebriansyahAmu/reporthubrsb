import { NextRequest } from "next/server";
import { loloskanMassal } from "@/server/modules/verifikasi-klaim/keputusan.service";
import { MODUL_VERIFIKASI } from "@/server/modules/verifikasi-klaim/verifikasi.constants";
import { massalSchema } from "@/server/modules/verifikasi-klaim/verifikasi.schema";
import { authorize } from "@/server/rbac/guard";
import { ok, fail, readJson } from "@/server/lib/http";
import { clientIp } from "@/server/lib/request";

export const runtime = "nodejs";

/**
 * POST /api/berkas-klaim/verifikasi/massal — loloskan sekaligus berkas
 * BELUM_DIPERIKSA yang lengkap otomatis pada filter (dicek ulang segar; tiap
 * berkas tercatat di riwayat). Butuh `berkas-klaim.verifikasi-rm:update`.
 */
export async function POST(req: NextRequest) {
  try {
    const user = await authorize(MODUL_VERIFIKASI.RM, "update");
    const input = massalSchema.parse(await readJson(req));
    return ok(await loloskanMassal(input, user, clientIp(req)));
  } catch (err) {
    return fail(err);
  }
}

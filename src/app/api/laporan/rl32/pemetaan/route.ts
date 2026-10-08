import { NextRequest } from "next/server";
import { simpanPemetaanSchema } from "@/server/modules/rl32/rl32.schema";
import { daftarPemetaan, simpanPemetaan } from "@/server/modules/rl32/rl32.pemetaan";
import { BATAS_BODY_PEMETAAN, jagaTulisPemetaan } from "@/server/modules/rl32/rl32.jaga";
import { authorize } from "@/server/rbac/guard";
import { ok, fail, readJsonTerbatas, tanpaCache } from "@/server/lib/http";
import { clientIp } from "@/server/lib/request";

export const runtime = "nodejs";

/** GET /api/laporan/rl32/pemetaan — ruang rawat inap + pemetaan + saran, dan jenis pelayanan RL 3.2. */
export async function GET() {
  try {
    await authorize("laporan.pemetaan-rl", "view");
    return tanpaCache(ok(await daftarPemetaan()));
  } catch (err) {
    return fail(err);
  }
}

/**
 * PUT /api/laporan/rl32/pemetaan { perubahan: [{ ruanganId, tujuan }] }
 * `tujuan` = ID jenis pelayanan | "kecualikan" | "kosongkan". Tercatat di audit.
 */
export async function PUT(req: NextRequest) {
  try {
    const user = await authorize("laporan.pemetaan-rl", "update");
    jagaTulisPemetaan(req, user);
    const input = simpanPemetaanSchema.parse(await readJsonTerbatas(req, BATAS_BODY_PEMETAAN));
    const hasil = await simpanPemetaan(input, { id: user.id, nama: user.name, ip: clientIp(req) });
    return tanpaCache(ok(hasil));
  } catch (err) {
    return fail(err);
  }
}

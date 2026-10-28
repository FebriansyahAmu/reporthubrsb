import { NextRequest } from "next/server";
import { simpanPemetaanRl35Schema } from "@/server/modules/rl35/rl35.schema";
import { daftarPemetaanRl35, simpanPemetaanRl35 } from "@/server/modules/rl35/rl35.pemetaan";
import { BATAS_BODY_PEMETAAN, jagaTulisPemetaan } from "@/server/modules/rl32/rl32.jaga";
import { authorize } from "@/server/rbac/guard";
import { ok, fail, readJsonTerbatas, tanpaCache } from "@/server/lib/http";
import { clientIp } from "@/server/lib/request";

export const runtime = "nodejs";

/** GET /api/laporan/rl35/pemetaan — poliklinik & ruang IGD + pemetaan (tersimpan/bawaan) + jenis kegiatan RL 3.5. */
export async function GET() {
  try {
    await authorize("laporan.pemetaan-rl", "view");
    return tanpaCache(ok(await daftarPemetaanRl35()));
  } catch (err) {
    return fail(err);
  }
}

/**
 * PUT /api/laporan/rl35/pemetaan { perubahan: [{ ruanganId, tujuan }] }
 * `tujuan` = ID jenis kegiatan | "kecualikan" | "kosongkan" (kembali bawaan). Tercatat di audit.
 */
export async function PUT(req: NextRequest) {
  try {
    const user = await authorize("laporan.pemetaan-rl", "update");
    jagaTulisPemetaan(req, user);
    const input = simpanPemetaanRl35Schema.parse(await readJsonTerbatas(req, BATAS_BODY_PEMETAAN));
    return tanpaCache(ok(await simpanPemetaanRl35(input, { id: user.id, nama: user.name, ip: clientIp(req) })));
  } catch (err) {
    return fail(err);
  }
}

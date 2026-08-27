import { getRuanganOptions } from "@/server/modules/pengunjung/pengunjung.service";
import { authorize } from "@/server/rbac/guard";
import { ok, fail } from "@/server/lib/http";

export const runtime = "nodejs";

/** GET /api/laporan/pengunjung/ruangan — opsi ruangan (RJ/IGD/RI) untuk selektor. */
export async function GET() {
  try {
    await authorize("laporan", "view");
    return ok(await getRuanganOptions());
  } catch (err) {
    return fail(err);
  }
}

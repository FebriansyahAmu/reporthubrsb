import { NextRequest } from "next/server";
import { applyKepalaRuanganSchema } from "@/server/modules/master/ruangan/ruangan-pejabat.schema";
import { applyKepalaRuanganToKategori } from "@/server/modules/master/ruangan/ruangan-pejabat.service";
import type { KategoriKunjungan } from "@/server/modules/master/ruangan/ruangan-pejabat.types";
import { getCurrentUser } from "@/server/auth/session";
import { authorize } from "@/server/rbac/guard";
import { ok, fail } from "@/server/lib/http";

export const runtime = "nodejs";

/** POST — terapkan Kepala Ruangan ke semua ruangan pada satu instalasi (reporthub). */
export async function POST(req: NextRequest) {
  try {
    await authorize("master.ruangan", "update");
    const body = await req.json();
    const input = applyKepalaRuanganSchema.parse(body);
    const user = await getCurrentUser();
    const ruanganIds = await applyKepalaRuanganToKategori(
      input.kategori as KategoriKunjungan,
      input.pejabat,
      user?.username ?? null,
    );
    return ok({ ruanganIds });
  } catch (err) {
    return fail(err);
  }
}

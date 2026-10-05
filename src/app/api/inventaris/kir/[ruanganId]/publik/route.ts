import { NextRequest } from "next/server";
import { withPermission } from "@/server/rbac/guard";
import { ok, readJson } from "@/server/lib/http";
import { clientIp } from "@/server/lib/request";
import { aksiTautanSchema, idRuanganSchema } from "@/server/modules/inventaris/publik.schema";
import { getTautanPublik, ubahTautanPublik } from "@/server/modules/inventaris/publik.service";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ ruanganId: string }> };

/**
 * GET /api/inventaris/kir/[ruanganId]/publik — status & URL tautan publik (QR).
 * Butuh izin cetak: URL = kapabilitas, setara dengan mencetak labelnya.
 */
export const GET = withPermission<{ ruanganId: string }>("inventaris.kir", "print", async (_req, ctx: Ctx) => {
  const ruanganId = idRuanganSchema.parse((await ctx.params).ruanganId);
  return ok(await getTautanPublik(ruanganId));
});

/**
 * POST — `{ aksi: TERBITKAN | NONAKTIFKAN | AKTIFKAN | GANTI }`. Mengubah apa
 * yang terbuka ke publik → izin ubah KIR; setiap aksi diaudit.
 */
export const POST = withPermission<{ ruanganId: string }>(
  "inventaris.kir",
  "update",
  async (req: NextRequest, ctx: Ctx, user) => {
    const ruanganId = idRuanganSchema.parse((await ctx.params).ruanganId);
    const { aksi } = aksiTautanSchema.parse(await readJson(req));
    return ok(await ubahTautanPublik(ruanganId, aksi, user, clientIp(req)));
  },
);

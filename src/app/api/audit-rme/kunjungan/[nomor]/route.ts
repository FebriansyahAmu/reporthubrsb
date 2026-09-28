import { NextRequest } from "next/server";
import { withPermission } from "@/server/rbac/guard";
import { ok } from "@/server/lib/http";
import { nomorKunjunganSchema } from "@/server/modules/audit-rme/kunjungan.schema";
import { getKunjunganDetail } from "@/server/modules/audit-rme/jejak.service";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ nomor: string }> };

/** GET /api/audit-rme/kunjungan/[nomor] — jejak satu kunjungan: data aktual, petugas, log, matriks RI (read-only). */
export const GET = withPermission<{ nomor: string }>("audit-rme", "view", async (_req: NextRequest, ctx: Ctx) => {
  const nomor = nomorKunjunganSchema.parse((await ctx.params).nomor);
  return ok(await getKunjunganDetail(nomor));
});

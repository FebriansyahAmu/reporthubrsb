import { NextRequest } from "next/server";
import { withPermission } from "@/server/rbac/guard";
import { ok } from "@/server/lib/http";
import { petugasIdSchema, petugasQuerySchema } from "@/server/modules/audit-rme/kunjungan.schema";
import { getProfilPetugas } from "@/server/modules/audit-rme/petugas.service";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

/** GET /api/audit-rme/petugas/[id] — profil kepatuhan satu petugas: kalender, pasien, temuan (read-only). */
export const GET = withPermission<{ id: string }>("audit-rme", "view", async (req: NextRequest, ctx: Ctx) => {
  const id = petugasIdSchema.parse((await ctx.params).id);
  const q = petugasQuerySchema.parse(Object.fromEntries(req.nextUrl.searchParams));
  return ok(await getProfilPetugas(id, q));
});

import { NextRequest } from "next/server";
import { withPermission } from "@/server/rbac/guard";
import { ok, readJsonTerbatas, tanpaCache } from "@/server/lib/http";
import { clientIp } from "@/server/lib/request";
import { tolakLintasSitus } from "@/server/modules/inventaris/inventaris.jaga";
import { idSchema, petugasPutSchema } from "@/server/modules/inventaris/petugas.schema";
import { listPetugasRuangan, setPetugasRuangan } from "@/server/modules/inventaris/petugas.service";

export const runtime = "nodejs";

type P = { id: string };

/** GET /api/inventaris/pengaturan/ruangan/[id]/petugas — petugas ruangan + akun PJ otomatis. */
export const GET = withPermission<P>("inventaris.pengaturan", "view", async (_req, ctx) => {
  const id = idSchema.parse((await ctx.params).id);
  return tanpaCache(ok(await listPetugasRuangan(id)));
});

/** PUT /api/inventaris/pengaturan/ruangan/[id]/petugas — ganti seluruh daftar petugas `{ userIds }`. */
export const PUT = withPermission<P>("inventaris.pengaturan", "update", async (req: NextRequest, ctx, user) => {
  tolakLintasSitus(req);
  const id = idSchema.parse((await ctx.params).id);
  const input = petugasPutSchema.parse(await readJsonTerbatas(req, 8 * 1024));
  const hasil = await setPetugasRuangan(id, input, { id: user.id, nama: user.name, ip: clientIp(req) });
  return tanpaCache(ok(hasil));
});

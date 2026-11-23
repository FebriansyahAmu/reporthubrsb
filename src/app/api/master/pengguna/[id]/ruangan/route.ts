import { NextRequest } from "next/server";
import { withPermission } from "@/server/rbac/guard";
import { ok, readJsonTerbatas, tanpaCache } from "@/server/lib/http";
import { clientIp } from "@/server/lib/request";
import { tolakLintasSitus } from "@/server/modules/inventaris/inventaris.jaga";
import { idSchema, ruanganPenggunaPutSchema } from "@/server/modules/inventaris/petugas.schema";
import { listRuanganPengguna, setRuanganPengguna } from "@/server/modules/inventaris/petugas.service";

export const runtime = "nodejs";

type P = { id: string };

/**
 * GET /api/master/pengguna/[id]/ruangan — ruangan tugas akun (Checklist
 * Pemeliharaan): dipetakan manual + otomatis lewat NIP PJ.
 */
export const GET = withPermission<P>("master.pengguna", "view", async (_req, ctx) => {
  const id = idSchema.parse((await ctx.params).id);
  return tanpaCache(ok(await listRuanganPengguna(id)));
});

/**
 * PUT /api/master/pengguna/[id]/ruangan — ganti seluruh ruangan tugas akun
 * `{ ruanganIds }`. Tabel sama dengan Pengaturan › Ruangan › Petugas.
 */
export const PUT = withPermission<P>("master.pengguna", "update", async (req: NextRequest, ctx, user) => {
  tolakLintasSitus(req);
  const id = idSchema.parse((await ctx.params).id);
  const input = ruanganPenggunaPutSchema.parse(await readJsonTerbatas(req, 8 * 1024));
  const hasil = await setRuanganPengguna(id, input, { id: user.id, nama: user.name, ip: clientIp(req) });
  return tanpaCache(ok(hasil));
});

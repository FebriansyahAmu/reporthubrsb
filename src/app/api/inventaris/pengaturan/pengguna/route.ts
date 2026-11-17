import { NextRequest } from "next/server";
import { withPermission } from "@/server/rbac/guard";
import { ok, tanpaCache } from "@/server/lib/http";
import { penggunaQuerySchema } from "@/server/modules/inventaris/petugas.schema";
import { cariPengguna } from "@/server/modules/inventaris/petugas.service";

export const runtime = "nodejs";

/**
 * GET /api/inventaris/pengaturan/pengguna?q= — cari akun aktif untuk dipetakan
 * sebagai petugas ruangan. Hanya pengelola pengaturan (update); NIP tersamar.
 */
export const GET = withPermission("inventaris.pengaturan", "update", async (req: NextRequest) => {
  const { q } = penggunaQuerySchema.parse(Object.fromEntries(req.nextUrl.searchParams));
  return tanpaCache(ok(await cariPengguna(q)));
});

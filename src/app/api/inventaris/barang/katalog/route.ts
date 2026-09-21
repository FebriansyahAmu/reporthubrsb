import { NextRequest } from "next/server";
import { withPermission } from "@/server/rbac/guard";
import { ok } from "@/server/lib/http";
import { katalogQuerySchema } from "@/server/modules/inventaris/katalog.schema";
import { listKatalog } from "@/server/modules/inventaris/katalog.service";

export const runtime = "nodejs";

/** GET /api/inventaris/barang/katalog — daftar item katalog + jumlah unit & nilai. */
export const GET = withPermission("inventaris.barang", "view", async (req: NextRequest) => {
  const q = katalogQuerySchema.parse(Object.fromEntries(req.nextUrl.searchParams));
  const res = await listKatalog(q);
  return ok(res.data, res.meta);
});

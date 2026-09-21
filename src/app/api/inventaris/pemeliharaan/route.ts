import { NextRequest } from "next/server";
import { withPermission } from "@/server/rbac/guard";
import { ok } from "@/server/lib/http";
import { pemeliharaanQuerySchema } from "@/server/modules/inventaris/pemeliharaan.schema";
import { listPemeliharaan } from "@/server/modules/inventaris/pemeliharaan.service";

export const runtime = "nodejs";

/** GET /api/inventaris/pemeliharaan — daftar barang + status jatuh tempo. */
export const GET = withPermission("inventaris.pemeliharaan", "view", async (req: NextRequest) => {
  const q = pemeliharaanQuerySchema.parse(Object.fromEntries(req.nextUrl.searchParams));
  const res = await listPemeliharaan(q);
  return ok(res.data, { ...res.meta, stats: res.stats });
});

import { NextRequest } from "next/server";
import { withPermission } from "@/server/rbac/guard";
import { ok } from "@/server/lib/http";
import { ruanganTreeQuerySchema } from "@/server/modules/audit-rme/kunjungan.schema";
import { getRuanganTree } from "@/server/modules/audit-rme/kunjungan.service";

export const runtime = "nodejs";

/** GET /api/audit-rme/ruangan — pohon jenis kunjungan → bangsal → ruang + jumlah kunjungan (read-only). */
export const GET = withPermission("audit-rme", "view", async (req: NextRequest) => {
  const q = ruanganTreeQuerySchema.parse(Object.fromEntries(req.nextUrl.searchParams));
  return ok(await getRuanganTree(q));
});

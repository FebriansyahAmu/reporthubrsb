import { NextRequest } from "next/server";
import { withPermission } from "@/server/rbac/guard";
import { ok } from "@/server/lib/http";
import { kunjunganQuerySchema } from "@/server/modules/audit-rme/kunjungan.schema";
import { listKunjungan } from "@/server/modules/audit-rme/kunjungan.service";

export const runtime = "nodejs";

/** GET /api/audit-rme/kunjungan — papan kunjungan + hitungan input aktual per kategori (read-only). */
export const GET = withPermission("audit-rme", "view", async (req: NextRequest) => {
  const q = kunjunganQuerySchema.parse(Object.fromEntries(req.nextUrl.searchParams));
  return ok(await listKunjungan(q));
});

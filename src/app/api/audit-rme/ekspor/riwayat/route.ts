import { NextRequest } from "next/server";
import { withPermission } from "@/server/rbac/guard";
import { ok } from "@/server/lib/http";
import { riwayatEksporQuerySchema } from "@/server/modules/audit-rme/ekspor.schema";
import { getRiwayatEkspor } from "@/server/modules/audit-rme/ekspor.service";

export const runtime = "nodejs";

/** GET /api/audit-rme/ekspor/riwayat?page= — meta-audit: siapa mengekspor apa & kapan (terbaru dulu). */
export const GET = withPermission("audit-rme", "view", async (req: NextRequest) => {
  const { page } = riwayatEksporQuerySchema.parse(Object.fromEntries(req.nextUrl.searchParams));
  return ok(await getRiwayatEkspor(page));
});

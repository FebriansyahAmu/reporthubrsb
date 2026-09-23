import { NextRequest } from "next/server";
import { withPermission } from "@/server/rbac/guard";
import { ok } from "@/server/lib/http";
import { auditListQuerySchema, listKlaimAudit } from "@/server/modules/rekap-klaim/audit.service";

export const runtime = "nodejs";

/** GET /api/rekap-klaim/audit — riwayat perubahan klaim/potongan (read-only). */
export const GET = withPermission("rekap-klaim.audit", "view", async (req: NextRequest) => {
  const q = auditListQuerySchema.parse(Object.fromEntries(req.nextUrl.searchParams));
  const result = await listKlaimAudit(q);
  return ok(result.data, result.meta);
});

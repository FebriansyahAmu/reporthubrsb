import { NextRequest } from "next/server";
import { withPermission } from "@/server/rbac/guard";
import { ok } from "@/server/lib/http";
import { petaQuerySchema } from "@/server/modules/audit-rme/kunjungan.schema";
import { getPetaRuangan } from "@/server/modules/audit-rme/peta.service";

export const runtime = "nodejs";

/** GET /api/audit-rme/peta — heatmap kepatuhan ruang × hari untuk satu jenis kunjungan (read-only). */
export const GET = withPermission("audit-rme", "view", async (req: NextRequest) => {
  const q = petaQuerySchema.parse(Object.fromEntries(req.nextUrl.searchParams));
  return ok(await getPetaRuangan(q));
});

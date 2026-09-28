import { NextRequest } from "next/server";
import { withPermission } from "@/server/rbac/guard";
import { ok } from "@/server/lib/http";
import { petugasQuerySchema } from "@/server/modules/audit-rme/kunjungan.schema";
import { getKepatuhanPetugas } from "@/server/modules/audit-rme/petugas.service";

export const runtime = "nodejs";

/** GET /api/audit-rme/petugas — skor & peringkat kepatuhan pengimputan per petugas (read-only). */
export const GET = withPermission("audit-rme", "view", async (req: NextRequest) => {
  const q = petugasQuerySchema.parse(Object.fromEntries(req.nextUrl.searchParams));
  return ok(await getKepatuhanPetugas(q));
});

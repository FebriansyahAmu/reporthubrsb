import { NextRequest } from "next/server";
import { withPermission } from "@/server/rbac/guard";
import { ok } from "@/server/lib/http";
import { riwayatQuerySchema } from "@/server/modules/inventaris/checklist.schema";
import { listRiwayat } from "@/server/modules/inventaris/checklist.service";

export const runtime = "nodejs";

/** GET /api/inventaris/pemeliharaan/checklist/riwayat — daftar pelaksanaan per periode. */
export const GET = withPermission("inventaris.pemeliharaan", "view", async (req: NextRequest) => {
  const q = riwayatQuerySchema.parse(Object.fromEntries(req.nextUrl.searchParams));
  return ok(await listRiwayat(q));
});

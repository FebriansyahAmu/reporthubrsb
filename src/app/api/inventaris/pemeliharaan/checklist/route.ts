import { NextRequest } from "next/server";
import { withPermission } from "@/server/rbac/guard";
import { ok } from "@/server/lib/http";
import { overviewQuerySchema } from "@/server/modules/inventaris/checklist.schema";
import { listChecklist } from "@/server/modules/inventaris/checklist.service";

export const runtime = "nodejs";

/** GET /api/inventaris/pemeliharaan/checklist — daftar barang + status periksa satu ruangan/frekuensi. */
export const GET = withPermission("inventaris.pemeliharaan", "view", async (req: NextRequest) => {
  const q = overviewQuerySchema.parse(Object.fromEntries(req.nextUrl.searchParams));
  return ok(await listChecklist(q));
});

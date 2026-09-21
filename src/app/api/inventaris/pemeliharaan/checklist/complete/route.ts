import { NextRequest } from "next/server";
import { withPermission } from "@/server/rbac/guard";
import { ok } from "@/server/lib/http";
import { completeSchema } from "@/server/modules/inventaris/checklist.schema";
import { completeRun } from "@/server/modules/inventaris/checklist.service";

export const runtime = "nodejs";

/** POST /api/inventaris/pemeliharaan/checklist/complete — tandai seluruh ruangan selesai / batalkan. */
export const POST = withPermission("inventaris.pemeliharaan", "create", async (req: NextRequest, _ctx, user) => {
  const input = completeSchema.parse(await req.json());
  return ok(await completeRun(input, user));
});

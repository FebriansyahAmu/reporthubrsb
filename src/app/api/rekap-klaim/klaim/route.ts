import { NextRequest } from "next/server";
import { withPermission } from "@/server/rbac/guard";
import { ok } from "@/server/lib/http";
import { klaimCreateSchema, klaimListQuerySchema } from "@/server/modules/rekap-klaim/klaim.schema";
import { createKlaim, listKlaim } from "@/server/modules/rekap-klaim/klaim.service";

export const runtime = "nodejs";

/** GET /api/rekap-klaim/klaim — daftar klaim (filter). */
export const GET = withPermission("rekap-klaim.data", "view", async (req: NextRequest) => {
  const q = klaimListQuerySchema.parse(Object.fromEntries(req.nextUrl.searchParams));
  const result = await listKlaim(q);
  return ok(result.data, result.meta);
});

/** POST /api/rekap-klaim/klaim — tambah klaim. */
export const POST = withPermission("rekap-klaim.data", "create", async (req: NextRequest, _ctx, user) => {
  const input = klaimCreateSchema.parse(await req.json());
  return ok(await createKlaim(input, user));
});

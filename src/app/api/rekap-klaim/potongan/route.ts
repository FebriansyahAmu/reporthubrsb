import { NextRequest } from "next/server";
import { withPermission } from "@/server/rbac/guard";
import { ok } from "@/server/lib/http";
import { ValidationError } from "@/server/lib/errors";
import { potonganCreateSchema } from "@/server/modules/rekap-klaim/klaim.schema";
import { createPotongan, listPotongan } from "@/server/modules/rekap-klaim/potongan.service";

export const runtime = "nodejs";

/** GET /api/rekap-klaim/potongan?klaimId=… — daftar potongan sebuah klaim. */
export const GET = withPermission("rekap-klaim.data", "view", async (req: NextRequest) => {
  const klaimId = req.nextUrl.searchParams.get("klaimId")?.trim();
  if (!klaimId) throw new ValidationError([{ path: ["klaimId"], message: "klaimId wajib." }]);
  const result = await listPotongan(klaimId);
  return ok(result.data, result.meta);
});

/** POST /api/rekap-klaim/potongan — tambah potongan pada sebuah klaim. */
export const POST = withPermission("rekap-klaim.data", "create", async (req: NextRequest, _ctx, user) => {
  const input = potonganCreateSchema.parse(await req.json());
  return ok(await createPotongan(input, user));
});

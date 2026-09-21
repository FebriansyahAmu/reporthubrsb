import { NextRequest } from "next/server";
import { withPermission } from "@/server/rbac/guard";
import { ok } from "@/server/lib/http";
import { periksaSchema } from "@/server/modules/inventaris/checklist.schema";
import { periksaBarang } from "@/server/modules/inventaris/checklist.service";

export const runtime = "nodejs";

/** POST /api/inventaris/pemeliharaan/checklist/periksa — centang/ubah pemeriksaan 1 barang. */
export const POST = withPermission("inventaris.pemeliharaan", "create", async (req: NextRequest, _ctx, user) => {
  const input = periksaSchema.parse(await req.json());
  return ok(await periksaBarang(input, user));
});

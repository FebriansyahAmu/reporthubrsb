import { NextRequest } from "next/server";
import { withPermission } from "@/server/rbac/guard";
import { ok } from "@/server/lib/http";
import { ValidationError } from "@/server/lib/errors";
import { previewNextKode } from "@/server/modules/inventaris/barang.service";

export const runtime = "nodejs";

/** GET /api/inventaris/barang/next-kode?ruanganId= — preview kode berikutnya. */
export const GET = withPermission("inventaris.barang", "view", async (req: NextRequest) => {
  const ruanganId = req.nextUrl.searchParams.get("ruanganId")?.trim();
  if (!ruanganId) throw new ValidationError({ ruanganId: ["Ruangan wajib dipilih."] });
  return ok(await previewNextKode(ruanganId));
});

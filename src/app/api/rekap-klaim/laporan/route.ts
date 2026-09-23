import { NextRequest } from "next/server";
import { withPermission } from "@/server/rbac/guard";
import { ok } from "@/server/lib/http";
import { getLaporan } from "@/server/modules/rekap-klaim/laporan.service";

export const runtime = "nodejs";

/** GET /api/rekap-klaim/laporan?tahun=YYYY|semua — rekap tahunan, perbandingan, pending, rujukan. */
export const GET = withPermission("rekap-klaim.laporan", "view", async (req: NextRequest) => {
  const t = req.nextUrl.searchParams.get("tahun");
  const tahunParam = t === "semua" ? "semua" : t && /^\d{4}$/.test(t) ? Number(t) : undefined;
  return ok(await getLaporan(tahunParam));
});

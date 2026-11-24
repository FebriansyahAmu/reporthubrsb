import { NextRequest } from "next/server";
import { withPermission } from "@/server/rbac/guard";
import { TooManyRequestsError } from "@/server/lib/errors";
import { ok, tanpaCache } from "@/server/lib/http";
import { buatPembatasLaju } from "@/server/lib/rate-limit";
import { pulangQuerySchema } from "@/server/modules/surat-kontrol/surat-kontrol.schema";
import { getAuditTerbitPulang } from "@/server/modules/surat-kontrol/surat-kontrol.pulang.service";

export const runtime = "nodejs";

/** Sama dengan audit utama: permintaan bisa memicu webservice BPJS (yang menulis cache SIMGOS). */
const batasLaju = buatPembatasLaju({ batas: 30, jendelaMs: 60_000, maksKunci: 1_000 });

/**
 * GET /api/audit-rme/surat-kontrol/pulang?from&to&segar=1
 * Kepatuhan "Surat Kontrol terbit di hari pulang" — pasien BPJS rawat inap & rawat jalan.
 * Read-only terhadap SIMGOS. Berisi data pasien → no-store.
 */
export const GET = withPermission("audit-rme.surat-kontrol", "view", async (req: NextRequest, _ctx, user) => {
  const laju = batasLaju(user.id);
  if (!laju.izin) throw new TooManyRequestsError(laju.ulangDetik);
  const q = pulangQuerySchema.parse(Object.fromEntries(req.nextUrl.searchParams));
  return tanpaCache(ok(await getAuditTerbitPulang(q)));
});

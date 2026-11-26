import { NextRequest } from "next/server";
import { withPermission } from "@/server/rbac/guard";
import { TooManyRequestsError } from "@/server/lib/errors";
import { ok, tanpaCache } from "@/server/lib/http";
import { buatPembatasLaju } from "@/server/lib/rate-limit";
import { sepQuerySchema } from "@/server/modules/surat-kontrol/surat-kontrol.schema";
import { getAuditKontrolSep } from "@/server/modules/surat-kontrol/surat-kontrol.sep.service";

export const runtime = "nodejs";

/** Sama dengan audit lain: permintaan bisa memicu webservice BPJS (yang menulis cache SIMGOS). */
const batasLaju = buatPembatasLaju({ batas: 30, jendelaMs: 60_000, maksKunci: 1_000 });

/**
 * GET /api/audit-rme/surat-kontrol/sep?from&to&segar=1
 * "Kontrol = SEP": tanggal entri surat (Surat Kontrol / SPRI) di BPJS vs tanggal
 * SEP yang memakainya. Read-only terhadap SIMGOS. Berisi data pasien → no-store.
 */
export const GET = withPermission("audit-rme.surat-kontrol", "view", async (req: NextRequest, _ctx, user) => {
  const laju = batasLaju(user.id);
  if (!laju.izin) throw new TooManyRequestsError(laju.ulangDetik);
  const q = sepQuerySchema.parse(Object.fromEntries(req.nextUrl.searchParams));
  return tanpaCache(ok(await getAuditKontrolSep(q)));
});

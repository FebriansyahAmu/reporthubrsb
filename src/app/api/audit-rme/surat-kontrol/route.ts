import { NextRequest } from "next/server";
import { withPermission } from "@/server/rbac/guard";
import { TooManyRequestsError } from "@/server/lib/errors";
import { ok, tanpaCache } from "@/server/lib/http";
import { buatPembatasLaju } from "@/server/lib/rate-limit";
import { suratKontrolQuerySchema } from "@/server/modules/surat-kontrol/surat-kontrol.schema";
import { getAuditSuratKontrol } from "@/server/modules/surat-kontrol/surat-kontrol.service";

export const runtime = "nodejs";

/**
 * Batas per pengguna: setiap permintaan bisa memicu panggilan webservice BPJS
 * (yang juga menulis cache SIMGOS). Saringan layar diproses di klien, jadi
 * pemakaian normal jauh di bawah batas ini.
 */
const batasLaju = buatPembatasLaju({ batas: 30, jendelaMs: 60_000, maksKunci: 1_000 });

/**
 * GET /api/audit-rme/surat-kontrol?from&to&jenis=2|1|semua&segar=1
 * Audit Surat Kontrol/SPRI: BPJS (webservice, real-time) ↔ jadwal SIMRS ↔ catatan lokal.
 * Read-only terhadap SIMGOS. Berisi data pasien → no-store.
 */
export const GET = withPermission("audit-rme.surat-kontrol", "view", async (req: NextRequest, _ctx, user) => {
  const laju = batasLaju(user.id);
  if (!laju.izin) throw new TooManyRequestsError(laju.ulangDetik);
  const q = suratKontrolQuerySchema.parse(Object.fromEntries(req.nextUrl.searchParams));
  return tanpaCache(ok(await getAuditSuratKontrol(q)));
});

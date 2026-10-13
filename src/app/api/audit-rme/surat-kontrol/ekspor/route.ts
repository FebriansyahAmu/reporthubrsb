import { NextRequest } from "next/server";
import { withPermission } from "@/server/rbac/guard";
import { clientIp } from "@/server/lib/request";
import { eksporQuerySchema } from "@/server/modules/surat-kontrol/surat-kontrol.schema";
import { buatEksporSuratKontrol } from "@/server/modules/surat-kontrol/surat-kontrol.ekspor";

export const runtime = "nodejs";

/**
 * GET /api/audit-rme/surat-kontrol/ekspor?from&to&jenis&status&temuan&poli&q
 * Ekspor Excel (izin `audit-rme.surat-kontrol:print`), isi = filter layar.
 * Dicatat di meta-audit — gagal mencatat = berkas tidak diserahkan.
 */
export const GET = withPermission("audit-rme.surat-kontrol", "print", async (req: NextRequest, _ctx, user) => {
  const q = eksporQuerySchema.parse(Object.fromEntries(req.nextUrl.searchParams));
  const f = await buatEksporSuratKontrol(q, user, clientIp(req));
  return new Response(new Uint8Array(f.buffer), {
    status: 200,
    headers: {
      "Content-Type": f.contentType,
      "Content-Disposition": `attachment; filename="${f.namaBerkas}"`,
      "Content-Length": String(f.buffer.length),
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      "X-Ekspor-Kode": f.kode,
    },
  });
});

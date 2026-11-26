import { NextRequest } from "next/server";
import { withPermission } from "@/server/rbac/guard";
import { clientIp } from "@/server/lib/request";
import { eksporSepQuerySchema } from "@/server/modules/surat-kontrol/surat-kontrol.schema";
import { buatEksporKontrolSep } from "@/server/modules/surat-kontrol/surat-kontrol.ekspor";

export const runtime = "nodejs";

/**
 * GET /api/audit-rme/surat-kontrol/sep/ekspor?from&to&spri&jenis&status&ruangan&tanggal&q
 * Ekspor Excel "Kontrol = SEP" (izin `audit-rme.surat-kontrol:print`), isi = filter layar.
 * Dicatat di meta-audit — gagal mencatat = berkas tidak diserahkan.
 */
export const GET = withPermission("audit-rme.surat-kontrol", "print", async (req: NextRequest, _ctx, user) => {
  const q = eksporSepQuerySchema.parse(Object.fromEntries(req.nextUrl.searchParams));
  const f = await buatEksporKontrolSep(q, user, clientIp(req));
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

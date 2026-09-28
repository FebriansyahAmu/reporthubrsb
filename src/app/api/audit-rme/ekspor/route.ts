import { NextRequest } from "next/server";
import { withPermission } from "@/server/rbac/guard";
import { clientIp } from "@/server/lib/request";
import { eksporQuerySchema } from "@/server/modules/audit-rme/ekspor.schema";
import { buatEkspor } from "@/server/modules/audit-rme/ekspor.service";

export const runtime = "nodejs";

/**
 * GET /api/audit-rme/ekspor?laporan=…&format=xlsx|pdf&<filter layar sumber>
 * Ekspor Excel/PDF (izin `audit-rme:print`). Setiap berkas dicatat di meta-audit
 * (`audit_log`) — gagal mencatat = berkas tidak diserahkan.
 */
export const GET = withPermission("audit-rme", "print", async (req: NextRequest, _ctx, user) => {
  const q = eksporQuerySchema.parse(Object.fromEntries(req.nextUrl.searchParams));
  const f = await buatEkspor(q, user, clientIp(req));
  return new Response(new Uint8Array(f.buffer), {
    status: 200,
    headers: {
      "Content-Type": f.contentType,
      "Content-Disposition": `attachment; filename="${f.namaBerkas}"`,
      "Content-Length": String(f.buffer.length),
      "Cache-Control": "no-store",
      "X-Ekspor-Kode": f.kode,
    },
  });
});

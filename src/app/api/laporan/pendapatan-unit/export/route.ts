import { NextRequest } from "next/server";
import { buatEksporPendapatan } from "@/server/modules/pendapatan-unit/pendapatan.export";
import { eksporQuerySchema, pendapatanQuerySchema } from "@/server/modules/pendapatan-unit/pendapatan.schema";
import { authorize } from "@/server/rbac/guard";
import { fail } from "@/server/lib/http";
import { clientIp } from "@/server/lib/request";

export const runtime = "nodejs";

/**
 * GET /api/laporan/pendapatan-unit/export?format=xlsx|pdf&from&to[&layanan&status&caraBayar&ruangan]
 * Unduh Laporan Pendapatan per Unit (Excel lengkap / PDF ringkas). Butuh izin
 * `laporan.pendapatan:print`; setiap ekspor tercatat di audit (fail-closed).
 */
export async function GET(req: NextRequest) {
  try {
    const user = await authorize("laporan.pendapatan", "print");
    const params = Object.fromEntries(req.nextUrl.searchParams);
    const input = pendapatanQuerySchema.parse(params);
    const { format } = eksporQuerySchema.parse(params);
    const berkas = await buatEksporPendapatan(input, format, user, clientIp(req));
    return new Response(new Uint8Array(berkas.buffer), {
      status: 200,
      headers: {
        "Content-Type": berkas.contentType,
        "Content-Disposition": `attachment; filename="${berkas.namaBerkas}"`,
        "Content-Length": String(berkas.buffer.length),
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (err) {
    return fail(err);
  }
}

import { NextRequest } from "next/server";
import { obatTerbanyakQuerySchema, parseKategoriCsv } from "@/server/modules/farmasi/farmasi.schema";
import { getObatTerbanyak } from "@/server/modules/farmasi/farmasi.service";
import { buildObatExcel } from "@/server/modules/farmasi/farmasi.excel";
import { authorize } from "@/server/rbac/guard";
import { fail } from "@/server/lib/http";

export const runtime = "nodejs";

const p2 = (n: number) => String(n).padStart(2, "0");
function stamp(now: Date): string {
  const w = new Date(now.getTime() + 8 * 3600 * 1000); // WITA
  return `${w.getUTCFullYear()}${p2(w.getUTCMonth() + 1)}${p2(w.getUTCDate())}`;
}
const JENIS_SUFFIX: Record<number, string> = { 0: "", 1: "_RJ", 2: "_IGD", 3: "_RI" };

/**
 * GET /api/laporan/farmasi-obat/export?from&to[&jenis&caraBayar&kategori&metric]
 * Export "10 Obat Terbanyak" sesuai filter → file .xlsx rapi. Read-only SIMGOS.
 */
export async function GET(req: NextRequest) {
  try {
    const user = await authorize("laporan", "view");
    const input = obatTerbanyakQuerySchema.parse(Object.fromEntries(req.nextUrl.searchParams));
    const result = await getObatTerbanyak(input);
    const generatedAt = new Date();
    const buf = await buildObatExcel(result, {
      generatedAt,
      by: user.name,
      kategoriCount: parseKategoriCsv(input.kategori).length,
    });
    const filename = `10-Obat-Terbanyak_${input.from}_sd_${input.to}${JENIS_SUFFIX[input.jenis] ?? ""}_${stamp(generatedAt)}.xlsx`;
    return new Response(new Uint8Array(buf), {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": String(buf.length),
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    return fail(err);
  }
}

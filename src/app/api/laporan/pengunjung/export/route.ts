import { NextRequest } from "next/server";
import { pengunjungQuerySchema } from "@/server/modules/pengunjung/pengunjung.schema";
import { getPengunjungExport, getRuanganOptions } from "@/server/modules/pengunjung/pengunjung.service";
import { buildPengunjungExcel } from "@/server/modules/pengunjung/pengunjung.excel";
import { authorize } from "@/server/rbac/guard";
import { fail } from "@/server/lib/http";

export const runtime = "nodejs";

const p2 = (n: number) => String(n).padStart(2, "0");
function stamp(now: Date): string {
  const w = new Date(now.getTime() + 8 * 3600 * 1000); // WITA
  return `${w.getUTCFullYear()}${p2(w.getUTCMonth() + 1)}${p2(w.getUTCDate())}`;
}
const JENIS_SUFFIX: Record<number, string> = { 1: "RJ", 2: "IGD", 3: "RI" };

/**
 * GET /api/laporan/pengunjung/export?from&to[&jenis&ruangan&caraBayar&tindak]
 * Export SELURUH baris cocok filter (tanpa paginasi) → file .xlsx rapi.
 */
export async function GET(req: NextRequest) {
  try {
    const user = await authorize("laporan", "view");
    const input = pengunjungQuerySchema.parse(Object.fromEntries(req.nextUrl.searchParams));
    const exp = await getPengunjungExport(input);

    let ruanganNama: string | undefined;
    if (input.ruangan) {
      const opts = await getRuanganOptions();
      ruanganNama = opts.find((o) => o.id === input.ruangan)?.nama ?? input.ruangan;
    }

    const generatedAt = new Date();
    const buf = await buildPengunjungExcel(exp, { generatedAt, by: user.name, ruanganNama });
    const filename = `Laporan-Pengunjung_${JENIS_SUFFIX[input.jenis] ?? ""}_${input.from}_sd_${input.to}_${stamp(generatedAt)}.xlsx`;
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

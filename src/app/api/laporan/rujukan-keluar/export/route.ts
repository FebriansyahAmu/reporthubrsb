import { NextRequest } from "next/server";
import { rujukanKeluarQuerySchema } from "@/server/modules/rujukan/rujukan.schema";
import { getRujukanKeluarExport } from "@/server/modules/rujukan/rujukan.service";
import { buildRujukanExcel } from "@/server/modules/rujukan/rujukan.excel";
import { authorize } from "@/server/rbac/guard";
import { fail } from "@/server/lib/http";

export const runtime = "nodejs";

const p2 = (n: number) => String(n).padStart(2, "0");

function buildFilename(input: { from?: string; to?: string; jnsPelayanan?: number }, now: Date): string {
  const w = new Date(now.getTime() + 8 * 3600 * 1000); // WITA
  const stamp = `${w.getUTCFullYear()}${p2(w.getUTCMonth() + 1)}${p2(w.getUTCDate())}`;
  const range = input.from || input.to ? `_${input.from || "awal"}_sd_${input.to || "terkini"}` : "";
  const jenis = input.jnsPelayanan === 1 ? "_RI" : input.jnsPelayanan === 2 ? "_RJ" : "";
  return `Rujukan-Keluar${range}${jenis}_${stamp}.xlsx`;
}

/**
 * GET /api/laporan/rujukan-keluar/export[?from&to&jnsPelayanan&search]
 * Export SELURUH rujukan yang cocok filter (tanpa paginasi) → file .xlsx rapi.
 */
export async function GET(req: NextRequest) {
  try {
    const user = await authorize("laporan", "view");
    const input = rujukanKeluarQuerySchema.parse(Object.fromEntries(req.nextUrl.searchParams));

    const rows = await getRujukanKeluarExport(input);
    const generatedAt = new Date();
    const buf = await buildRujukanExcel(rows, {
      from: input.from,
      to: input.to,
      jenisLabel:
        input.jnsPelayanan === 1 ? "Rawat Inap" : input.jnsPelayanan === 2 ? "Rawat Jalan" : undefined,
      search: input.search,
      total: rows.length,
      generatedAt,
      by: user.name,
    });

    const filename = buildFilename(input, generatedAt);
    return new Response(new Uint8Array(buf), {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": String(buf.length),
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    return fail(err);
  }
}

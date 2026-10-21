import { NextRequest } from "next/server";
import { domisiliQuerySchema } from "@/server/modules/domisili/domisili.schema";
import { getDomisili } from "@/server/modules/domisili/domisili.service";
import { buildDomisiliExcel } from "@/server/modules/domisili/domisili.excel";
import { authorize } from "@/server/rbac/guard";
import { fail } from "@/server/lib/http";

export const runtime = "nodejs";

const p2 = (n: number) => String(n).padStart(2, "0");
function stamp(now: Date): string {
  const w = new Date(now.getTime() + 8 * 3600 * 1000); // WITA
  return `${w.getUTCFullYear()}${p2(w.getUTCMonth() + 1)}${p2(w.getUTCDate())}`;
}

/**
 * GET /api/laporan/domisili/export?from&to
 * Unduh .xlsx (Ringkasan, Dalam Kabupaten per kecamatan, Luar Kabupaten per
 * kabupaten/kota). Memakai hasil yang sama dengan tampilan (cache 60 dtk).
 */
export async function GET(req: NextRequest) {
  try {
    const user = await authorize("laporan", "view");
    const input = domisiliQuerySchema.parse(Object.fromEntries(req.nextUrl.searchParams));
    const data = await getDomisili(input);
    const generatedAt = new Date();
    const buf = await buildDomisiliExcel(data, { generatedAt, by: user.name });
    // Nama berkas hanya dari tanggal tervalidasi (YYYY-MM-DD) → aman di header.
    const filename = `Klasifikasi-Kunjungan-Domisili_${input.from}_sd_${input.to}_${stamp(generatedAt)}.xlsx`;
    return new Response(new Uint8Array(buf), {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": String(buf.length),
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (err) {
    return fail(err);
  }
}

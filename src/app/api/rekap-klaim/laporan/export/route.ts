import { NextRequest } from "next/server";
import { authorize } from "@/server/rbac/guard";
import { fail } from "@/server/lib/http";
import { getLaporan } from "@/server/modules/rekap-klaim/laporan.service";
import { buildLaporanExcel, buildLaporanPdf } from "@/server/modules/rekap-klaim/laporan.export";

export const runtime = "nodejs";

const p2 = (n: number) => String(n).padStart(2, "0");
function stamp(now: Date): string {
  const w = new Date(now.getTime() + 8 * 3600 * 1000); // WITA
  return `${w.getUTCFullYear()}${p2(w.getUTCMonth() + 1)}${p2(w.getUTCDate())}`;
}

/**
 * GET /api/rekap-klaim/laporan/export?tahun=YYYY|semua&format=xlsx|pdf
 * Export rekap klaim: `format=pdf` → dokumen PDF resmi (landscape), selain itu
 * → workbook .xlsx multi-sheet (Rekap tahunan, Bulanan, Perbandingan, Pending,
 * Rujukan). Data dari app DB (reporthub).
 */
export async function GET(req: NextRequest) {
  try {
    const user = await authorize("rekap-klaim.laporan", "print");
    const t = req.nextUrl.searchParams.get("tahun");
    const tahunParam = t === "semua" ? "semua" : t && /^\d{4}$/.test(t) ? Number(t) : undefined;
    const isPdf = req.nextUrl.searchParams.get("format") === "pdf";

    const data = await getLaporan(tahunParam);
    const generatedAt = new Date();
    const scope = data.tahun ? String(data.tahun) : "semua-tahun";
    const base = `Rekap-Klaim-BPJS_${scope}_${stamp(generatedAt)}`;

    if (isPdf) {
      const buf = await buildLaporanPdf(data, { generatedAt, by: user.name });
      return new Response(new Uint8Array(buf), {
        status: 200,
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="${base}.pdf"`,
          "Content-Length": String(buf.length),
          "Cache-Control": "no-store",
        },
      });
    }

    const buf = await buildLaporanExcel(data, { generatedAt, by: user.name });
    return new Response(new Uint8Array(buf), {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${base}.xlsx"`,
        "Content-Length": String(buf.length),
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    return fail(err);
  }
}

import { NextRequest } from "next/server";
import { REPORTS } from "@/server/modules/report/report.registry";
import { getSimgosReportPdf } from "@/server/modules/report/report-engine";
import { querySepByNopen } from "@/server/modules/berkas-klaim/berkas-klaim.dal";

export const runtime = "nodejs";

/**
 * GET /api/print/simgos/[report]/[nopen]
 * Proxy READ-ONLY ke report engine SIMGOS → stream PDF resmi (inline di browser).
 *
 * Untuk report ber-`param: "sep"` (mis. Cetak SEP), NOPEN di URL diresolusikan
 * dulu menjadi NOMOR SEP via `querySepByNopen` sebelum payload dibangun.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ report: string; nopen: string }> },
) {
  const { report, nopen } = await params;

  const def = REPORTS[report];
  if (!def) {
    return new Response("Report tidak dikenal.", { status: 404 });
  }
  if (!/^\d{6,12}$/.test(nopen)) {
    return new Response("NOPEN tidak valid.", { status: 400 });
  }

  // Resolusi kunci payload: NOPEN langsung, atau NOMOR SEP untuk report SEP.
  let key = nopen;
  if (def.param === "sep") {
    const sep = await querySepByNopen(nopen).catch(() => null);
    if (!sep) {
      return new Response("SEP tidak ditemukan untuk NOPEN ini.", { status: 404 });
    }
    key = sep;
  }

  // ?dl=1 → paksa unduh (attachment); default = inline agar preview di viewer.
  const disposition = req.nextUrl.searchParams.get("dl") === "1" ? "attachment" : "inline";

  try {
    const pdf = await getSimgosReportPdf(def.build(key));
    return new Response(pdf, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `${disposition}; filename="${report}-${nopen}.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("[print/simgos] gagal:", err);
    return new Response(
      "Gagal mengambil dokumen dari SIMGOS. Coba lagi atau pastikan report engine aktif.",
      { status: 502 },
    );
  }
}

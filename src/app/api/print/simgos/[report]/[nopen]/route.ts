import { NextRequest } from "next/server";
import { REPORTS, buildReportPayloads } from "@/server/modules/report/report.registry";
import { getSimgosReportPdfMerged } from "@/server/modules/report/report-engine";
import { getCurrentUser } from "@/server/auth/session";
import { can } from "@/server/rbac/permissions";

export const runtime = "nodejs";

/**
 * GET /api/print/simgos/[report]/[nopen]
 * Proxy READ-ONLY ke report engine SIMGOS → stream PDF resmi (inline di browser).
 *
 * Tiap report me-resolve parameternya sendiri dari NOPEN (`def.build`): Resume
 * Medis (PNOPEN), SEP (resolve nomor SEP), CPPT (resolve KUNJUNGAN). Bila payload
 * `null` → dokumen tak tersedia untuk NOPEN ini (mis. tanpa SEP/CPPT) → 404.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ report: string; nopen: string }> },
) {
  // Authz: cetak dokumen SIMGOS = izin cetak berkas klaim.
  const user = await getCurrentUser();
  if (!user) return new Response("Belum login.", { status: 401 });
  if (!(await can(user.role, "berkas-klaim", "print"))) {
    return new Response("Tidak memiliki akses.", { status: 403 });
  }

  const { report, nopen } = await params;

  const def = REPORTS[report];
  if (!def) {
    return new Response("Report tidak dikenal.", { status: 404 });
  }
  if (!/^\d{6,12}$/.test(nopen)) {
    return new Response("NOPEN tidak valid.", { status: 400 });
  }

  // ?dl=1 → paksa unduh (attachment); default = inline agar preview di viewer.
  const disposition = req.nextUrl.searchParams.get("dl") === "1" ? "attachment" : "inline";
  // ?igd=1 → khusus CPPT: gabungkan CPPT leg IGD asal (RI) ke dalam satu PDF.
  const includeIgd = req.nextUrl.searchParams.get("igd") === "1";

  try {
    const payloads = await buildReportPayloads(report, nopen, { includeIgd });
    if (!payloads || payloads.length === 0) {
      return new Response("Dokumen tidak tersedia untuk NOPEN ini.", { status: 404 });
    }
    const pdf = await getSimgosReportPdfMerged(payloads);
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

import { authorize } from "@/server/rbac/guard";
import { fail } from "@/server/lib/http";
import { buildImportTemplate } from "@/server/modules/rekap-klaim/klaim.import";

export const runtime = "nodejs";

/** GET /api/rekap-klaim/import/template — unduh template .xlsx (Klaim + Potongan + Petunjuk). */
export async function GET() {
  try {
    await authorize("rekap-klaim.data", "view");
    const buf = await buildImportTemplate();
    return new Response(new Uint8Array(buf), {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="Template-Import-Rekap-Klaim.xlsx"`,
        "Content-Length": String(buf.length),
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    return fail(err);
  }
}

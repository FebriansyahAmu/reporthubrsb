import { authorize } from "@/server/rbac/guard";
import { fail } from "@/server/lib/http";
import { getFormRefs } from "@/server/modules/inventaris/barang.service";
import { buildImportTemplate } from "@/server/modules/inventaris/barang.excel";

export const runtime = "nodejs";

/** GET /api/inventaris/barang/import/template — unduh template .xlsx (berisi referensi valid). */
export async function GET() {
  try {
    await authorize("inventaris.barang", "view");
    const refs = await getFormRefs();
    const buf = await buildImportTemplate(refs);
    return new Response(new Uint8Array(buf), {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="Template-Import-Barang.xlsx"`,
        "Content-Length": String(buf.length),
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    return fail(err);
  }
}

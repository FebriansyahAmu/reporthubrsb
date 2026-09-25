import { NextRequest } from "next/server";
import { authorize } from "@/server/rbac/guard";
import { fail } from "@/server/lib/http";
import { exportQuerySchema } from "@/server/modules/inventaris/checklist.schema";
import { listRiwayat, periodeDetail } from "@/server/modules/inventaris/checklist.service";
import { buildChecklistPeriodeExcel, buildRiwayatExcel } from "@/server/modules/inventaris/checklist.excel";

export const runtime = "nodejs";

const p2 = (n: number) => String(n).padStart(2, "0");
function stamp(now: Date): string {
  const w = new Date(now.getTime() + 8 * 3600 * 1000); // WITA
  return `${w.getUTCFullYear()}${p2(w.getUTCMonth() + 1)}${p2(w.getUTCDate())}`;
}
const safe = (s: string) => s.replace(/[^\w.-]+/g, "_").replace(/^_+|_+$/g, "");

/**
 * GET /api/inventaris/pemeliharaan/checklist/export
 * mode=periode (default): detail checklist satu periode (query periodeKey opsional).
 * mode=riwayat: ringkasan seluruh riwayat pelaksanaan.
 */
export async function GET(req: NextRequest) {
  try {
    const user = await authorize("inventaris.pemeliharaan", "view");
    const q = exportQuerySchema.parse(Object.fromEntries(req.nextUrl.searchParams));
    const generatedAt = new Date();
    const meta = { generatedAt, by: user.name };

    let buf: Buffer;
    let filename: string;
    if (q.mode === "riwayat") {
      const ov = await listRiwayat({ ruanganId: q.ruanganId, frekuensi: q.frekuensi, limit: q.limit });
      buf = await buildRiwayatExcel(ov, meta);
      filename = `Riwayat-Checklist_${safe(ov.ruangan.kodePrefix)}_${q.frekuensi}_${stamp(generatedAt)}.xlsx`;
    } else {
      const detail = await periodeDetail(q.ruanganId, q.frekuensi, q.periodeKey);
      buf = await buildChecklistPeriodeExcel(detail, meta);
      const per = safe(detail.periodeKey);
      filename = `Checklist_${safe(detail.ruangan.kodePrefix)}_${q.frekuensi}_${per}.xlsx`;
    }

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

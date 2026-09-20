import { NextRequest } from "next/server";
import { authorize } from "@/server/rbac/guard";
import { fail } from "@/server/lib/http";
import { getKirData } from "@/server/modules/inventaris/kir.service";
import { buildKirPdf } from "@/server/modules/inventaris/kir.pdf";

export const runtime = "nodejs";

const p2 = (n: number) => String(n).padStart(2, "0");
function stamp(now: Date): string {
  const w = new Date(now.getTime() + 8 * 3600 * 1000); // WITA
  return `${w.getUTCFullYear()}${p2(w.getUTCMonth() + 1)}${p2(w.getUTCDate())}`;
}

type Ctx = { params: Promise<{ ruanganId: string }> };

/** GET /api/inventaris/kir/[ruanganId]/pdf — cetak KIR resmi (PDF, ber-TTD PJ). */
export async function GET(_req: NextRequest, ctx: Ctx) {
  try {
    const user = await authorize("inventaris.kir", "print");
    const { ruanganId } = await ctx.params;
    const data = await getKirData(ruanganId);
    const generatedAt = new Date();
    const buf = await buildKirPdf(data, { generatedAt, by: user.name });
    const filename = `KIR_${data.ruangan.kodePrefix}_${stamp(generatedAt)}.pdf`;
    return new Response(new Uint8Array(buf), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": String(buf.length),
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    return fail(err);
  }
}

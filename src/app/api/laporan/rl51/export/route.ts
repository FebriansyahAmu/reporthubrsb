import { NextRequest } from "next/server";
import { rl51QuerySchema } from "@/server/modules/rl51/rl51.schema";
import { getRl51 } from "@/server/modules/rl51/rl51.service";
import { buildRl51Excel } from "@/server/modules/rl51/rl51.excel";
import { authorize } from "@/server/rbac/guard";
import { fail } from "@/server/lib/http";

export const runtime = "nodejs";

const p2 = (n: number) => String(n).padStart(2, "0");
function stamp(now: Date): string {
  const w = new Date(now.getTime() + 8 * 3600 * 1000); // WITA
  return `${w.getUTCFullYear()}${p2(w.getUTCMonth() + 1)}${p2(w.getUTCDate())}`;
}

/**
 * GET /api/laporan/rl51/export?from&to
 * Export RL 5.1 → file .xlsx (matriks 25 kelompok umur × L/P kasus baru +
 * kunjungan). Read-only SIMGOS.
 */
export async function GET(req: NextRequest) {
  try {
    const user = await authorize("laporan", "view");
    const input = rl51QuerySchema.parse(Object.fromEntries(req.nextUrl.searchParams));
    const result = await getRl51(input);
    const generatedAt = new Date();
    const buf = await buildRl51Excel(result, { generatedAt, by: user.name });
    const filename = `RL-5.1_${input.from}_sd_${input.to}_${stamp(generatedAt)}.xlsx`;
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

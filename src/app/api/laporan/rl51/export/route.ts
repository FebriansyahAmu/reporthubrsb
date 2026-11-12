import { NextRequest } from "next/server";
import { rl51QuerySchema } from "@/server/modules/rl51/rl51.schema";
import { getRl51 } from "@/server/modules/rl51/rl51.service";
import { buildRl51Excel } from "@/server/modules/rl51/rl51.excel";
import { buildRl51Pdf } from "@/server/modules/rl51/rl51.pdf";
import { authorize } from "@/server/rbac/guard";
import { fail } from "@/server/lib/http";
import { rlEksporOpsiSchema } from "@/server/lib/rl-kelompok-umur";

export const runtime = "nodejs";

const p2 = (n: number) => String(n).padStart(2, "0");
function stamp(now: Date): string {
  const w = new Date(now.getTime() + 8 * 3600 * 1000); // WITA
  return `${w.getUTCFullYear()}${p2(w.getUTCMonth() + 1)}${p2(w.getUTCDate())}`;
}

/**
 * GET /api/laporan/rl51/export?from&to[&menular&format&umur]
 * Export RL 5.1: `format=pdf` → PDF ringkas (rapi), selain itu → .xlsx (matriks
 * 25 kelompok umur × L/P kasus baru + kunjungan). Read-only SIMGOS.
 */
export async function GET(req: NextRequest) {
  try {
    const user = await authorize("laporan", "view");
    const input = rl51QuerySchema.parse(Object.fromEntries(req.nextUrl.searchParams));
    // Kolom umur Excel: `semua` (bawaan, 25 kelompok) | `terisi` (sembunyikan kelompok bernilai 0).
    const opsi = rlEksporOpsiSchema.parse({ umur: req.nextUrl.searchParams.get("umur") ?? undefined });
    const isPdf = req.nextUrl.searchParams.get("format") === "pdf";
    const result = await getRl51(input);
    const generatedAt = new Date();
    const base = `RL-5.1_${input.from}_sd_${input.to}_${stamp(generatedAt)}`;

    if (isPdf) {
      const buf = await buildRl51Pdf(result, { generatedAt, by: user.name });
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

    const buf = await buildRl51Excel(result, { generatedAt, by: user.name }, { umur: opsi.umur });
    return new Response(new Uint8Array(buf), {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${base}${opsi.umur === "terisi" ? "_umur-terisi" : ""}.xlsx"`,
        "Content-Length": String(buf.length),
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    return fail(err);
  }
}

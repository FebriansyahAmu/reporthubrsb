import { NextRequest } from "next/server";
import { eksporRl32Schema, rl32QuerySchema } from "@/server/modules/rl32/rl32.schema";
import { getRl32 } from "@/server/modules/rl32/rl32.service";
import { namaBerkasRl32 } from "@/server/modules/rl32/rl32.dokumen";
import { buildRl32Excel } from "@/server/modules/rl32/rl32.excel";
import { buildRl32Pdf } from "@/server/modules/rl32/rl32.pdf";
import { authorize } from "@/server/rbac/guard";
import { berkasResponse, fail } from "@/server/lib/http";

export const runtime = "nodejs";

const MIME = {
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  pdf: "application/pdf",
} as const;

/**
 * GET /api/laporan/rl32/export?from&to[&format=xlsx|pdf]
 * Unduh RL 3.2: Excel (37 jenis pelayanan + per ruangan, rinci L/P) atau PDF
 * ringkas. Data agregat (tanpa identitas pasien); izin sama dengan RL 4.1/5.1.
 */
export async function GET(req: NextRequest) {
  try {
    const user = await authorize("laporan", "view");
    const params = Object.fromEntries(req.nextUrl.searchParams);
    const input = rl32QuerySchema.parse(params);
    const { format } = eksporRl32Schema.parse(params);
    const result = await getRl32(input);
    const meta = { generatedAt: new Date(), by: user.name };
    const buf = format === "pdf" ? await buildRl32Pdf(result, meta) : await buildRl32Excel(result, meta);
    return berkasResponse(new Uint8Array(buf), { mime: MIME[format], nama: namaBerkasRl32(result, format), unduh: true });
  } catch (err) {
    return fail(err);
  }
}

import { NextRequest } from "next/server";
import { eksporRl35Schema, rl35QuerySchema } from "@/server/modules/rl35/rl35.schema";
import { getRl35 } from "@/server/modules/rl35/rl35.service";
import { namaBerkasRl35 } from "@/server/modules/rl35/rl35.dokumen";
import { buildRl35Excel } from "@/server/modules/rl35/rl35.excel";
import { buildRl35Pdf } from "@/server/modules/rl35/rl35.pdf";
import { authorize } from "@/server/rbac/guard";
import { berkasResponse, fail } from "@/server/lib/http";

export const runtime = "nodejs";

const MIME = {
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  pdf: "application/pdf",
} as const;

/**
 * GET /api/laporan/rl35/export?from&to[&format=xlsx|pdf]
 * Unduh RL 3.5: Excel (formulir SIRS 6 + per ruangan) atau PDF. Data agregat
 * (tanpa identitas pasien); izin sama dengan RL 3.2.
 */
export async function GET(req: NextRequest) {
  try {
    const user = await authorize("laporan", "view");
    const params = Object.fromEntries(req.nextUrl.searchParams);
    const input = rl35QuerySchema.parse(params);
    const { format } = eksporRl35Schema.parse(params);
    const result = await getRl35(input);
    const meta = { generatedAt: new Date(), by: user.name };
    const buf = format === "pdf" ? await buildRl35Pdf(result, meta) : await buildRl35Excel(result, meta);
    return berkasResponse(new Uint8Array(buf), { mime: MIME[format], nama: namaBerkasRl35(result, format), unduh: true });
  } catch (err) {
    return fail(err);
  }
}

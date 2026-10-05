import { withPermission } from "@/server/rbac/guard";
import { berkasResponse } from "@/server/lib/http";
import { idRuanganSchema } from "@/server/modules/inventaris/publik.schema";
import { urlLabelPublik } from "@/server/modules/inventaris/publik.service";
import { buildLabelQrPdf } from "@/server/modules/inventaris/publik.label";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ ruanganId: string }> };

/** GET /api/inventaris/kir/[ruanganId]/publik/label — label QR ruangan (PDF A6) untuk ditempel. */
export const GET = withPermission<{ ruanganId: string }>("inventaris.kir", "print", async (_req, ctx: Ctx) => {
  const ruanganId = idRuanganSchema.parse((await ctx.params).ruanganId);
  const info = await urlLabelPublik(ruanganId);
  const pdf = await buildLabelQrPdf(info);
  const nama = `Label-QR_${info.kodePrefix.replace(/[^A-Za-z0-9.-]/g, "_")}.pdf`;
  return berkasResponse(pdf, { mime: "application/pdf", nama, unduh: true });
});

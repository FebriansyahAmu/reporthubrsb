import { NextRequest } from "next/server";
import { formRmListQuerySchema } from "@/server/modules/form-rm/form-rm.schema";
import { getFormRmList } from "@/server/modules/form-rm/form-rm.service";
import { authorize } from "@/server/rbac/guard";
import { ok, fail } from "@/server/lib/http";

export const runtime = "nodejs";

/**
 * GET /api/form-rm/list?from=YYYY-MM-DD&to=YYYY-MM-DD[&ruangan&search&page]
 * Daftar pasien IGD (target pengisian Form RM). `to` bersifat EKSKLUSIF.
 */
export async function GET(req: NextRequest) {
  try {
    await authorize("form-rm", "view");
    const sp = Object.fromEntries(req.nextUrl.searchParams);
    const input = formRmListQuerySchema.parse(sp);
    const data = await getFormRmList({
      from: input.from,
      toExclusive: input.to,
      ruanganId: input.ruangan,
      search: input.search,
      page: input.page,
    });
    return ok(data);
  } catch (err) {
    return fail(err);
  }
}

import { NextRequest } from "next/server";
import { MODUL_AKSES_FORM_RM } from "@/features/form-rm/kategori";
import { hakFormRm } from "@/server/modules/form-rm/form-rm.akses";
import { formRmListQuerySchema } from "@/server/modules/form-rm/form-rm.schema";
import { getFormRmList } from "@/server/modules/form-rm/form-rm.pasien";
import { authorizeAny } from "@/server/rbac/guard";
import { ok, fail, tanpaCache } from "@/server/lib/http";

export const runtime = "nodejs";

/**
 * GET /api/form-rm/list?from=YYYY-MM-DD&to=YYYY-MM-DD[&jenis&ruangan&search&page]
 * Daftar per pasien: episode sasaran form yang boleh dilihat + kelengkapan form
 * wajibnya. `to` bersifat EKSKLUSIF.
 */
export async function GET(req: NextRequest) {
  try {
    const user = await authorizeAny(MODUL_AKSES_FORM_RM, "view");
    const input = formRmListQuerySchema.parse(Object.fromEntries(req.nextUrl.searchParams));
    const data = await getFormRmList(
      {
        from: input.from,
        toExclusive: input.to,
        ruanganId: input.ruangan,
        jenis: input.jenis,
        search: input.search,
        page: input.page,
      },
      await hakFormRm(user),
    );
    return tanpaCache(ok(data));
  } catch (err) {
    return tanpaCache(fail(err));
  }
}

import { NextRequest } from "next/server";
import { MODUL_ANTREAN } from "@/server/modules/verifikasi-klaim/verifikasi.constants";
import { nopenSchema } from "@/server/modules/verifikasi-klaim/verifikasi.schema";
import { getDetailKlaim } from "@/server/modules/verifikasi-klaim/verifikasi.service";
import { authorizeAny } from "@/server/rbac/guard";
import { ok, fail } from "@/server/lib/http";

export const runtime = "nodejs";

/**
 * GET /api/berkas-klaim/verifikasi/[nopen] — hasil cek SEGAR satu episode
 * (dasar "Cek ulang dari SIMRS"): snapshot fakta + checklist aturan + status.
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ nopen: string }> }) {
  try {
    await authorizeAny(MODUL_ANTREAN, "view");
    const nopen = nopenSchema.parse((await params).nopen);
    return ok(await getDetailKlaim(nopen));
  } catch (err) {
    return fail(err);
  }
}

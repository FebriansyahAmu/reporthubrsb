import { NextRequest } from "next/server";
import { ok, fail, readJson } from "@/server/lib/http";
import { clientIp } from "@/server/lib/request";
import { putuskanPaket } from "@/server/modules/verifikasi-klaim/paket.service";
import { MODUL_LIHAT_PAKET } from "@/server/modules/verifikasi-klaim/verifikasi.constants";
import { nopenSchema, paketKeputusanSchema } from "@/server/modules/verifikasi-klaim/verifikasi.schema";
import { authorizeAny } from "@/server/rbac/guard";

export const runtime = "nodejs";

/**
 * POST /api/berkas-klaim/paket/[nopen]/keputusan — `KUNCI_FINAL` (petugas
 * paket, versi paket draf yang dipratinjau) / `BUKA_KUNCI` (coder, alasan
 * wajib). Izin per transisi, versi berkas (409) & integritas paket dicek di server.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ nopen: string }> }) {
  try {
    const user = await authorizeAny(MODUL_LIHAT_PAKET, "view");
    const nopen = nopenSchema.parse((await params).nopen);
    const input = paketKeputusanSchema.parse(await readJson(req));
    return ok(await putuskanPaket(nopen, input, user, clientIp(req)));
  } catch (err) {
    return fail(err);
  }
}

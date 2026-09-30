import { NextRequest } from "next/server";
import { selesaikanManual } from "@/server/modules/verifikasi-klaim/tindak-lanjut.service";
import { MODUL_VERIFIKASI } from "@/server/modules/verifikasi-klaim/verifikasi.constants";
import { idTindakLanjutSchema, selesaiManualSchema } from "@/server/modules/verifikasi-klaim/verifikasi.schema";
import { authorizeAny } from "@/server/rbac/guard";
import { ok, fail, readJson } from "@/server/lib/http";
import { clientIp } from "@/server/lib/request";

export const runtime = "nodejs";

/**
 * POST /api/berkas-klaim/tindak-lanjut/[id]/selesai — tandai selesai item CEK
 * MANUAL (penerima ber-izin tindak lanjut, atau verifikator RM). Item otomatis
 * ditolak (409): tertutup sendiri saat data SIMRS lengkap.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await authorizeAny([MODUL_VERIFIKASI.TINDAK_LANJUT, MODUL_VERIFIKASI.RM], "update");
    const id = idTindakLanjutSchema.parse((await params).id);
    const { catatan } = selesaiManualSchema.parse(await readJson(req));
    await selesaikanManual(id, catatan, user, clientIp(req));
    return ok({ ok: true });
  } catch (err) {
    return fail(err);
  }
}

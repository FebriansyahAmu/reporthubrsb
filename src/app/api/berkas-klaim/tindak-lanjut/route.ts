import { NextRequest } from "next/server";
import { getTindakLanjut } from "@/server/modules/verifikasi-klaim/tindak-lanjut.service";
import { MODUL_VERIFIKASI } from "@/server/modules/verifikasi-klaim/verifikasi.constants";
import { tindakLanjutQuerySchema } from "@/server/modules/verifikasi-klaim/verifikasi.schema";
import { authorizeAny } from "@/server/rbac/guard";
import { ok, fail } from "@/server/lib/http";

export const runtime = "nodejs";

/**
 * GET /api/berkas-klaim/tindak-lanjut?status=OPEN|SELESAI&lingkup=saya|semua&page&pageSize[&segar=1]
 * Item berkas klaim yang harus dilengkapi penerima (DPJP/ruangan/peran); `semua`
 * khusus verifikator RM & coder. Item yang datanya sudah lengkap ditutup otomatis.
 */
export async function GET(req: NextRequest) {
  try {
    const user = await authorizeAny(
      [MODUL_VERIFIKASI.TINDAK_LANJUT, MODUL_VERIFIKASI.RM, MODUL_VERIFIKASI.KLAIM],
      "view",
    );
    const q = tindakLanjutQuerySchema.parse(Object.fromEntries(req.nextUrl.searchParams));
    return ok(await getTindakLanjut(user, q));
  } catch (err) {
    return fail(err);
  }
}

import { NextRequest } from "next/server";
import { MODUL_ANTREAN } from "@/server/modules/verifikasi-klaim/verifikasi.constants";
import { nopenSchema } from "@/server/modules/verifikasi-klaim/verifikasi.schema";
import { getRuangKerja } from "@/server/modules/verifikasi-klaim/verifikasi.service";
import { authorizeAny } from "@/server/rbac/guard";
import { ok, fail } from "@/server/lib/http";

export const runtime = "nodejs";

/**
 * GET /api/berkas-klaim/verifikasi/[nopen] — ruang kerja satu berkas: cek SEGAR
 * dari SIMGOS (dasar "Cek ulang dari SIMRS"), cek manual, tindak lanjut,
 * riwayat, dan aksi yang boleh dilakukan pengguna. Tindak lanjut yang datanya
 * sudah lengkap ditutup otomatis (rekonsiliasi idempoten).
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ nopen: string }> }) {
  try {
    const user = await authorizeAny(MODUL_ANTREAN, "view");
    const nopen = nopenSchema.parse((await params).nopen);
    return ok(await getRuangKerja(nopen, user));
  } catch (err) {
    return fail(err);
  }
}

import { NextRequest } from "next/server";
import { ok, fail, readJson } from "@/server/lib/http";
import { clientIp } from "@/server/lib/request";
import { gabungPaket } from "@/server/modules/verifikasi-klaim/paket.service";
import { MODUL_VERIFIKASI } from "@/server/modules/verifikasi-klaim/verifikasi.constants";
import { gabungSchema, nopenSchema } from "@/server/modules/verifikasi-klaim/verifikasi.schema";
import { authorize } from "@/server/rbac/guard";

export const runtime = "nodejs";
/** Menarik beberapa report SIMGOS berurutan (±1 dtk/komponen, timeout 30 dtk/komponen). */
export const maxDuration = 300;

/**
 * POST /api/berkas-klaim/paket/[nopen]/gabung — gabungkan susunan (komponen
 * SIMGOS + sisipan) menjadi satu PDF → paket DRAF versi baru (hash SHA-256,
 * manifest halaman). Susunan sama dengan draf terakhir dipakai ulang kecuali
 * `segar: true`.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ nopen: string }> }) {
  try {
    const user = await authorize(MODUL_VERIFIKASI.PAKET, "create");
    const nopen = nopenSchema.parse((await params).nopen);
    const input = gabungSchema.parse(await readJson(req));
    return ok(await gabungPaket(nopen, input, user, clientIp(req)));
  } catch (err) {
    return fail(err);
  }
}

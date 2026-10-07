import type { NextRequest } from "next/server";
import { authorizeAny } from "@/server/rbac/guard";
import { fail, ok, readJsonTerbatas, tanpaCache } from "@/server/lib/http";
import { MODUL_AKSES_FORM_RM } from "@/features/form-rm/kategori";
import { terapkanSimrsSchema } from "@/server/modules/form-rm/isian.schema";
import { bandingkanSimrs, terapkanSimrs } from "@/server/modules/form-rm/isian.service";
import { aktorDari, BATAS_BODY, idDariParam, jagaSimrs, jagaTulis } from "@/server/modules/form-rm/isian.jaga";

export const runtime = "nodejs";

/**
 * "Muat ulang dari SIMRS" (PRD §6.4 butir 3) — hanya isian DRAF, butuh update
 * pada kategori form.
 * GET  — perbandingan nilai isian dengan nilai SIMRS terkini per bagian.
 * POST — `{ rev, kolom[] }`: terapkan nilai SIMRS terkini ke kolom terpilih.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await authorizeAny(MODUL_AKSES_FORM_RM, "update");
    const id = idDariParam((await params).id);
    jagaSimrs(user);
    return tanpaCache(ok(await bandingkanSimrs(id, await aktorDari(user, req))));
  } catch (err) {
    return tanpaCache(fail(err));
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await authorizeAny(MODUL_AKSES_FORM_RM, "update");
    jagaTulis(req, user);
    const id = idDariParam((await params).id);
    const input = terapkanSimrsSchema.parse(await readJsonTerbatas(req, BATAS_BODY.kecil));
    return tanpaCache(ok(await terapkanSimrs(id, input, await aktorDari(user, req))));
  } catch (err) {
    return tanpaCache(fail(err));
  }
}

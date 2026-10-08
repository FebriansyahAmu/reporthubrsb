import type { NextRequest } from "next/server";
import { authorizeAny } from "@/server/rbac/guard";
import { fail, ok, readJsonTerbatas, tanpaCache } from "@/server/lib/http";
import { MODUL_AKSES_FORM_RM } from "@/features/form-rm/kategori";
import { kandidatTautanQuerySchema, lepasTautanSchema, tautkanSchema } from "@/server/modules/form-rm/isian.schema";
import { kandidatTautan, lepasTautan, tautkanIsian } from "@/server/modules/form-rm/isian.tautan";
import { aktorDari, BATAS_BODY, idDariParam, jagaCari, jagaTulis } from "@/server/modules/form-rm/isian.jaga";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

/**
 * Tautan isian sementara ke pendaftaran (NOPEN) — hanya draf, butuh update pada
 * kategori form.
 * GET    `?q=`          — calon pendaftaran: saran sekitar waktu triase, atau pencarian.
 * POST   `{ rev, nopen }` — tautkan.
 * DELETE `?rev=`        — lepas tautan (salah pasien; draf tanpa revisi & tanpa data SIMRS).
 */
export async function GET(req: NextRequest, { params }: Ctx) {
  try {
    const user = await authorizeAny(MODUL_AKSES_FORM_RM, "update");
    const id = idDariParam((await params).id);
    const input = kandidatTautanQuerySchema.parse(Object.fromEntries(req.nextUrl.searchParams));
    jagaCari(user);
    return tanpaCache(ok(await kandidatTautan(id, input.q, await aktorDari(user, req))));
  } catch (err) {
    return tanpaCache(fail(err));
  }
}

export async function POST(req: NextRequest, { params }: Ctx) {
  try {
    const user = await authorizeAny(MODUL_AKSES_FORM_RM, "update");
    jagaTulis(req, user);
    const id = idDariParam((await params).id);
    const input = tautkanSchema.parse(await readJsonTerbatas(req, BATAS_BODY.kecil));
    return tanpaCache(ok(await tautkanIsian(id, input, await aktorDari(user, req))));
  } catch (err) {
    return tanpaCache(fail(err));
  }
}

export async function DELETE(req: NextRequest, { params }: Ctx) {
  try {
    const user = await authorizeAny(MODUL_AKSES_FORM_RM, "update");
    jagaTulis(req, user);
    const id = idDariParam((await params).id);
    const input = lepasTautanSchema.parse({ rev: Number(req.nextUrl.searchParams.get("rev")) });
    return tanpaCache(ok(await lepasTautan(id, input, await aktorDari(user, req))));
  } catch (err) {
    return tanpaCache(fail(err));
  }
}

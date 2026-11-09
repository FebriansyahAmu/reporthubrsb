import type { NextRequest } from "next/server";
import { MODUL_PERANGKAT_TTD } from "@/features/form-rm/kategori";
import { fail, ok, readJsonTerbatas, tanpaCache } from "@/server/lib/http";
import { authorize } from "@/server/rbac/guard";
import { jagaTulis } from "@/server/modules/form-rm/isian.jaga";
import { aktorPerangkat, BATAS_BODY_PERANGKAT, idPerangkatDariParam } from "@/server/modules/ttd-siaga/perangkat.jaga";
import { ubahPerangkatSchema } from "@/server/modules/ttd-siaga/perangkat.schema";
import { cabutPerangkat, ubahPerangkat } from "@/server/modules/ttd-siaga/perangkat.service";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

/** PATCH `{ nama?, ruanganId? }` — ganti nama/lokasi (`form-rm.perangkat:update`). */
export async function PATCH(req: NextRequest, { params }: Ctx) {
  try {
    const user = await authorize(MODUL_PERANGKAT_TTD, "update");
    jagaTulis(req, user);
    const id = idPerangkatDariParam((await params).id);
    const input = ubahPerangkatSchema.parse(await readJsonTerbatas(req, BATAS_BODY_PERANGKAT));
    return tanpaCache(ok(await ubahPerangkat(id, input, aktorPerangkat(user, req))));
  } catch (err) {
    return tanpaCache(fail(err));
  }
}

/** DELETE — CABUT perangkat (`form-rm.perangkat:delete`): kredensial dihapus, baris tetap sebagai jejak. */
export async function DELETE(req: NextRequest, { params }: Ctx) {
  try {
    const user = await authorize(MODUL_PERANGKAT_TTD, "delete");
    jagaTulis(req, user);
    const id = idPerangkatDariParam((await params).id);
    return tanpaCache(ok(await cabutPerangkat(id, aktorPerangkat(user, req))));
  } catch (err) {
    return tanpaCache(fail(err));
  }
}

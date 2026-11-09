import type { NextRequest } from "next/server";
import { MODUL_PERANGKAT_TTD } from "@/features/form-rm/kategori";
import { fail, ok, tanpaCache } from "@/server/lib/http";
import { authorize } from "@/server/rbac/guard";
import { jagaTulis } from "@/server/modules/form-rm/isian.jaga";
import { aktorPerangkat, idPerangkatDariParam } from "@/server/modules/ttd-siaga/perangkat.jaga";
import { terbitkanKodePasang } from "@/server/modules/ttd-siaga/perangkat.service";

export const runtime = "nodejs";

/**
 * POST — terbitkan kode pasang sekali pakai (`form-rm.perangkat:update`).
 * Kode mentah HANYA di respons ini (`no-store`); kode lama perangkat ini batal.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await authorize(MODUL_PERANGKAT_TTD, "update");
    jagaTulis(req, user);
    const id = idPerangkatDariParam((await params).id);
    return tanpaCache(ok(await terbitkanKodePasang(id, aktorPerangkat(user, req))));
  } catch (err) {
    return tanpaCache(fail(err));
  }
}

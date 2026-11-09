import type { NextRequest } from "next/server";
import { MODUL_PERANGKAT_TTD } from "@/features/form-rm/kategori";
import { fail, ok, readJsonTerbatas, tanpaCache } from "@/server/lib/http";
import { authorize } from "@/server/rbac/guard";
import { jagaTulis } from "@/server/modules/form-rm/isian.jaga";
import { aktorPerangkat, BATAS_BODY_PERANGKAT } from "@/server/modules/ttd-siaga/perangkat.jaga";
import { buatPerangkatSchema } from "@/server/modules/ttd-siaga/perangkat.schema";
import { buatPerangkat, daftarPerangkat } from "@/server/modules/ttd-siaga/perangkat.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET — daftar perangkat TTD siaga (`form-rm.perangkat:view`). Tanpa kolom kredensial. */
export async function GET() {
  try {
    await authorize(MODUL_PERANGKAT_TTD, "view");
    return tanpaCache(ok(await daftarPerangkat()));
  } catch (err) {
    return tanpaCache(fail(err));
  }
}

/** POST `{ nama, ruanganId? }` — tambah perangkat (`form-rm.perangkat:create`). */
export async function POST(req: NextRequest) {
  try {
    const user = await authorize(MODUL_PERANGKAT_TTD, "create");
    jagaTulis(req, user);
    const input = buatPerangkatSchema.parse(await readJsonTerbatas(req, BATAS_BODY_PERANGKAT));
    return tanpaCache(ok(await buatPerangkat(input, aktorPerangkat(user, req))));
  } catch (err) {
    return tanpaCache(fail(err));
  }
}

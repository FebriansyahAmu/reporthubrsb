import type { NextRequest } from "next/server";
import { NotFoundError, ValidationError } from "@/server/lib/errors";
import { fail, ok, tanpaCache } from "@/server/lib/http";
import { clientIp } from "@/server/lib/request";
import { bacaTokenPerangkat } from "@/server/modules/ttd-siaga/kredensial";
import { autentikasiPerangkat } from "@/server/modules/ttd-siaga/perangkat.sesi";
import { kirimTtdSchema, PERMINTAAN_ID_RE } from "@/server/modules/ttd-siaga/permintaan.schema";
import { bacaTeksTerbatas, BATAS_BODY_TTD, kirimTtdTablet, milikPerangkat } from "@/server/modules/ttd-siaga/permintaan.tablet";
import { jagaAsalPerangkat } from "@/server/modules/ttd-siaga/ttd-siaga.jaga";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

/**
 * POST `{ png }` — tablet mengirim tanda tangan (docs/PRD_TTD_Perangkat_Siaga.md
 * §7.4). Cookie perangkat + asal-sama + permintaan untuk perangkat ini (selain
 * itu 404). Body dibaca ≤ 512 KB sebelum di-parse; PNG dinormalkan server.
 */
export async function POST(req: NextRequest, { params }: Ctx) {
  try {
    jagaAsalPerangkat(req);
    const ip = clientIp(req);
    const id = (await params).id;
    if (!PERMINTAAN_ID_RE.test(id)) throw new NotFoundError();
    const { perangkat } = await autentikasiPerangkat(bacaTokenPerangkat(req), { ip, rotasi: false });
    milikPerangkat(id, perangkat);
    const teks = await bacaTeksTerbatas(req, BATAS_BODY_TTD);
    let json: unknown;
    try {
      json = JSON.parse(teks);
    } catch {
      throw new ValidationError({ formErrors: ["Body permintaan harus JSON yang valid"], fieldErrors: {} });
    }
    const { png } = kirimTtdSchema.parse(json);
    kirimTtdTablet(id, perangkat, png, ip);
    return tanpaCache(ok({ diterima: true }));
  } catch (err) {
    return tanpaCache(fail(err));
  }
}

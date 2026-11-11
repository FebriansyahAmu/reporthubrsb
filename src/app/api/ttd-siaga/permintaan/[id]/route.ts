import type { NextRequest } from "next/server";
import { NotFoundError } from "@/server/lib/errors";
import { bacaTeksTerbatas, fail, ok, parseJson, tanpaCache } from "@/server/lib/http";
import { clientIp } from "@/server/lib/request";
import { bacaTokenPerangkat } from "@/server/modules/ttd-siaga/kredensial";
import { autentikasiPerangkat } from "@/server/modules/ttd-siaga/perangkat.sesi";
import { kirimTtdSchema, PERMINTAAN_ID_RE } from "@/server/modules/ttd-siaga/permintaan.schema";
import { BATAS_BODY_TTD, kirimTtdTablet, milikPerangkat } from "@/server/modules/ttd-siaga/permintaan.tablet";
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
    const { png } = kirimTtdSchema.parse(parseJson(await bacaTeksTerbatas(req, BATAS_BODY_TTD)));
    kirimTtdTablet(id, perangkat, png, ip);
    return tanpaCache(ok({ diterima: true }));
  } catch (err) {
    return tanpaCache(fail(err));
  }
}

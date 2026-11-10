import type { NextRequest } from "next/server";
import { NotFoundError } from "@/server/lib/errors";
import { fail, ok, tanpaCache } from "@/server/lib/http";
import { clientIp } from "@/server/lib/request";
import { bacaTokenPerangkat } from "@/server/modules/ttd-siaga/kredensial";
import { autentikasiPerangkat } from "@/server/modules/ttd-siaga/perangkat.sesi";
import { PERMINTAAN_ID_RE } from "@/server/modules/ttd-siaga/permintaan.schema";
import { tampilkanTtd } from "@/server/modules/ttd-siaga/permintaan.tablet";
import { jagaAsalPerangkat } from "@/server/modules/ttd-siaga/ttd-siaga.jaga";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

/**
 * POST — tablet menandai kanvas tampil (idempoten). Juga memastikan permintaan
 * masih menunggu tanda tangan sebelum kanvas dibuka: 404/409 → tetap siaga.
 */
export async function POST(req: NextRequest, { params }: Ctx) {
  try {
    jagaAsalPerangkat(req);
    const ip = clientIp(req);
    const id = (await params).id;
    if (!PERMINTAAN_ID_RE.test(id)) throw new NotFoundError();
    const { perangkat } = await autentikasiPerangkat(bacaTokenPerangkat(req), { ip, rotasi: false });
    tampilkanTtd(id, perangkat, ip);
    return tanpaCache(ok({ tampil: true }));
  } catch (err) {
    return tanpaCache(fail(err));
  }
}

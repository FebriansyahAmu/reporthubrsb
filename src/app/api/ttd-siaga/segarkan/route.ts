import type { NextRequest } from "next/server";
import { UnauthorizedError } from "@/server/lib/errors";
import { fail, ok, tanpaCache } from "@/server/lib/http";
import { clientIp } from "@/server/lib/request";
import {
  bacaTokenPerangkat,
  hapusCookiePerangkat,
  pasangCookiePerangkat,
  permintaanAman,
} from "@/server/modules/ttd-siaga/kredensial";
import { autentikasiPerangkat } from "@/server/modules/ttd-siaga/perangkat.sesi";
import { jagaAsalPerangkat } from "@/server/modules/ttd-siaga/ttd-siaga.jaga";

export const runtime = "nodejs";

/**
 * POST — tablet memeriksa pemasangannya sebelum membuka aliran, sekaligus
 * merotasi kredensial bila sudah ≥ 24 jam (cookie baru, hash lama disimpan
 * selama grasi). Cookie selalu dipasang ulang agar umurnya bergulir.
 * 401 → cookie dihapus; tablet kembali ke layar pasang.
 */
export async function POST(req: NextRequest) {
  const aman = permintaanAman(req);
  try {
    jagaAsalPerangkat(req);
    const token = bacaTokenPerangkat(req);
    const { perangkat, tokenBaru } = await autentikasiPerangkat(token, { ip: clientIp(req), rotasi: true });
    const res = tanpaCache(ok({ nama: perangkat.nama }));
    pasangCookiePerangkat(res, tokenBaru ?? token!, aman);
    return res;
  } catch (err) {
    const res = tanpaCache(fail(err));
    if (err instanceof UnauthorizedError) hapusCookiePerangkat(res, aman);
    return res;
  }
}

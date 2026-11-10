import type { NextRequest } from "next/server";
import { fail, ok, readJsonTerbatas, tanpaCache } from "@/server/lib/http";
import { clientIp } from "@/server/lib/request";
import { pasangCookiePerangkat, permintaanAman } from "@/server/modules/ttd-siaga/kredensial";
import { pasangSchema } from "@/server/modules/ttd-siaga/perangkat.schema";
import { jagaLajuPasang, pasangDenganKode } from "@/server/modules/ttd-siaga/perangkat.sesi";
import { jagaAsalPerangkat } from "@/server/modules/ttd-siaga/ttd-siaga.jaga";

export const runtime = "nodejs";

/**
 * POST `{ kode }` — tablet menukar kode pasang (sekali pakai) dengan kredensial
 * perangkat. PUBLIK (tanpa sesi pengguna): dijaga asal-sama, laju per IP &
 * global, body ≤ 1 KB. Kredensial hanya dikirim sebagai cookie httpOnly —
 * tidak pernah di body. Kode salah/kedaluwarsa/terpakai → 401 seragam.
 */
export async function POST(req: NextRequest) {
  try {
    jagaAsalPerangkat(req);
    const ip = clientIp(req);
    await jagaLajuPasang(ip);
    const { kode } = pasangSchema.parse(await readJsonTerbatas(req, 1024));
    const { token, perangkat } = await pasangDenganKode(kode, ip);
    const res = tanpaCache(ok({ nama: perangkat.nama }));
    pasangCookiePerangkat(res, token, permintaanAman(req));
    return res;
  } catch (err) {
    return tanpaCache(fail(err));
  }
}

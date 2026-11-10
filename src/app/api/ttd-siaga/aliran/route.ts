import type { NextRequest } from "next/server";
import { frameSse, retrySse } from "@/features/form-rm/ttd-siaga/sse";
import { ServiceUnavailableError } from "@/server/lib/errors";
import { fail, tanpaCache } from "@/server/lib/http";
import { clientIp } from "@/server/lib/request";
import { hubTtd, penulisAliran, type KoneksiPerangkat } from "@/server/modules/ttd-siaga/hub";
import { bacaTokenPerangkat } from "@/server/modules/ttd-siaga/kredensial";
import { autentikasiPerangkat, setelahSambung } from "@/server/modules/ttd-siaga/perangkat.sesi";
import { permintaanTtd } from "@/server/modules/ttd-siaga/permintaan.hub";
import { HEADER_ALIRAN, jagaAsalPerangkat } from "@/server/modules/ttd-siaga/ttd-siaga.jaga";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET — aliran SSE tablet siaga (docs/PRD_TTD_Perangkat_Siaga.md §5.2, §7.3).
 * Cookie perangkat sah + asal-sama. `Response` dikembalikan SEGERA; event
 * ditulis lewat hub (`siap {permintaan}`, detak 20 dtk, `permintaan`,
 * `selesai`, `dicabut`, `diganti`). Tablet hanya menerima ID permintaan +
 * putaran — tanpa data pasien (K2).
 * Rotasi kredensial TIDAK di sini (lihat `segarkan`).
 */
export async function GET(req: NextRequest) {
  try {
    jagaAsalPerangkat(req);
    const ip = clientIp(req);
    const { perangkat } = await autentikasiPerangkat(bacaTokenPerangkat(req), { ip, rotasi: false });
    if (!hubTtd.adaRuang(perangkat.id)) throw new ServiceUnavailableError("Server sedang penuh. Coba lagi.");

    let koneksi: KoneksiPerangkat | null = null;
    let diganti: KoneksiPerangkat | null = null;
    const lepas = () => {
      if (koneksi) hubTtd.lepas(koneksi);
    };
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        const penulis = penulisAliran(controller);
        ({ koneksi, diganti } = hubTtd.sambungkan({ perangkatId: perangkat.id, ip, ...penulis }));
        penulis.kirim(retrySse(3000));
        // Permintaan aktif yang masih menunggu kanvas ikut dikirim (tablet sempat putus) — HANYA {id, putaran}.
        penulis.kirim(frameSse("siap", { permintaan: permintaanTtd.perangkatTersambung(perangkat.id) }));
      },
      cancel: lepas,
    });
    req.signal.addEventListener("abort", lepas, { once: true });
    await setelahSambung(perangkat, ip, diganti);
    return new Response(stream, { status: 200, headers: HEADER_ALIRAN });
  } catch (err) {
    return tanpaCache(fail(err));
  }
}

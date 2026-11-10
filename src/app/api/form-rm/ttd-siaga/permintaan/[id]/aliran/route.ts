import type { NextRequest } from "next/server";
import { authorizeAny } from "@/server/rbac/guard";
import { NotFoundError, ServiceUnavailableError } from "@/server/lib/errors";
import { fail, tanpaCache } from "@/server/lib/http";
import { MODUL_AKSES_FORM_RM } from "@/features/form-rm/kategori";
import { retrySse } from "@/features/form-rm/ttd-siaga/sse";
import { penulisAliran } from "@/server/modules/ttd-siaga/hub";
import { permintaanTtd, type KoneksiPc } from "@/server/modules/ttd-siaga/permintaan.hub";
import { PERMINTAAN_ID_RE } from "@/server/modules/ttd-siaga/permintaan.schema";
import { permintaanMilik } from "@/server/modules/ttd-siaga/permintaan.service";
import { HEADER_ALIRAN, jagaAsalSama } from "@/server/modules/ttd-siaga/ttd-siaga.jaga";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/**
 * GET — aliran SSE status permintaan untuk PEMILIKNYA saja (PRD §7.3–7.4):
 * `status`, `ttd`, `detak`, `diganti`. Bukan pemilik — termasuk superadmin —
 * → 404 seragam. Aliran putus > 10 dtk tanpa sambung ulang → DIBATALKAN.
 */
export async function GET(req: NextRequest, { params }: Ctx) {
  try {
    const user = await authorizeAny(MODUL_AKSES_FORM_RM, "update");
    jagaAsalSama(req);
    const id = (await params).id;
    if (!PERMINTAAN_ID_RE.test(id)) throw new NotFoundError();
    permintaanMilik(id, user.id);
    if (!permintaanTtd.adaRuangPc(id)) throw new ServiceUnavailableError("Server sedang penuh. Coba lagi.");

    let koneksi: KoneksiPc | null = null;
    const lepas = () => {
      if (koneksi) permintaanTtd.lepasPc(koneksi);
    };
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        const penulis = penulisAliran(controller);
        penulis.kirim(retrySse(3000));
        koneksi = permintaanTtd.sambungPc(id, penulis);
      },
      cancel: lepas,
    });
    req.signal.addEventListener("abort", lepas, { once: true });
    return new Response(stream, { status: 200, headers: HEADER_ALIRAN });
  } catch (err) {
    return tanpaCache(fail(err));
  }
}

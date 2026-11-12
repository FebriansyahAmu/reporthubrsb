import type { NextRequest } from "next/server";
import { authorizeAny } from "@/server/rbac/guard";
import { fail, tanpaCache } from "@/server/lib/http";
import { MODUL_AKSES_FORM_RM } from "@/features/form-rm/kategori";
import { retrySse } from "@/features/form-rm/ttd-siaga/sse";
import { penulisAliran } from "@/server/modules/ttd-siaga/hub";
import { HEADER_ALIRAN } from "@/server/modules/ttd-siaga/ttd-siaga.jaga";
import { bukaAliran, konteksQuery } from "@/server/modules/form-rm/isian.aliran";
import { hubIsian, type KoneksiIsian } from "@/server/modules/form-rm/isian.hub";
import { aktorDari, idDariParam, jagaAliran } from "@/server/modules/form-rm/isian.jaga";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/**
 * GET — aliran SSE isian form berlanjut IGD → RI (PRD Berlanjut §8.5):
 * `awal`, `berubah`, `status`, `hadir`, `segarkan`, `detak` — TANPA nilai
 * kolom. Sesi + asal sama + hak lihat kategori (404 seragam); `?konteks=`
 * harus anggota rantai (422). Aliran ditutup setelah 10 menit (`segarkan`).
 */
export async function GET(req: NextRequest, { params }: Ctx) {
  try {
    const user = await authorizeAny(MODUL_AKSES_FORM_RM, "view");
    jagaAliran(req, user);
    const id = idDariParam((await params).id);
    const konteks = konteksQuery(req.nextUrl.searchParams.get("konteks"));
    const { isian, konteks: k } = await bukaAliran(id, konteks, await aktorDari(user, req));
    hubIsian.periksaRuang(user.id);

    let koneksi: KoneksiIsian | null = null;
    const lepas = () => {
      if (koneksi) hubIsian.lepas(koneksi);
    };
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        const penulis = penulisAliran(controller);
        penulis.kirim(retrySse(3000));
        koneksi = hubIsian.sambung(
          { isianId: id, userId: user.id, nama: user.name, konteks: k.nopen, unit: k.unit, ruang: k.ruang, ...penulis },
          { rev: isian.rev, status: isian.status },
        );
      },
      cancel: lepas,
    });
    req.signal.addEventListener("abort", lepas, { once: true });
    return new Response(stream, { status: 200, headers: HEADER_ALIRAN });
  } catch (err) {
    return tanpaCache(fail(err));
  }
}

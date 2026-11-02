import { NextRequest } from "next/server";
import { aksesBaca, tolakLintasSitus } from "@/server/modules/bckh/bckh.akses";
import { catatEkspor } from "@/server/modules/bckh/bckh.catatan";
import { laporanBulan, namaBerkasLaporan } from "@/server/modules/bckh/bckh.laporan";
import { bangunPdfLaporan } from "@/server/modules/bckh/bckh.pdf";
import { laporanQuerySchema, paramObjek } from "@/server/modules/bckh/bckh.schema";
import { berkasResponse, fail } from "@/server/lib/http";
import { clientIp } from "@/server/lib/request";

export const runtime = "nodejs";

/**
 * GET /api/bckh/laporan/pdf?bulan=YYYY-MM&u=&unduh=1 — PDF Laporan Kinerja Harian
 * (1:1 dokumen contoh). Sendiri: `bckh:print`; pegawai lain: `bckh.tim:print`.
 * Setiap unduhan tercatat di log pengisian pemilik (EKSPOR) sebelum diserahkan.
 */
export async function GET(req: NextRequest) {
  try {
    tolakLintasSitus(req);
    const q = laporanQuerySchema.parse(paramObjek(req.nextUrl.searchParams));
    const { penampil, target, milikSendiri } = await aksesBaca(q.u, "print");
    const lap = await laporanBulan(target, q.bulan, milikSendiri);
    const pdf = await bangunPdfLaporan(lap);
    await catatEkspor(target.id, { id: penampil.id, nama: penampil.name, ip: clientIp(req) }, q.bulan);
    return berkasResponse(pdf, { mime: "application/pdf", nama: namaBerkasLaporan(lap.profil.namaLengkap, q.bulan), unduh: q.unduh === "1" });
  } catch (err) {
    return fail(err);
  }
}

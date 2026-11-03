import { NextRequest } from "next/server";
import { aksesBaca, tolakLintasSitus } from "@/server/modules/bckh/bckh.akses";
import { catatEkspor } from "@/server/modules/bckh/bckh.catatan";
import { laporanBulan, namaBerkasLaporan } from "@/server/modules/bckh/bckh.laporan";
import { bangunPdfLaporan } from "@/server/modules/bckh/bckh.pdf";
import { bahanPdfDisahkan } from "@/server/modules/bckh/bckh.persetujuan";
import { asalPublik } from "@/server/lib/public-origin";
import { laporanQuerySchema, paramObjek } from "@/server/modules/bckh/bckh.schema";
import { berkasResponse, fail } from "@/server/lib/http";
import { clientIp } from "@/server/lib/request";

export const runtime = "nodejs";

/**
 * GET /api/bckh/laporan/pdf?bulan=YYYY-MM&u=&unduh=1 — PDF Laporan Kinerja Harian
 * (1:1 dokumen contoh). Sendiri: `bckh:print`; pegawai lain: `bckh.tim:print` atau
 * `bckh.persetujuan:print` (bawahan). Bila bulan punya pengajuan aktif, PDF dibangun
 * dari SNAPSHOT yang diajukan + TTD; DISETUJUI → QR verifikasi (PRD §15.5).
 * Setiap unduhan tercatat di log pengisian pemilik (EKSPOR) sebelum diserahkan.
 */
export async function GET(req: NextRequest) {
  try {
    tolakLintasSitus(req);
    const q = laporanQuerySchema.parse(paramObjek(req.nextUrl.searchParams));
    const { penampil, target, milikSendiri } = await aksesBaca(q.u, "print");
    const sah = await bahanPdfDisahkan(target.id, q.bulan);
    const lap = sah?.lap ?? (await laporanBulan(target, q.bulan, milikSendiri));
    const asal = asalPublik();
    const pdf = await bangunPdfLaporan(
      lap,
      sah
        ? {
            ttd: sah.ttd,
            verifikasi: sah.disetujui && { kode: sah.disetujui.kode, url: asal ? `${asal}/bckh/verifikasi/${sah.disetujui.token}` : null },
          }
        : undefined,
    );
    await catatEkspor(target.id, { id: penampil.id, nama: penampil.name, ip: clientIp(req) }, q.bulan);
    return berkasResponse(pdf, { mime: "application/pdf", nama: namaBerkasLaporan(lap.profil.namaLengkap, q.bulan), unduh: q.unduh === "1" });
  } catch (err) {
    return fail(err);
  }
}

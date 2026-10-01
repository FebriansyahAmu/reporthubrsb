import { NextRequest } from "next/server";
import { berkasResponse, fail } from "@/server/lib/http";
import { clientIp } from "@/server/lib/request";
import { bacaPdfPaket } from "@/server/modules/verifikasi-klaim/paket.service";
import { MODUL_LIHAT_PAKET, MODUL_VERIFIKASI } from "@/server/modules/verifikasi-klaim/verifikasi.constants";
import { modePdfSchema, nopenSchema } from "@/server/modules/verifikasi-klaim/verifikasi.schema";
import { authorize, authorizeAny } from "@/server/rbac/guard";

export const runtime = "nodejs";

/**
 * GET /api/berkas-klaim/paket/[nopen]/pdf?mode=lihat|cetak|unduh — PDF paket
 * TERSIMPAN (tidak menggabung ulang), diverifikasi terhadap hash. `lihat` =
 * pratinjau (izin lihat); `cetak` / `unduh` butuh izin cetak Paket Klaim dan
 * tercatat di audit (versi & hash paket).
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ nopen: string }> }) {
  try {
    const mode = modePdfSchema.parse(req.nextUrl.searchParams.get("mode") ?? undefined);
    const user = mode === "lihat" ? await authorizeAny(MODUL_LIHAT_PAKET, "view") : await authorize(MODUL_VERIFIKASI.PAKET, "print");
    const nopen = nopenSchema.parse((await params).nopen);
    const f = await bacaPdfPaket(nopen, mode, user, clientIp(req));
    return berkasResponse(f.bytes, { mime: "application/pdf", nama: f.nama, unduh: mode === "unduh" });
  } catch (err) {
    return fail(err);
  }
}

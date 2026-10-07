import { NextRequest, NextResponse } from "next/server";
import { buatPembatasLaju, kunciIpKlien } from "@/server/lib/rate-limit";
import { cekPembaruan } from "@/server/modules/desktop/rilis";
import { paramPembaruanSchema } from "@/server/modules/desktop/rilis.skema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const laju = buatPembatasLaju({ batas: 30, jendelaMs: 60_000 });
const HEADER = { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } as const;

/**
 * GET /api/desktop/pembaruan/{target}/{arch}/{versi} — dipanggil updater aplikasi
 * desktop (publik: tanpa cookie). 204 = tidak ada pembaruan; 200 = manifest
 * format Tauri (`version`, `url`, `signature`, …). Parameter tak dikenal → 404.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ target: string; arch: string; versi: string }> }) {
  const izin = laju(kunciIpKlien(req.headers));
  if (!izin.izin) {
    return new NextResponse(null, { status: 429, headers: { ...HEADER, "Retry-After": String(izin.ulangDetik) } });
  }
  const p = paramPembaruanSchema.safeParse(await params);
  if (!p.success) return new NextResponse(null, { status: 404, headers: HEADER });

  const jawaban = await cekPembaruan(p.data);
  if (!jawaban) return new NextResponse(null, { status: 204, headers: HEADER });
  return NextResponse.json(jawaban, { headers: HEADER });
}

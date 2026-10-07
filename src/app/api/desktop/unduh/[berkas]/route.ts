import { NextRequest, NextResponse } from "next/server";
import { buatPembatasLaju, kunciIpKlien } from "@/server/lib/rate-limit";
import { bacaInstaller, berkasTerbaru } from "@/server/modules/desktop/rilis";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const laju = buatPembatasLaju({ batas: 10, jendelaMs: 60_000 });
const HEADER = { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } as const;

function tidakAda(): NextResponse {
  return new NextResponse("Installer aplikasi desktop belum tersedia.", {
    status: 404,
    headers: { ...HEADER, "Content-Type": "text/plain; charset=utf-8" },
  });
}

/**
 * GET /api/desktop/unduh/{berkas} — installer aplikasi desktop (publik: updater
 * mengunduh tanpa cookie). Hanya berkas yang tercantum di manifest rilis saat ini;
 * `terbaru` = installer Windows x64 terbaru (tautan "Unduh aplikasi desktop").
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ berkas: string }> }) {
  const izin = laju(kunciIpKlien(req.headers));
  if (!izin.izin) {
    return new NextResponse(null, { status: 429, headers: { ...HEADER, "Retry-After": String(izin.ulangDetik) } });
  }
  const { berkas: diminta } = await params;
  const berkas = diminta === "terbaru" ? await berkasTerbaru() : diminta;
  if (!berkas) return tidakAda();
  const bytes = await bacaInstaller(berkas);
  if (!bytes) return tidakAda();
  return new NextResponse(Buffer.from(bytes), {
    headers: {
      ...HEADER,
      "Content-Type": "application/octet-stream",
      "Content-Length": String(bytes.byteLength),
      "Content-Disposition": `attachment; filename="${berkas}"`,
    },
  });
}

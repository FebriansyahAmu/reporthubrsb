import type { NextRequest } from "next/server";
import { authorize } from "@/server/rbac/guard";
import { berkasResponse, fail, tanpaCache } from "@/server/lib/http";
import { bacaTtd } from "@/server/modules/form-rm/isian.service";
import { idDariParam } from "@/server/modules/form-rm/isian.jaga";

export const runtime = "nodejs";

/**
 * GET — gambar tanda tangan (PNG ternormalisasi server). Tidak di-cache (isi
 * rekam medis); CSP sandbox agar tak pernah bisa dijalankan sebagai dokumen.
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await authorize("form-rm", "view");
    const ttd = await bacaTtd(idDariParam((await params).id));
    const res = berkasResponse(ttd.png, { mime: "image/png", nama: "tanda-tangan.png" });
    res.headers.set("Content-Security-Policy", "default-src 'none'; sandbox");
    res.headers.set("ETag", `"${ttd.sha256}"`);
    return res;
  } catch (err) {
    return tanpaCache(fail(err));
  }
}

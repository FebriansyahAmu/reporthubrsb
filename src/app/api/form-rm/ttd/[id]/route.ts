import type { NextRequest } from "next/server";
import { authorizeAny } from "@/server/rbac/guard";
import { berkasResponse, fail, tanpaCache } from "@/server/lib/http";
import { MODUL_AKSES_FORM_RM } from "@/features/form-rm/kategori";
import { hakFormRm } from "@/server/modules/form-rm/form-rm.akses";
import { bacaTtd } from "@/server/modules/form-rm/isian.service";
import { idDariParam } from "@/server/modules/form-rm/isian.jaga";

export const runtime = "nodejs";

/**
 * GET — gambar tanda tangan (PNG ternormalisasi server). Hak lihat dicek pada
 * kategori form isian pemiliknya. Tidak di-cache (isi rekam medis); CSP sandbox
 * agar tak pernah bisa dijalankan sebagai dokumen.
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await authorizeAny(MODUL_AKSES_FORM_RM, "view");
    const ttd = await bacaTtd(idDariParam((await params).id), await hakFormRm(user));
    const res = berkasResponse(ttd.png, { mime: "image/png", nama: "tanda-tangan.png" });
    res.headers.set("Content-Security-Policy", "default-src 'none'; sandbox");
    res.headers.set("ETag", `"${ttd.sha256}"`);
    return res;
  } catch (err) {
    return tanpaCache(fail(err));
  }
}

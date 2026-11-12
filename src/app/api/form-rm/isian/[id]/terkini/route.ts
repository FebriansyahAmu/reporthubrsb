import type { NextRequest } from "next/server";
import { authorizeAny } from "@/server/rbac/guard";
import { fail, ok, tanpaCache } from "@/server/lib/http";
import { MODUL_AKSES_FORM_RM } from "@/features/form-rm/kategori";
import { isianTerkini, konteksQuery } from "@/server/modules/form-rm/isian.aliran";
import { aktorDari, idDariParam, jagaTerkini } from "@/server/modules/form-rm/isian.jaga";

export const runtime = "nodejs";

/**
 * GET — isi terkini isian form berlanjut untuk rebase setelah event aliran
 * (PRD Berlanjut §8.6). Hak lihat kategori dicek SETIAP kali (404 seragam),
 * laju per pengguna, tanpa cache; `?konteks=` opsional (bukan anggota rantai → 422).
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await authorizeAny(MODUL_AKSES_FORM_RM, "view");
    jagaTerkini(user);
    const id = idDariParam((await params).id);
    const konteks = konteksQuery(req.nextUrl.searchParams.get("konteks"));
    return tanpaCache(ok(await isianTerkini(id, konteks, await aktorDari(user, req))));
  } catch (err) {
    return tanpaCache(fail(err));
  }
}

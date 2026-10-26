import type { NextRequest } from "next/server";
import { authorizeAny } from "@/server/rbac/guard";
import { fail, ok, readJsonTerbatas, tanpaCache } from "@/server/lib/http";
import { clientIp } from "@/server/lib/request";
import { NotFoundError } from "@/server/lib/errors";
import { MODUL_AKSES_FORM_RM } from "@/features/form-rm/kategori";
import { jagaTulis } from "@/server/modules/form-rm/isian.jaga";
import {
  bacaTtdSaya,
  hapusTtdSaya,
  jenisTtdSayaSchema,
  simpanTtdSaya,
  simpanTtdSayaSchema,
} from "@/server/modules/form-rm/ttd-saya.service";

export const runtime = "nodejs";

/** PNG ≈ 450 KB → base64 ≈ 600 KB + JSON. */
const BATAS_BODY = 700 * 1024;

/**
 * TTD & paraf tersimpan MILIK pengguna login (bukan pengguna lain — id dari
 * sesi). GET untuk siapa pun yang boleh membuka Form RM; simpan/hapus butuh hak
 * ubah Form RM + penjaga lintas situs & laju. Tidak pernah di-cache.
 */
export async function GET() {
  try {
    const user = await authorizeAny(MODUL_AKSES_FORM_RM, "view");
    return tanpaCache(ok(await bacaTtdSaya(user.id)));
  } catch (err) {
    return tanpaCache(fail(err));
  }
}

/** PUT `{ jenis, png }` — simpan / ganti. */
export async function PUT(req: NextRequest) {
  try {
    const user = await authorizeAny(MODUL_AKSES_FORM_RM, "update");
    jagaTulis(req, user);
    const input = simpanTtdSayaSchema.parse(await readJsonTerbatas(req, BATAS_BODY));
    return tanpaCache(ok(await simpanTtdSaya(input, { id: user.id, nama: user.name, ip: clientIp(req) })));
  } catch (err) {
    return tanpaCache(fail(err));
  }
}

/** DELETE `?jenis=TTD|PARAF`. */
export async function DELETE(req: NextRequest) {
  try {
    const user = await authorizeAny(MODUL_AKSES_FORM_RM, "update");
    jagaTulis(req, user);
    const jenis = jenisTtdSayaSchema.safeParse(req.nextUrl.searchParams.get("jenis"));
    if (!jenis.success) throw new NotFoundError();
    return tanpaCache(ok(await hapusTtdSaya(jenis.data, { id: user.id, nama: user.name, ip: clientIp(req) })));
  } catch (err) {
    return tanpaCache(fail(err));
  }
}

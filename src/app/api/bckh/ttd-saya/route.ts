import type { NextRequest } from "next/server";
import { authorizeAny } from "@/server/rbac/guard";
import { fail, ok, readJsonTerbatas, tanpaCache } from "@/server/lib/http";
import { clientIp } from "@/server/lib/request";
import { NotFoundError } from "@/server/lib/errors";
import { jagaTulisBckh } from "@/server/modules/bckh/bckh.akses";
import { BATAS_BODY_TTD } from "@/server/modules/bckh/bckh.schema";
import {
  bacaTtdSaya,
  hapusTtdSaya,
  jenisTtdSayaSchema,
  simpanTtdSaya,
  simpanTtdSayaSchema,
} from "@/server/modules/form-rm/ttd-saya.service";

export const runtime = "nodejs";

/** Pengisi BCKH & penanda tangan laporan BCKH. */
const MODUL = ["bckh", "bckh.persetujuan"] as const;

/**
 * TTD tersimpan MILIK pengguna login untuk menandatangani laporan BCKH — tabel yang
 * sama dengan "Tanda tangan saya" Form RM (satu TTD untuk dua modul). Hanya baris
 * pemanggil (id dari sesi). Tidak pernah di-cache.
 */
export async function GET() {
  try {
    const user = await authorizeAny(MODUL, "view");
    return tanpaCache(ok(await bacaTtdSaya(user.id)));
  } catch (err) {
    return tanpaCache(fail(err));
  }
}

/** PUT `{ jenis, png }` — simpan / ganti. */
export async function PUT(req: NextRequest) {
  try {
    const user = await authorizeAny(MODUL, "update");
    jagaTulisBckh(req, user);
    const input = simpanTtdSayaSchema.parse(await readJsonTerbatas(req, BATAS_BODY_TTD));
    return tanpaCache(ok(await simpanTtdSaya(input, { id: user.id, nama: user.name, ip: clientIp(req) })));
  } catch (err) {
    return tanpaCache(fail(err));
  }
}

/** DELETE `?jenis=TTD|PARAF`. */
export async function DELETE(req: NextRequest) {
  try {
    const user = await authorizeAny(MODUL, "update");
    jagaTulisBckh(req, user);
    const jenis = jenisTtdSayaSchema.safeParse(req.nextUrl.searchParams.get("jenis"));
    if (!jenis.success) throw new NotFoundError();
    return tanpaCache(ok(await hapusTtdSaya(jenis.data, { id: user.id, nama: user.name, ip: clientIp(req) })));
  } catch (err) {
    return tanpaCache(fail(err));
  }
}

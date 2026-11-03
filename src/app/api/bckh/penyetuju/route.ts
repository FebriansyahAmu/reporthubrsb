import { daftarPenyetuju } from "@/server/modules/bckh/bckh.relasi";
import { authorizeAny } from "@/server/rbac/guard";
import { fail, ok, tanpaCache } from "@/server/lib/http";

export const runtime = "nodejs";

/**
 * GET /api/bckh/penyetuju — akun yang bisa dipilih sebagai atasan langsung (pegawai,
 * `bckh:update`) atau direktur "Mengetahui" (admin, `bckh.pengaturan:update`).
 */
export async function GET() {
  try {
    await authorizeAny(["bckh", "bckh.pengaturan"], "update");
    return tanpaCache(ok(await daftarPenyetuju()));
  } catch (err) {
    return tanpaCache(fail(err));
  }
}

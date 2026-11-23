import { withPermission } from "@/server/rbac/guard";
import { ok, tanpaCache } from "@/server/lib/http";
import { listOpsiRuangan } from "@/server/modules/inventaris/petugas.service";

export const runtime = "nodejs";

/**
 * GET /api/master/pengguna/opsi-ruangan — ruangan Inventaris aktif (id, kode,
 * nama) untuk pemilih "Ruangan tugas" di form akun. Tanpa data PJ/NIP.
 */
export const GET = withPermission("master.pengguna", "view", async () => {
  return tanpaCache(ok(await listOpsiRuangan()));
});

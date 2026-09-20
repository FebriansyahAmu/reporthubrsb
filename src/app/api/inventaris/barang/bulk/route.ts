import { NextRequest } from "next/server";
import { withPermission } from "@/server/rbac/guard";
import { ok } from "@/server/lib/http";
import { ValidationError } from "@/server/lib/errors";
import { bulkCreateBarang } from "@/server/modules/inventaris/barang.service";

export const runtime = "nodejs";

/**
 * POST /api/inventaris/barang/bulk — simpan banyak barang (mode Lembar/Excel).
 * Body: { rows: BarangCreateInput[] }. Validasi & simpan per-baris; balikan hasil
 * per-baris (ok/error) agar UI bisa menandai baris berhasil/gagal.
 */
export const POST = withPermission("inventaris.barang", "create", async (req: NextRequest, _ctx, user) => {
  const body = (await req.json().catch(() => ({}))) as { rows?: unknown };
  const rows = Array.isArray(body.rows) ? body.rows : [];
  if (rows.length === 0) throw new ValidationError({ rows: ["Tidak ada baris untuk disimpan."] });
  if (rows.length > 200) throw new ValidationError({ rows: ["Maksimal 200 baris sekali simpan."] });
  const res = await bulkCreateBarang(rows, user);
  return ok(res);
});

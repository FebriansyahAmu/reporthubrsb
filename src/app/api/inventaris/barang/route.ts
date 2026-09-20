import { NextRequest } from "next/server";
import { withPermission } from "@/server/rbac/guard";
import { ok } from "@/server/lib/http";
import { barangCreateSchema, barangQuerySchema } from "@/server/modules/inventaris/barang.schema";
import { createBarang, listBarang } from "@/server/modules/inventaris/barang.service";

export const runtime = "nodejs";

/** GET /api/inventaris/barang — daftar unit aset (filter + paginasi). */
export const GET = withPermission("inventaris.barang", "view", async (req: NextRequest) => {
  const q = barangQuerySchema.parse(Object.fromEntries(req.nextUrl.searchParams));
  const result = await listBarang(q);
  return ok(result.data, result.meta);
});

/** POST /api/inventaris/barang — buat unit aset baru (kode auto bila kosong). */
export const POST = withPermission("inventaris.barang", "create", async (req: NextRequest, _ctx, user) => {
  const input = barangCreateSchema.parse(await req.json());
  const created = await createBarang(input, user);
  return ok(created);
});

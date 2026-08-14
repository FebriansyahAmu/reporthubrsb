import { NextRequest } from "next/server";
import { withPermission } from "@/server/rbac/guard";
import { createRoleSchema } from "@/server/modules/master/master.schema";
import { createRole, listRoles } from "@/server/modules/master/master.service";
import { ok } from "@/server/lib/http";
import { clientIp } from "@/server/lib/request";

export const runtime = "nodejs";

/** GET /api/master/peran — daftar peran + jumlah pengguna + grant. */
export const GET = withPermission("master.peran", "view", async () => {
  return ok(await listRoles());
});

/** POST /api/master/peran — buat peran kustom (default tanpa izin). */
export const POST = withPermission("master.peran", "create", async (req: NextRequest, _ctx, user) => {
  const input = createRoleSchema.parse(await req.json());
  const created = await createRole(input, { id: user.id, name: user.name, ip: clientIp(req) });
  return ok(created);
});

import { NextRequest } from "next/server";
import { withPermission } from "@/server/rbac/guard";
import { createUserSchema, listUsersQuerySchema } from "@/server/modules/master/master.schema";
import { createUser, listUsers } from "@/server/modules/master/master.service";
import { ok } from "@/server/lib/http";
import { clientIp } from "@/server/lib/request";

export const runtime = "nodejs";

/** GET /api/master/pengguna — daftar akun (paginasi + filter). */
export const GET = withPermission("master.pengguna", "view", async (req: NextRequest) => {
  const q = listUsersQuerySchema.parse(Object.fromEntries(req.nextUrl.searchParams));
  const res = await listUsers(q);
  return ok(res.data, res.meta);
});

/** POST /api/master/pengguna — buat akun baru. */
export const POST = withPermission("master.pengguna", "create", async (req: NextRequest, _ctx, user) => {
  const input = createUserSchema.parse(await req.json());
  const created = await createUser(input, { id: user.id, name: user.name, ip: clientIp(req) });
  return ok(created);
});

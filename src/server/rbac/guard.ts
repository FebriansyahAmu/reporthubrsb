import "server-only";
import { redirect } from "next/navigation";
import type { NextRequest } from "next/server";
import { getCurrentUser, type SessionUser } from "@/server/auth/session";
import { fail } from "@/server/lib/http";
import { ForbiddenError, UnauthorizedError } from "@/server/lib/errors";
import { can } from "./permissions";
import type { ModuleAction } from "./modules";

/**
 * Guard HALAMAN (Server Component / layout). Belum login → ke login; tak berizin
 * → ke /403. Mengembalikan SessionUser agar bisa dipakai halaman.
 */
export async function requireModule(
  moduleKey: string,
  action: ModuleAction = "view",
): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/");
  if (!(await can(user.role, moduleKey, action))) redirect("/403");
  return user;
}

/**
 * Guard API inline — dipakai di dalam `try { ... } catch (err) { return fail(err) }`
 * yang sudah ada. Melempar UnauthorizedError/ForbiddenError yang diterjemahkan
 * `fail()` menjadi 401/403. Mengembalikan SessionUser bila lolos.
 */
export async function authorize(
  moduleKey: string,
  action: ModuleAction = "view",
): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) throw new UnauthorizedError();
  if (!(await can(user.role, moduleKey, action))) throw new ForbiddenError();
  return user;
}

type RouteCtx<P> = { params: Promise<P> };
type GuardedHandler<P> = (
  req: NextRequest,
  ctx: RouteCtx<P>,
  user: SessionUser,
) => Promise<Response> | Response;

/**
 * Guard API (Route Handler). Membungkus handler dgn authn + authz. Mengembalikan
 * 401 (belum login) / 403 (tak berizin) via helper `fail()` standar; error lain
 * juga diterjemahkan `fail()`. Fail closed.
 */
export function withPermission<P = Record<string, string>>(
  moduleKey: string,
  action: ModuleAction,
  handler: GuardedHandler<P>,
) {
  return async (req: NextRequest, ctx: RouteCtx<P>): Promise<Response> => {
    try {
      const user = await getCurrentUser();
      if (!user) throw new UnauthorizedError();
      if (!(await can(user.role, moduleKey, action))) throw new ForbiddenError();
      return await handler(req, ctx, user);
    } catch (err) {
      return fail(err);
    }
  };
}

/** Cek izin di dalam Server Component/handler tanpa redirect (utk render kondisional). */
export async function hasModule(
  user: SessionUser | null,
  moduleKey: string,
  action: ModuleAction = "view",
): Promise<boolean> {
  if (!user) return false;
  return can(user.role, moduleKey, action);
}

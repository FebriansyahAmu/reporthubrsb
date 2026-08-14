import "server-only";
import { getAppDb } from "@/server/db/app.client";
import { isValidModuleAction, MODULE_KEYS } from "./modules";

/**
 * Resolusi izin efektif per PERAN (roleKey), dengan cache in-process TTL pendek.
 * Superadmin (peran `isSuperadmin`) melewati SEMUA cek → `can()` selalu true dan
 * `allowedModuleKeys()` = seluruh katalog. Lihat docs/rbac/02-otorisasi.md.
 *
 * Fail closed: bila resolusi gagal (mis. DB timeout), error DILEMPAR — pemanggil
 * (guard) menolak akses, tidak pernah meloloskan.
 */
type Resolved = { perms: Set<string>; superadmin: boolean; at: number };

const TTL_MS = 60_000;
const cache = new Map<string, Resolved>();

async function resolve(roleKey: string): Promise<Resolved> {
  const hit = cache.get(roleKey);
  if (hit && Date.now() - hit.at < TTL_MS) return hit;

  const role = await getAppDb().role.findUnique({
    where: { key: roleKey },
    include: { permissions: true },
  });

  const superadmin = !!role?.isSuperadmin;
  const perms = new Set<string>(
    (role?.permissions ?? [])
      .filter((p) => isValidModuleAction(p.moduleKey, p.action))
      .map((p) => `${p.moduleKey}:${p.action}`),
  );
  const val: Resolved = { perms, superadmin, at: Date.now() };
  cache.set(roleKey, val);
  return val;
}

/** Cek satu izin modul+aksi untuk sebuah peran. Superadmin → selalu true. */
export async function can(roleKey: string, moduleKey: string, action = "view"): Promise<boolean> {
  const { perms, superadmin } = await resolve(roleKey);
  if (superadmin) return true;
  return perms.has(`${moduleKey}:${action}`);
}

/** Kunci modul yang boleh DIBUKA peran (punya minimal aksi `view`). */
export async function allowedModuleKeys(roleKey: string): Promise<Set<string>> {
  const { perms, superadmin } = await resolve(roleKey);
  if (superadmin) return new Set(MODULE_KEYS);
  const out = new Set<string>();
  for (const p of perms) {
    const [key, action] = p.split(":");
    if (action === "view") out.add(key);
  }
  return out;
}

/** Apakah peran superadmin (akses penuh). */
export async function isSuperadminRole(roleKey: string): Promise<boolean> {
  return (await resolve(roleKey)).superadmin;
}

/** Buang cache satu peran (dipanggil setelah admin mengubah grant peran itu). */
export function invalidateRole(roleKey: string): void {
  cache.delete(roleKey);
}

/** Buang seluruh cache (mis. perubahan massal). */
export function invalidateAllRoles(): void {
  cache.clear();
}

import "server-only";
import { queryAllUsers } from "./audit.dal";

/**
 * Resolver pengguna (PENGGUNA id → nama/login) dengan cache in-process TTL pendek.
 * Master pengguna kecil (± 200 baris) & jarang berubah → sekali muat, dipakai
 * ulang untuk resolusi nama di timeline (hindari N+1). Tidak pernah memuat PASSWORD.
 */
export type UserMini = { id: string; nama: string | null; login: string | null };

type Cache = { at: number; map: Map<string, UserMini>; list: UserMini[] };
const TTL_MS = 5 * 60_000;

const globalForResolver = globalThis as unknown as { auditUserCache?: Cache };

export async function getUserResolver(): Promise<Cache> {
  const hit = globalForResolver.auditUserCache;
  if (hit && Date.now() - hit.at < TTL_MS) return hit;
  const list = await queryAllUsers();
  const cache: Cache = { at: Date.now(), map: new Map(list.map((u) => [u.id, u])), list };
  globalForResolver.auditUserCache = cache;
  return cache;
}

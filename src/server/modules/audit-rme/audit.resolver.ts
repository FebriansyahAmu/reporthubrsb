import "server-only";
import { queryAllUsers } from "./audit.dal";
import { tarifLabel } from "./kunjungan.constants";
import { queryRuanganMaster, queryTindakanMaster, type RuanganRow } from "./kunjungan.dal";

/**
 * Resolver pengguna (PENGGUNA id → nama/login) dengan cache in-process TTL pendek.
 * Master pengguna kecil (± 200 baris) & jarang berubah → sekali muat, dipakai
 * ulang untuk resolusi nama di timeline (hindari N+1). Tidak pernah memuat PASSWORD.
 */
export type UserMini = {
  id: string;
  nama: string | null;
  login: string | null;
  /** `master.pegawai.PROFESI` (referensi JENIS=36) — null bila pengguna bukan pegawai. */
  profesi: number | null;
};

type Cache = { at: number; map: Map<string, UserMini>; list: UserMini[] };
type RuanganCache = { at: number; map: Map<string, RuanganRow> };
/** `tarifIds` = ID master.tindakan yang tergolong item tarif (`TINDAKAN_TARIF`). */
type TindakanCache = { at: number; tarifIds: number[] };
const TTL_MS = 5 * 60_000;

const globalForResolver = globalThis as unknown as {
  auditUserCache?: Cache;
  auditRuanganCache?: RuanganCache;
  auditTindakanCache?: TindakanCache;
};

/** Klasifikasi master tindakan → daftar ID item tarif (± 340 baris, cache TTL sama). */
export async function getTindakanResolver(): Promise<TindakanCache> {
  const hit = globalForResolver.auditTindakanCache;
  if (hit && Date.now() - hit.at < TTL_MS) return hit;
  const rows = await queryTindakanMaster();
  const cache: TindakanCache = { at: Date.now(), tarifIds: rows.filter((r) => tarifLabel(r.nama)).map((r) => r.id) };
  globalForResolver.auditTindakanCache = cache;
  return cache;
}

/** Resolver ruang leaf → nama/jenis/bangsal induk (± 40 baris, cache TTL sama). */
export async function getRuanganResolver(): Promise<RuanganCache> {
  const hit = globalForResolver.auditRuanganCache;
  if (hit && Date.now() - hit.at < TTL_MS) return hit;
  const rows = await queryRuanganMaster();
  const cache: RuanganCache = { at: Date.now(), map: new Map(rows.map((r) => [r.id, r])) };
  globalForResolver.auditRuanganCache = cache;
  return cache;
}

export async function getUserResolver(): Promise<Cache> {
  const hit = globalForResolver.auditUserCache;
  if (hit && Date.now() - hit.at < TTL_MS) return hit;
  const list = await queryAllUsers();
  const cache: Cache = { at: Date.now(), map: new Map(list.map((u) => [u.id, u])), list };
  globalForResolver.auditUserCache = cache;
  return cache;
}

import "server-only";
import { createTtlCache } from "@/server/lib/ttl-cache";
import { queryKategoriRl32, querySmf } from "./rl32.dal";
import type { KategoriRl32, SmfRef } from "./rl32.types";

/** Jenis pelayanan RL 3.2 & daftar SMF jarang berubah (master SIMGOS) → cache 10 menit. */
const cacheKategori = createTtlCache<KategoriRl32[]>("rl32-kategori", { ttlMs: 10 * 60_000, max: 1 });
const cacheSmf = createTtlCache<SmfRef[]>("rl32-smf", { ttlMs: 10 * 60_000, max: 1 });

export async function kategoriRl32(): Promise<KategoriRl32[]> {
  return (await cacheKategori.get("semua", queryKategoriRl32)).value;
}

export async function daftarSmf(): Promise<SmfRef[]> {
  return (await cacheSmf.get("semua", querySmf)).value;
}

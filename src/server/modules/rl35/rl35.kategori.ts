import "server-only";
import { createTtlCache } from "@/server/lib/ttl-cache";
import { queryInstansiRl35, queryKategoriRl35 } from "./rl35.dal";
import type { InstansiRl35, KategoriRl35 } from "./rl35.types";

/** Jenis kegiatan RL 3.5 & identitas instansi jarang berubah (master SIMGOS) → cache 10 menit. */
const cacheKategori = createTtlCache<KategoriRl35[]>("rl35-kategori", { ttlMs: 10 * 60_000, max: 1 });
const cacheInstansi = createTtlCache<InstansiRl35 | null>("rl35-instansi", { ttlMs: 10 * 60_000, max: 1 });

const str = (x: unknown): string => (typeof x === "string" ? x.trim() : x == null ? "" : String(x));

export async function kategoriRl35(): Promise<KategoriRl35[]> {
  return (await cacheKategori.get("semua", queryKategoriRl35)).value;
}

export async function instansiRl35(): Promise<InstansiRl35 | null> {
  const { value } = await cacheInstansi.get("rs", async () => {
    const r = await queryInstansiRl35();
    return r ? { kodeRs: str(r.kodeRs), nama: str(r.nama), kodeWilayah: str(r.kodeWilayah), kota: str(r.kota) } : null;
  });
  return value;
}

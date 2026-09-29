import "server-only";

/**
 * Cache in-process ber-TTL + *single-flight* untuk hasil komputasi berat (mis.
 * batch SIMGOS). Permintaan bersamaan dengan kunci sama berbagi SATU promise
 * (tak ada komputasi ganda). Disimpan di `globalThis` → bertahan HMR dev & dibagi
 * seluruh request satu proses. Entri gagal tidak di-cache.
 */
type Entry<T> = { at: number; value: T };
type Slot<T> = { store: Map<string, Entry<T>>; inflight: Map<string, Promise<Entry<T>>> };

export type CacheHit<T> = { value: T; at: number; hit: boolean };

export type TtlCache<T> = {
  get(key: string, loader: () => Promise<T>, opts?: { fresh?: boolean }): Promise<CacheHit<T>>;
  invalidate(key?: string): void;
};

export function createTtlCache<T>(name: string, opts: { ttlMs: number; max: number }): TtlCache<T> {
  const g = globalThis as unknown as Record<string, Slot<T> | undefined>;
  const slotKey = `__ttlCache_${name}`;
  const slot: Slot<T> = (g[slotKey] ??= { store: new Map(), inflight: new Map() });

  function simpan(key: string, entry: Entry<T>) {
    slot.store.delete(key); // urutan sisip = urutan umur → entri tertua di depan
    slot.store.set(key, entry);
    while (slot.store.size > opts.max) {
      const tertua = slot.store.keys().next().value;
      if (tertua === undefined) break;
      slot.store.delete(tertua);
    }
  }

  return {
    async get(key, loader, getOpts) {
      const hit = slot.store.get(key);
      if (!getOpts?.fresh && hit && Date.now() - hit.at < opts.ttlMs) {
        return { value: hit.value, at: hit.at, hit: true };
      }
      let job = slot.inflight.get(key);
      if (!job) {
        job = loader()
          .then((value) => {
            const entry = { at: Date.now(), value };
            simpan(key, entry);
            return entry;
          })
          .finally(() => slot.inflight.delete(key));
        slot.inflight.set(key, job);
      }
      const entry = await job;
      return { value: entry.value, at: entry.at, hit: false };
    },
    invalidate(key) {
      if (key === undefined) slot.store.clear();
      else slot.store.delete(key);
    },
  };
}

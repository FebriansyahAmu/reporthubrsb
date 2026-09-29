import "server-only";

/**
 * Pembatas konkurensi sederhana (semaphore FIFO) untuk pekerjaan berat yang
 * memakai sumber daya bersama (mis. pool SIMGOS `connectionLimit: 5`). Pekerjaan
 * di atas batas menunggu giliran, tidak ditolak. Disimpan di `globalThis` agar
 * satu batas berlaku untuk seluruh request satu proses (juga saat HMR dev).
 */
type State = { aktif: number; antre: (() => void)[] };

export type Limiter = <T>(job: () => Promise<T>) => Promise<T>;

export function createLimiter(name: string, max: number): Limiter {
  const g = globalThis as unknown as Record<string, State | undefined>;
  const state: State = (g[`__limiter_${name}`] ??= { aktif: 0, antre: [] });

  return async (job) => {
    // Slot diserahkan LANGSUNG ke pengantre berikutnya (aktif tak turun-naik) →
    // pemanggil baru tak bisa menyalip di sela penyerahan dan melewati batas.
    if (state.aktif >= max) await new Promise<void>((resolve) => state.antre.push(resolve));
    else state.aktif++;
    try {
      return await job();
    } finally {
      const berikut = state.antre.shift();
      if (berikut) berikut();
      else state.aktif--;
    }
  };
}

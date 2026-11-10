import "server-only";
import { DETAK_SSE, frameSse, SELANG_DETAK_MS, type EventSse } from "@/features/form-rm/ttd-siaga/sse";

/**
 * Hub aliran SSE perangkat TTD siaga (docs/PRD_TTD_Perangkat_Siaga.md §7.2).
 * Di memori proses (globalThis: dibagi semua route handler dalam satu proses,
 * tahan HMR dev). Produksi = satu container/satu proses; bila kelak lebih dari
 * satu instance, hub ini diganti pub/sub (Redis) — antarmukanya sengaja kecil.
 *
 * - SATU aliran per perangkat: aliran baru menggantikan yang lama (event
 *   `diganti`, lalu ditutup).
 * - Detak global tiap 20 dtk; tulis gagal / antrean menumpuk = koneksi mati →
 *   dibersihkan.
 * - Kapasitas dibatasi; hub tak pernah tumbuh tanpa batas.
 */

export const MAKS_ALIRAN_PERANGKAT = 200;
/** Antrean byte yang belum terbaca klien melebihi ini = klien macet → putus. */
const MAKS_ANTREAN_BYTE = 64 * 1024;

export type KoneksiPerangkat = {
  readonly seq: number;
  readonly perangkatId: string;
  readonly ip: string | null;
  readonly mulai: number;
  /** Tulis frame; false = koneksi sudah mati. */
  kirim: (teks: string) => boolean;
  tutup: () => void;
};

type Status = {
  perangkat: Map<string, KoneksiPerangkat>;
  seq: number;
  detak: ReturnType<typeof setInterval> | null;
  /** Dipanggil setiap koneksi terlepas (mis. untuk mencatat terakhir aktif). */
  saatLepas: ((k: KoneksiPerangkat) => void) | null;
};

const g = globalThis as unknown as { __ttdSiagaHub?: Status };
const st: Status = (g.__ttdSiagaHub ??= { perangkat: new Map(), seq: 0, detak: null, saatLepas: null });

function lepasInternal(k: KoneksiPerangkat): boolean {
  if (st.perangkat.get(k.perangkatId)?.seq !== k.seq) return false;
  st.perangkat.delete(k.perangkatId);
  try {
    st.saatLepas?.(k);
  } catch {
    /* pencatat tak boleh mengganggu hub */
  }
  return true;
}

function pastikanDetak() {
  if (st.detak) return;
  st.detak = setInterval(() => {
    for (const k of [...st.perangkat.values()]) {
      if (!k.kirim(DETAK_SSE)) {
        lepasInternal(k);
        k.tutup();
      }
    }
  }, SELANG_DETAK_MS);
  st.detak.unref?.();
}

/** Penulis aliran untuk satu ReadableStream controller (aman dipanggil setelah tutup). */
export function penulisAliran(controller: ReadableStreamDefaultController<Uint8Array>) {
  const enc = new TextEncoder();
  let tertutup = false;
  return {
    kirim(teks: string): boolean {
      if (tertutup) return false;
      if (controller.desiredSize !== null && controller.desiredSize < -MAKS_ANTREAN_BYTE) return false;
      try {
        controller.enqueue(enc.encode(teks));
        return true;
      } catch {
        tertutup = true;
        return false;
      }
    },
    tutup() {
      if (tertutup) return;
      tertutup = true;
      try {
        controller.close();
      } catch {
        /* sudah ditutup/dibatalkan klien */
      }
    },
  };
}

export const hubTtd = {
  /** Masih ada ruang untuk aliran perangkat ini? (perangkat yang sudah tersambung selalu boleh mengganti). */
  adaRuang(perangkatId: string): boolean {
    return st.perangkat.has(perangkatId) || st.perangkat.size < MAKS_ALIRAN_PERANGKAT;
  },

  /**
   * Daftarkan aliran perangkat. Aliran lama perangkat yang sama diberi event
   * `diganti` lalu ditutup; dikembalikan agar pemanggil bisa menilai
   * (deteksi koneksi ganda).
   */
  sambungkan(a: {
    perangkatId: string;
    ip: string | null;
    kirim: (teks: string) => boolean;
    tutup: () => void;
  }): { koneksi: KoneksiPerangkat; diganti: KoneksiPerangkat | null } {
    const k: KoneksiPerangkat = { seq: ++st.seq, mulai: Date.now(), ...a };
    const lama = st.perangkat.get(a.perangkatId) ?? null;
    if (lama) {
      lama.kirim(frameSse("diganti", {}));
      st.perangkat.delete(a.perangkatId); // tanpa saatLepas: perangkat tetap tersambung lewat aliran baru
      lama.tutup();
    }
    st.perangkat.set(a.perangkatId, k);
    pastikanDetak();
    return { koneksi: k, diganti: lama };
  },

  /** Lepas aliran (klien putus). Tak berefek bila aliran itu sudah digantikan. */
  lepas(k: KoneksiPerangkat): void {
    lepasInternal(k);
  },

  /** Kirim event akhir (mis. `dicabut`) lalu tutup aliran perangkat. */
  putuskan(perangkatId: string, event: Extract<EventSse, "dicabut">): void {
    const k = st.perangkat.get(perangkatId);
    if (!k) return;
    k.kirim(frameSse(event, {}));
    lepasInternal(k);
    k.tutup();
  },

  /** Kirim satu frame ke aliran perangkat (Langkah 3: permintaan). */
  kirimKe(perangkatId: string, teks: string): boolean {
    const k = st.perangkat.get(perangkatId);
    if (!k) return false;
    if (k.kirim(teks)) return true;
    lepasInternal(k);
    k.tutup();
    return false;
  },

  terhubung(perangkatId: string): boolean {
    return st.perangkat.has(perangkatId);
  },

  jumlah(): number {
    return st.perangkat.size;
  },

  /** Pasang pencatat lepas (sekali, dari service). */
  saatLepas(fn: (k: KoneksiPerangkat) => void): void {
    st.saatLepas = fn;
  },
};

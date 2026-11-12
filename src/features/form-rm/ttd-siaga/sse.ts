/**
 * Penyusun frame Server-Sent Events (docs/PRD_TTD_Perangkat_Siaga.md §7.3).
 * SATU-SATUNYA jalan menulis ke aliran: nama event dari daftar tetap, `data`
 * = JSON satu baris. String mentah tak pernah disisipkan, sehingga nilai
 * berisi baris baru tidak bisa menyuntik field/event tambahan (injeksi frame).
 */

export const EVENT_SSE = ["siap", "detak", "diganti", "permintaan", "selesai", "dicabut", "status", "ttd"] as const;
export type EventSse = (typeof EVENT_SSE)[number];

/** Selang detak; harus jauh di bawah `proxy_read_timeout` nginx (60 dtk bawaan). */
export const SELANG_DETAK_MS = 20_000;
/** Klien menganggap aliran mati bila tak ada event selama ini (2 detak + kelonggaran). */
export const BATAS_SENYAP_MS = 45_000;

/** Instruksi jeda sambung ulang untuk EventSource. */
export function retrySse(ms: number): string {
  if (!Number.isInteger(ms) || ms < 0) throw new RangeError("retry tidak sah");
  return `retry: ${ms}\n\n`;
}

/**
 * Penyusun frame dengan daftar event TETAP milik satu aliran (dipakai juga
 * aliran isian Form RM). Nama event di luar daftar → galat; data JSON satu baris.
 */
export function penyusunFrame<E extends string>(daftar: readonly E[]) {
  return (event: E, data: Record<string, unknown>): string => {
    if (!(daftar as readonly string[]).includes(event)) throw new RangeError("event SSE tidak dikenal");
    const json = JSON.stringify(data);
    // JSON.stringify meng-escape \n dan \r; pagar ini menjaga bila ada perubahan kelak.
    if (/[\r\n]/.test(json)) throw new RangeError("data SSE harus satu baris");
    return `event: ${event}\ndata: ${json}\n\n`;
  };
}

export const frameSse: (event: EventSse, data: Record<string, unknown>) => string = penyusunFrame(EVENT_SSE);

/**
 * Detak = EVENT sungguhan, bukan baris komentar `: ping`: EventSource tidak
 * meneruskan komentar ke JavaScript, padahal klien butuh detak untuk mengenali
 * koneksi yang mati diam-diam (watchdog `BATAS_SENYAP_MS`).
 */
export const DETAK_SSE = frameSse("detak", {});

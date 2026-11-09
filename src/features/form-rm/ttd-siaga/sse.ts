/**
 * Penyusun frame Server-Sent Events (docs/PRD_TTD_Perangkat_Siaga.md §7.3).
 * SATU-SATUNYA jalan menulis ke aliran: nama event dari daftar tetap, `data`
 * = JSON satu baris. String mentah tak pernah disisipkan, sehingga nilai
 * berisi baris baru tidak bisa menyuntik field/event tambahan (injeksi frame).
 */

export const EVENT_SSE = ["siap", "permintaan", "selesai", "dicabut", "status", "ttd"] as const;
export type EventSse = (typeof EVENT_SSE)[number];

/** Detak: baris komentar (diabaikan EventSource) agar proxy tak menutup koneksi diam. */
export const DETAK_SSE = ": ping\n\n";
/** Selang detak; harus jauh di bawah `proxy_read_timeout` nginx (60 dtk bawaan). */
export const SELANG_DETAK_MS = 20_000;

/** Instruksi jeda sambung ulang untuk EventSource. */
export function retrySse(ms: number): string {
  if (!Number.isInteger(ms) || ms < 0) throw new RangeError("retry tidak sah");
  return `retry: ${ms}\n\n`;
}

export function frameSse(event: EventSse, data: Record<string, unknown>): string {
  if (!(EVENT_SSE as readonly string[]).includes(event)) throw new RangeError("event SSE tidak dikenal");
  const json = JSON.stringify(data);
  // JSON.stringify meng-escape \n dan \r; pagar ini menjaga bila ada perubahan kelak.
  if (/[\r\n]/.test(json)) throw new RangeError("data SSE harus satu baris");
  return `event: ${event}\ndata: ${json}\n\n`;
}

/**
 * Siklus hidup isian Form RM (PRD §6.3) — mesin status eksplisit, murni, dipakai
 * server (penegakan) dan UI (tombol yang tersedia).
 *
 *   DRAF ──FINALKAN──▶ FINAL ──BUKA_KOREKSI──▶ DRAF
 *   DRAF / FINAL ──BATALKAN──▶ BATAL   (tidak ada hapus permanen)
 */

export const STATUS_ISIAN = ["DRAF", "FINAL", "BATAL"] as const;
export type StatusIsian = (typeof STATUS_ISIAN)[number];

export const AKSI_ISIAN = ["FINALKAN", "BUKA_KOREKSI", "BATALKAN"] as const;
export type AksiIsian = (typeof AKSI_ISIAN)[number];

const TRANSISI: Record<AksiIsian, Partial<Record<StatusIsian, StatusIsian>>> = {
  FINALKAN: { DRAF: "FINAL" },
  BUKA_KOREKSI: { FINAL: "DRAF" },
  BATALKAN: { DRAF: "BATAL", FINAL: "BATAL" },
};

/** Status setelah `aksi`, atau null bila aksi tidak berlaku untuk status ini. */
export function statusSetelah(status: StatusIsian, aksi: AksiIsian): StatusIsian | null {
  return TRANSISI[aksi][status] ?? null;
}

/** Aksi atas isian FINAL (membuka koreksi / membatalkan) hanya untuk pengelola RM. */
export const perluIzinKelola = (status: StatusIsian): boolean => status === "FINAL";

/** Setiap aksi selain finalisasi wajib beralasan (tercatat di revisi). */
export const butuhAlasan = (aksi: AksiIsian): boolean => aksi !== "FINALKAN";

export const adalahStatusIsian = (s: string): s is StatusIsian => (STATUS_ISIAN as readonly string[]).includes(s);

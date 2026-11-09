/**
 * Mesin status permintaan TTD siaga (docs/PRD_TTD_Perangkat_Siaga.md §6).
 * Murni: hub memanggil `transisi` dan HANYA menerapkan hasil non-null
 * (compare-and-set) — status tidak pernah ditimpa buta.
 *
 *            ┌────────── ulang (PC) ──────────┐
 *            ▼                                 │
 * DIKIRIM ─► TAMPIL ─► DITANDATANGANI ─► DITERIMA
 *    └─────────┴────────────┴──► DIBATALKAN / KEDALUWARSA
 */

export const STATUS_PERMINTAAN = [
  "DIKIRIM",
  "TAMPIL",
  "DITANDATANGANI",
  "DITERIMA",
  "DIBATALKAN",
  "KEDALUWARSA",
] as const;
export type StatusPermintaan = (typeof STATUS_PERMINTAAN)[number];

export const AKSI_PERMINTAAN = ["tampil", "ttd", "terima", "ulang", "batal", "kedaluwarsa"] as const;
export type AksiPermintaan = (typeof AKSI_PERMINTAAN)[number];

/** Tenggat menggambar sejak dikirim / diminta ulang. */
export const TENGGAT_TTD_MS = 3 * 60_000;
/** Tenggat petugas memutuskan (pakai / minta ulang) setelah TTD masuk. */
export const TENGGAT_KEPUTUSAN_MS = 2 * 60_000;
/** Jeda menunggu aliran PC tersambung lagi sebelum permintaan dibatalkan. */
export const GRASI_PC_MS = 10_000;
/** Lama status akhir disimpan (agar klien yang terlambat tetap tahu hasilnya). */
export const SIMPAN_AKHIR_MS = 30_000;

const AKHIR: ReadonlySet<StatusPermintaan> = new Set(["DITERIMA", "DIBATALKAN", "KEDALUWARSA"]);

export const statusAkhir = (s: StatusPermintaan): boolean => AKHIR.has(s);

const TABEL: Record<StatusPermintaan, Partial<Record<AksiPermintaan, StatusPermintaan>>> = {
  DIKIRIM: { tampil: "TAMPIL", ttd: "DITANDATANGANI", batal: "DIBATALKAN", kedaluwarsa: "KEDALUWARSA" },
  TAMPIL: { tampil: "TAMPIL", ttd: "DITANDATANGANI", batal: "DIBATALKAN", kedaluwarsa: "KEDALUWARSA" },
  DITANDATANGANI: { terima: "DITERIMA", ulang: "DIKIRIM", batal: "DIBATALKAN", kedaluwarsa: "KEDALUWARSA" },
  DITERIMA: {},
  DIBATALKAN: {},
  KEDALUWARSA: {},
};

/** Status berikutnya, atau null bila aksi tidak sah pada status itu. */
export function transisi(status: StatusPermintaan, aksi: AksiPermintaan): StatusPermintaan | null {
  return TABEL[status][aksi] ?? null;
}

/** Tenggat yang berlaku untuk status tak-akhir (ms sejak `mulai` status itu). */
export function tenggatUntuk(status: StatusPermintaan): number | null {
  if (status === "DIKIRIM" || status === "TAMPIL") return TENGGAT_TTD_MS;
  if (status === "DITANDATANGANI") return TENGGAT_KEPUTUSAN_MS;
  return null;
}

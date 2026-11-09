/**
 * Tab halaman detail form (`/form-rm/f/[kode]?tab=`). Modul biasa (bukan
 * "use client") agar halaman server bisa membaca nilainya — ekspor dari berkas
 * klien menjadi referensi klien di server.
 */
export const TAB_DETAIL_FORM = ["pasien", "riwayat"] as const;
export type TabDetailForm = (typeof TAB_DETAIL_FORM)[number];

export const tabDetailDariParam = (v: unknown): TabDetailForm =>
  typeof v === "string" && (TAB_DETAIL_FORM as readonly string[]).includes(v) ? (v as TabDetailForm) : "pasien";

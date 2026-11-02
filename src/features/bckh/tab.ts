/** Tab halaman profil BCKH (`?tab=`) — modul biasa agar bisa dipakai halaman server & klien. */
export const TAB_BCKH = ["ikhtisar", "kegiatan", "log", "dasbor", "laporan"] as const;
export type TabBckh = (typeof TAB_BCKH)[number];

export const tabDari = (v: string | string[] | undefined): TabBckh =>
  typeof v === "string" && (TAB_BCKH as readonly string[]).includes(v) ? (v as TabBckh) : "ikhtisar";

export type HakBckh = { ubah: boolean; cetak: boolean; atur: boolean };

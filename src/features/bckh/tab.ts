/** Tab halaman profil BCKH (`?tab=`) — modul biasa agar bisa dipakai halaman server & klien. */
export const TAB_BCKH = ["ikhtisar", "kegiatan", "log", "dasbor", "laporan"] as const;
export type TabBckh = (typeof TAB_BCKH)[number];

export const tabDari = (v: string | string[] | undefined): TabBckh =>
  typeof v === "string" && (TAB_BCKH as readonly string[]).includes(v) ? (v as TabBckh) : "ikhtisar";

export type HakBckh = { ubah: boolean; cetak: boolean; atur: boolean };

/** Tab menu "Pegawai & Persetujuan" (`/bckh/persetujuan?tab=`). */
export const TAB_PERSETUJUAN = ["menunggu", "riwayat", "pegawai"] as const;
export type TabPersetujuan = (typeof TAB_PERSETUJUAN)[number];

export const tabPersetujuanDari = (v: string | string[] | undefined): TabPersetujuan =>
  typeof v === "string" && (TAB_PERSETUJUAN as readonly string[]).includes(v) ? (v as TabPersetujuan) : "menunggu";

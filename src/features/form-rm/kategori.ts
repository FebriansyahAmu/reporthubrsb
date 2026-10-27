import { Baby, ClipboardPlus, FileSignature, FileText, GraduationCap, Siren, type LucideIcon } from "lucide-react";

/**
 * KATEGORI FORM RM — dasar katalog dan modul RBAC per kategori
 * (`form-rm.<kategori>`, PRD §8.4). Murni (tanpa skema form) agar katalog modul
 * RBAC bisa mengimpornya tanpa membawa registri form. Urutan = urutan tampil.
 *
 * Kategori baru ditambahkan bersama form pertamanya (uji registri menolak
 * kategori tanpa form).
 */
export const KATEGORI_FORM = {
  "administrasi-persetujuan": {
    label: "Administrasi & Persetujuan",
    keterangan: "Persetujuan umum, persetujuan tindakan, dan penanggung jawab pasien.",
    ikon: FileSignature,
  },
  "gawat-darurat": {
    label: "Gawat Darurat",
    keterangan: "Triase dan asesmen pasien Instalasi Gawat Darurat.",
    ikon: Siren,
  },
  "asesmen-keperawatan": {
    label: "Asesmen Keperawatan",
    keterangan: "Pengkajian keperawatan berkala: risiko jatuh, nyeri, dan asesmen lanjutan.",
    ikon: ClipboardPlus,
  },
  kebidanan: {
    label: "Kebidanan",
    keterangan: "Pemantauan persalinan dengan partograf dan catatan persalinan.",
    ikon: Baby,
  },
  edukasi: {
    label: "Edukasi",
    keterangan: "Edukasi pasien dan keluarga oleh tenaga kesehatan.",
    ikon: GraduationCap,
  },
  "ringkasan-pemulangan": {
    label: "Ringkasan & Pemulangan",
    keterangan: "Ringkasan masuk-keluar dan dokumen pemulangan pasien.",
    ikon: FileText,
  },
} as const satisfies Record<string, { label: string; keterangan: string; ikon: LucideIcon }>;

export type KategoriForm = keyof typeof KATEGORI_FORM;

export const DAFTAR_KATEGORI = Object.keys(KATEGORI_FORM) as KategoriForm[];

/** Modul RBAC seluruh kategori — grant lama `form-rm` tetap berlaku untuk semua form. */
export const MODUL_FORM_RM = "form-rm";
/** Modul RBAC buka koreksi / batalkan isian FINAL (Instalasi RM), lintas kategori. */
export const MODUL_KELOLA_FORM_RM = "form-rm.kelola";

export const modulKategori = (k: KategoriForm): string => `${MODUL_FORM_RM}.${k}`;

/** Semua modul yang membuka akses ke Form RM (gerbang menu, halaman, dan API). */
export const MODUL_AKSES_FORM_RM: readonly string[] = [MODUL_FORM_RM, ...DAFTAR_KATEGORI.map(modulKategori)];

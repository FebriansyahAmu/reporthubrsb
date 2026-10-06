import { FileHeart, FileText, GraduationCap, Siren, type LucideIcon } from "lucide-react";
import type { KodeForm } from "./registry";

/** Metadata tampilan per form (label ringkas, keterangan, ikon) — pelengkap registri. */
export const TAMPILAN_FORM: Record<KodeForm, { singkat: string; label: string; keterangan: string; ikon: LucideIcon }> = {
  "RM.04": {
    singkat: "Triase",
    label: "Triase IGD",
    keterangan: "Kedatangan, tanda vital & kategori triase I–V pasien IGD.",
    ikon: Siren,
  },
  "RM.21": {
    singkat: "Edukasi",
    label: "Edukasi Pasien & Keluarga Terintegrasi",
    keterangan: "Persiapan edukasi, kebutuhan & catatan edukasi pasien/keluarga.",
    ikon: GraduationCap,
  },
  "RM.01": {
    singkat: "Ringkasan",
    label: "Ringkasan Masuk & Keluar",
    keterangan: "Ringkasan data masuk/keluar & sebab kematian.",
    ikon: FileText,
  },
  "RM.03": {
    singkat: "Consent",
    label: "Persetujuan Umum (General Consent)",
    keterangan: "Persetujuan umum rawat inap pasien.",
    ikon: FileHeart,
  },
};

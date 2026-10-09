import { Ambulance, DoorOpen, FileHeart, FilePenLine, FileText, GraduationCap, ShieldAlert, Siren, type LucideIcon } from "lucide-react";
import type { KodeForm } from "./registry";

type TampilanForm = {
  singkat: string;
  label: string;
  keterangan: string;
  ikon: LucideIcon;
  /** Form berulang: satuan satu isian ("Satu isian per tindakan") & kapan diisi bila tak wajib. */
  berulang?: { satuan: string; bila: string };
};

/**
 * Metadata tampilan per form (label ringkas, keterangan, ikon) — pelengkap
 * registri. Terpisah dari registri agar katalog & daftar tak memuat skema form.
 */
export const TAMPILAN_FORM: Record<KodeForm, TampilanForm> = {
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
  "RM.22": {
    singkat: "Persetujuan Tindakan",
    label: "Informasi dan Persetujuan / Penolakan Tindakan Kedokteran",
    keterangan: "Informed consent per tindakan: pemberian informasi, lalu lembar persetujuan atau penolakan.",
    ikon: FilePenLine,
    berulang: { satuan: "tindakan", bila: "Diisi bila ada tindakan" },
  },
  "RM.33": {
    singkat: "Persetujuan Rujukan",
    label: "Informasi dan Persetujuan / Penundaan & Penolakan Rujukan",
    keterangan: "Per rujukan: pemberian informasi, lalu pasien setuju, menunda, atau menolak dirujuk.",
    ikon: Ambulance,
    berulang: { satuan: "rujukan", bila: "Diisi bila pasien dirujuk" },
  },
  "RM.41": {
    singkat: "Pulang APS",
    label: "Surat Pernyataan Pulang Atas Permintaan Sendiri",
    keterangan: "Pernyataan pasien / keluarga pulang atas permintaan sendiri beserta alasannya, disaksikan petugas RS.",
    ikon: DoorOpen,
  },
  "RM.MORSE": {
    singkat: "Risiko Jatuh",
    label: "Risiko Jatuh Dewasa (Skala Morse)",
    keterangan: "Pengkajian awal & ulang risiko jatuh dengan skor Morse otomatis.",
    ikon: ShieldAlert,
  },
};

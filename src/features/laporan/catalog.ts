import {
  BedDouble,
  ClipboardList,
  CreditCard,
  FileBarChart,
  FileText,
  FlaskConical,
  Pill,
  ShieldCheck,
  Stethoscope,
  TrendingUp,
  UserRound,
  Users,
  type LucideIcon,
} from "lucide-react";

export type ReportStatus = "tersedia" | "segera";

export type ReportItem = {
  title: string;
  description: string;
  icon: LucideIcon;
  status: ReportStatus;
  href?: string; // wajib bila status "tersedia"
};

export type ReportGroup = {
  title: string;
  description: string;
  items: ReportItem[];
};

/**
 * Katalog seluruh laporan. Yang "tersedia" sudah terhubung ke halaman;
 * yang "segera" adalah placeholder terstruktur untuk tahap berikutnya.
 */
export const LAPORAN_CATALOG: ReportGroup[] = [
  {
    title: "Kunjungan & Pelayanan",
    description: "Rekap aktivitas kunjungan pasien.",
    items: [
      {
        title: "Laporan Kunjungan Pasien",
        description: "Rekap kunjungan dengan filter periode, unit, status, dan cara bayar.",
        icon: FileBarChart,
        status: "tersedia",
        href: "/laporan/kunjungan",
      },
      {
        title: "Kunjungan per Poli / Unit",
        description: "Rekapitulasi jumlah kunjungan dikelompokkan per poli atau unit.",
        icon: Users,
        status: "segera",
      },
      {
        title: "Kunjungan per Dokter",
        description: "Produktivitas & jumlah pasien yang dilayani tiap dokter.",
        icon: UserRound,
        status: "segera",
      },
      {
        title: "Kunjungan per Cara Bayar",
        description: "Distribusi kunjungan berdasarkan BPJS, umum, dan asuransi.",
        icon: CreditCard,
        status: "segera",
      },
    ],
  },
  {
    title: "Rekam Medis",
    description: "Dokumen & rekap klinis.",
    items: [
      {
        title: "Cetak Resume Medik",
        description: "Cari kunjungan yang sudah selesai, lalu cetak resume mediknya.",
        icon: FileText,
        status: "tersedia",
        href: "/laporan/resume-medik",
      },
      {
        title: "10 Besar Penyakit",
        description: "Peringkat diagnosa (ICD-10) terbanyak pada periode tertentu.",
        icon: TrendingUp,
        status: "segera",
      },
      {
        title: "Laporan Rujukan",
        description: "Rekap rujukan masuk dan keluar antar fasilitas kesehatan.",
        icon: Stethoscope,
        status: "segera",
      },
      {
        title: "Sensus Harian Rawat Inap",
        description: "Kondisi harian bed, pasien masuk, keluar, dan pindah ruangan.",
        icon: BedDouble,
        status: "segera",
      },
    ],
  },
  {
    title: "BPJS",
    description: "Laporan terkait penjaminan BPJS.",
    items: [
      {
        title: "Laporan Waktu Tunggu (WTA)",
        description: "Rekap waktu tunggu antrean Task 1–7 untuk kepatuhan BPJS.",
        icon: ClipboardList,
        status: "segera",
      },
      {
        title: "Rekap SEP & Klaim",
        description: "Rekapitulasi penerbitan SEP dan status pengajuan klaim.",
        icon: ShieldCheck,
        status: "segera",
      },
    ],
  },
  {
    title: "Farmasi & Penunjang",
    description: "Laporan unit penunjang.",
    items: [
      {
        title: "Laporan Pemakaian Obat",
        description: "Rekap penggunaan & distribusi obat per periode.",
        icon: Pill,
        status: "segera",
      },
      {
        title: "Laporan Pemeriksaan Laboratorium",
        description: "Rekap jenis dan jumlah pemeriksaan lab yang dilakukan.",
        icon: FlaskConical,
        status: "segera",
      },
    ],
  },
];

export const LAPORAN_TERSEDIA = LAPORAN_CATALOG.flatMap((g) => g.items).filter(
  (i) => i.status === "tersedia",
).length;

export const LAPORAN_TOTAL = LAPORAN_CATALOG.flatMap((g) => g.items).length;

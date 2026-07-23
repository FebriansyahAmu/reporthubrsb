import {
  FileBarChart,
  FileText,
  LayoutGrid,
  ListChecks,
  Users,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  description?: string;
  /** Cocok hanya bila path sama persis (untuk halaman index seperti /laporan). */
  exact?: boolean;
};

export type NavSection = {
  title: string;
  items: NavItem[];
};

export const NAV: NavSection[] = [
  {
    title: "Menu",
    items: [
      {
        href: "/kunjungan",
        label: "Kunjungan Pasien",
        icon: Users,
        description: "Daftar kunjungan pasien",
      },
    ],
  },
  {
    title: "Monitoring",
    items: [
      {
        href: "/monitoring/antrean-bpjs",
        label: "Antrean BPJS",
        icon: ListChecks,
        description: "Monitoring Task 1–7 antrean BPJS",
      },
    ],
  },
  {
    title: "Laporan",
    items: [
      {
        href: "/laporan",
        label: "Pusat Laporan",
        icon: LayoutGrid,
        description: "Katalog semua laporan",
        exact: true,
      },
      {
        href: "/laporan/kunjungan",
        label: "Laporan Kunjungan",
        icon: FileBarChart,
        description: "Rekap kunjungan dengan filter",
      },
      {
        href: "/laporan/resume-medik",
        label: "Cetak Resume Medik",
        icon: FileText,
        description: "Cetak resume kunjungan selesai",
      },
    ],
  },
];

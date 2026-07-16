import { FileBarChart, FileText, Users, type LucideIcon } from "lucide-react";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  description?: string;
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
    title: "Report",
    items: [
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

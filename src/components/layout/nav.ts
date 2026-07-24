import { LayoutGrid, ListChecks, Users, type LucideIcon } from "lucide-react";

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
      // Semua laporan diakses lewat Pusat Laporan (katalog), bukan menu terpisah.
      {
        href: "/laporan",
        label: "Pusat Laporan",
        icon: LayoutGrid,
        description: "Katalog semua laporan",
      },
    ],
  },
];

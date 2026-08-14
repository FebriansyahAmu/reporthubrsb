import {
  Activity,
  ClipboardList,
  FileSignature,
  FolderCheck,
  Hourglass,
  LayoutGrid,
  ListChecks,
  ShieldCheck,
  Stethoscope,
  Users,
  UsersRound,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  description?: string;
  /** Modul RBAC yang mengatur akses item ini (lihat src/server/rbac/modules.ts). */
  moduleKey: string;
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
        moduleKey: "kunjungan",
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
        moduleKey: "monitoring.antrean-bpjs",
      },
    ],
  },
  {
    title: "Monitoring Pelayanan",
    items: [
      {
        href: "/monitoring/pelayanan/kunjungan",
        label: "Kunjungan",
        icon: Activity,
        description: "Kunjungan & lama rawat per rentang waktu",
        moduleKey: "monitoring.pelayanan",
      },
      {
        href: "/monitoring/pelayanan/belum-final",
        label: "Belum Difinalkan",
        icon: Hourglass,
        description: "Kunjungan belum ditutup (KELUAR kosong)",
        moduleKey: "monitoring.pelayanan",
      },
      {
        href: "/monitoring/pelayanan/diagnosa",
        label: "Kelengkapan Diagnosa",
        icon: Stethoscope,
        description: "Kunjungan final tanpa diagnosa / ICD",
        moduleKey: "monitoring.pelayanan",
      },
      {
        href: "/monitoring/pelayanan/resume",
        label: "Kelengkapan Resume",
        icon: ClipboardList,
        description: "Kunjungan final tanpa resume medis",
        moduleKey: "monitoring.pelayanan",
      },
    ],
  },
  {
    title: "Berkas Klaim",
    items: [
      {
        href: "/berkas-klaim/rm",
        label: "Berkas Klaim RM",
        icon: FolderCheck,
        description: "Berkas pasien final untuk klaim",
        moduleKey: "berkas-klaim",
      },
    ],
  },
  {
    title: "Form RM",
    items: [
      {
        href: "/form-rm",
        label: "Form RM (Admisi)",
        icon: FileSignature,
        description: "Isi formulir RM pasien saat pendaftaran",
        moduleKey: "form-rm",
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
        moduleKey: "laporan",
      },
    ],
  },
  {
    title: "Master",
    items: [
      {
        href: "/master/pengguna",
        label: "Pengguna",
        icon: UsersRound,
        description: "Kelola akun & data pengguna",
        moduleKey: "master.pengguna",
      },
      {
        href: "/master/peran",
        label: "Peran & Hak Akses",
        icon: ShieldCheck,
        description: "Peran dan izin akses per modul",
        moduleKey: "master.peran",
      },
    ],
  },
];

/** Filter NAV berdasarkan kunci modul yang boleh diakses; buang section kosong. */
export function filterNav(sections: NavSection[], allowed: ReadonlySet<string>): NavSection[] {
  return sections
    .map((s) => ({ ...s, items: s.items.filter((i) => allowed.has(i.moduleKey)) }))
    .filter((s) => s.items.length > 0);
}

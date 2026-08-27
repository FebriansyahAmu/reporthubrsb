import {
  Activity,
  ClipboardList,
  FileSignature,
  FolderCheck,
  Hourglass,
  LayoutGrid,
  ListChecks,
  Settings,
  ShieldCheck,
  Stethoscope,
  Users,
  UsersRound,
  type LucideIcon,
} from "lucide-react";

/**
 * TAKSONOMI MODUL (workspace) — struktur navigasi "per modul".
 *
 * Aplikasi dibagi menjadi beberapa modul kerja yang saling terisolasi: pengguna
 * memilih satu modul lewat switcher, lalu sidebar HANYA menampilkan halaman modul
 * itu. Modul admin (Master) dipisah — diakses lewat ikon Pengaturan, tidak ikut di
 * dropdown modul kerja.
 *
 * File ini bebas server-only (dipakai komponen client). Akses nyata tetap
 * ditegakkan guard halaman/API terhadap `moduleKey` (lihat src/server/rbac/*).
 */
export type WorkspaceItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  description?: string;
  /** Kunci modul RBAC yang mengatur akses item ini (lihat src/server/rbac/modules.ts). */
  moduleKey: string;
};

export type Workspace = {
  /** ID stabil workspace (untuk switcher & pencocokan rute). */
  key: string;
  label: string;
  icon: LucideIcon;
  description?: string;
  /** True untuk area admin (Master) — dipisah dari dropdown modul kerja. */
  admin?: boolean;
  items: WorkspaceItem[];
};

export const WORKSPACES: Workspace[] = [
  {
    key: "monitoring-pelayanan",
    label: "Monitoring Pelayanan",
    icon: Activity,
    description: "Kunjungan pasien, kelengkapan diagnosa & resume",
    items: [
      {
        href: "/kunjungan",
        label: "Kunjungan Pasien",
        icon: Users,
        description: "Daftar kunjungan pasien",
        moduleKey: "kunjungan",
      },
      {
        href: "/monitoring/pelayanan/kunjungan",
        label: "Kunjungan & Lama Rawat",
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
    key: "monitoring-antrean-mjkn",
    label: "Monitoring Antrean MJKN",
    icon: ListChecks,
    description: "Monitoring Task 1–7 antrean Mobile JKN / BPJS",
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
    key: "berkas-klaim",
    label: "Berkas & Klaim",
    icon: FolderCheck,
    description: "Berkas pasien final untuk klaim",
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
    key: "laporan",
    label: "Laporan",
    icon: LayoutGrid,
    description: "Katalog semua laporan",
    items: [
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
    key: "form-rm",
    label: "Form RM",
    icon: FileSignature,
    description: "Isi formulir RM pasien saat pendaftaran",
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
    key: "master",
    label: "Master",
    icon: Settings,
    description: "Pengaturan pengguna & hak akses",
    admin: true,
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

/** Item yang boleh dilihat dalam sebuah workspace, berdasarkan modul yang diizinkan. */
export function allowedItems(ws: Workspace, allowed: ReadonlySet<string>): WorkspaceItem[] {
  return ws.items.filter((i) => allowed.has(i.moduleKey));
}

/** Workspace yang punya minimal satu item yang boleh diakses (item sudah terfilter). */
export function visibleWorkspaces(allowed: ReadonlySet<string>): Workspace[] {
  return WORKSPACES.map((w) => ({ ...w, items: allowedItems(w, allowed) })).filter(
    (w) => w.items.length > 0,
  );
}

/** Cari kunci workspace pemilik sebuah rute (prefix item terpanjang menang). */
export function workspaceKeyForPath(pathname: string): string | null {
  let best: { key: string; len: number } | null = null;
  for (const w of WORKSPACES) {
    for (const it of w.items) {
      if (
        (pathname === it.href || pathname.startsWith(it.href + "/")) &&
        (!best || it.href.length > best.len)
      ) {
        best = { key: w.key, len: it.href.length };
      }
    }
  }
  return best?.key ?? null;
}

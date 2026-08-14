/**
 * KATALOG MODUL — sumber kebenaran RBAC (di kode, bukan DB).
 *
 * Setiap modul = area fitur/rute yang dilindungi izin. DB hanya menyimpan GRANT
 * (peran → moduleKey:action), yang divalidasi terhadap katalog ini. Menambah
 * modul = menambah entri di sini (satu PR, ter-review) — TANPA migrasi DB.
 *
 * File ini bebas server-only (dipakai juga oleh nav & UI Hak Akses). Jangan impor
 * modul Node-only di sini.
 */
import {
  Activity,
  FileSignature,
  FolderCheck,
  LayoutGrid,
  ListChecks,
  ShieldCheck,
  Users,
  UsersRound,
  type LucideIcon,
} from "lucide-react";

export type ModuleAction = "view" | "create" | "update" | "delete" | "print";

export type AppModule = {
  /** ID stabil & unik, mis. "master.pengguna". Dipakai di grant & guard. */
  key: string;
  /** Grup tampilan (menu & matriks izin). */
  group: string;
  label: string;
  description?: string;
  icon: LucideIcon;
  /** Rute UI utama (untuk menu). Boleh kosong untuk modul non-menu. */
  navHref?: string;
  /** Prefix /api/... yang dijaga izin modul ini (untuk kontrak & uji). */
  apiPrefixes: string[];
  /** Aksi yang tersedia untuk modul ini. `view` = baseline membuka modul. */
  actions: ModuleAction[];
  order: number;
};

export const MODULES: readonly AppModule[] = [
  {
    key: "kunjungan",
    group: "Menu",
    label: "Kunjungan Pasien",
    description: "Daftar kunjungan pasien",
    icon: Users,
    navHref: "/kunjungan",
    apiPrefixes: ["/api/kunjungan"],
    actions: ["view"],
    order: 10,
  },
  {
    key: "monitoring.antrean-bpjs",
    group: "Monitoring",
    label: "Antrean BPJS",
    description: "Monitoring Task 1–7 antrean BPJS",
    icon: ListChecks,
    navHref: "/monitoring/antrean-bpjs",
    apiPrefixes: ["/api/monitoring/antrean-bpjs"],
    actions: ["view", "update"],
    order: 20,
  },
  {
    key: "monitoring.pelayanan",
    group: "Monitoring Pelayanan",
    label: "Monitoring Pelayanan",
    description: "Kunjungan, belum final, kelengkapan diagnosa & resume",
    icon: Activity,
    navHref: "/monitoring/pelayanan/kunjungan",
    apiPrefixes: ["/api/monitoring/pelayanan"],
    actions: ["view"],
    order: 30,
  },
  {
    key: "berkas-klaim",
    group: "Berkas Klaim",
    label: "Berkas Klaim RM",
    description: "Berkas pasien final untuk klaim",
    icon: FolderCheck,
    navHref: "/berkas-klaim/rm",
    apiPrefixes: ["/api/berkas-klaim", "/api/print/simgos"],
    actions: ["view", "create", "update", "print"],
    order: 40,
  },
  {
    key: "form-rm",
    group: "Form RM",
    label: "Form RM (Admisi)",
    description: "Isi formulir RM pasien saat pendaftaran",
    icon: FileSignature,
    navHref: "/form-rm",
    apiPrefixes: ["/api/form-rm"],
    actions: ["view", "create", "update", "print"],
    order: 50,
  },
  {
    key: "laporan",
    group: "Laporan",
    label: "Pusat Laporan",
    description: "Katalog semua laporan",
    icon: LayoutGrid,
    navHref: "/laporan",
    apiPrefixes: ["/api/laporan"],
    actions: ["view", "print"],
    order: 60,
  },
  {
    key: "master.pengguna",
    group: "Master",
    label: "Pengguna",
    description: "Kelola akun & data pengguna",
    icon: UsersRound,
    navHref: "/master/pengguna",
    apiPrefixes: ["/api/master/pengguna"],
    actions: ["view", "create", "update", "delete"],
    order: 90,
  },
  {
    key: "master.peran",
    group: "Master",
    label: "Peran & Hak Akses",
    description: "Peran dan izin akses per modul",
    icon: ShieldCheck,
    navHref: "/master/peran",
    apiPrefixes: ["/api/master/peran"],
    actions: ["view", "create", "update", "delete"],
    order: 91,
  },
] as const;

const BY_KEY = new Map(MODULES.map((m) => [m.key, m]));

export const MODULE_KEYS: readonly string[] = MODULES.map((m) => m.key);

export function getModule(key: string): AppModule | undefined {
  return BY_KEY.get(key);
}

/** Validasi pasangan modul+aksi terhadap katalog (buang grant usang saat resolusi). */
export function isValidModuleAction(key: string, action: string): boolean {
  const m = BY_KEY.get(key);
  return !!m && (m.actions as readonly string[]).includes(action);
}

/** Prefix API → moduleKey (prefix terpanjang menang). Untuk kontrak & uji CI. */
export function moduleKeyForApiPath(pathname: string): string | null {
  let best: { key: string; len: number } | null = null;
  for (const m of MODULES) {
    for (const p of m.apiPrefixes) {
      if ((pathname === p || pathname.startsWith(p + "/")) && (!best || p.length > best.len)) {
        best = { key: m.key, len: p.length };
      }
    }
  }
  return best?.key ?? null;
}

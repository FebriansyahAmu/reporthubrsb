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
  Boxes,
  ClipboardList,
  DoorOpen,
  FileBarChart,
  FileSignature,
  Fingerprint,
  FolderCheck,
  History,
  Landmark,
  LayoutDashboard,
  LayoutGrid,
  ListChecks,
  PackageSearch,
  ReceiptText,
  ShieldCheck,
  SlidersHorizontal,
  Users,
  UsersRound,
  Wrench,
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
    key: "dashboard",
    group: "Dashboard",
    label: "Dashboard",
    description: "Statistik ringkas kunjungan, tren & sensus",
    icon: LayoutDashboard,
    navHref: "/dashboard",
    apiPrefixes: ["/api/dashboard"],
    actions: ["view"],
    order: 5,
  },
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
    key: "inventaris",
    group: "Inventarisasi Barang",
    label: "Dashboard Inventaris",
    description: "Analitik & tren aset barang",
    icon: Boxes,
    navHref: "/inventaris",
    apiPrefixes: ["/api/inventaris/dashboard"],
    actions: ["view"],
    order: 70,
  },
  {
    key: "inventaris.barang",
    group: "Inventarisasi Barang",
    label: "Master Barang",
    description: "Data seluruh unit aset (CRUD, import, cetak)",
    icon: PackageSearch,
    navHref: "/inventaris/barang",
    apiPrefixes: ["/api/inventaris/barang"],
    actions: ["view", "create", "update", "delete", "print"],
    order: 71,
  },
  {
    key: "inventaris.kir",
    group: "Inventarisasi Barang",
    label: "KIR & BAST",
    description: "Kartu Inventaris Ruangan & Berita Acara Serah Terima Barang + cetak resmi",
    icon: ClipboardList,
    navHref: "/inventaris/kir",
    apiPrefixes: ["/api/inventaris/kir"],
    actions: ["view", "print"],
    order: 72,
  },
  {
    key: "inventaris.pemeliharaan",
    group: "Inventarisasi Barang",
    label: "Pemeliharaan Barang",
    description: "Checklist & riwayat perawatan/pengecekan aset",
    icon: Wrench,
    navHref: "/inventaris/pemeliharaan",
    apiPrefixes: ["/api/inventaris/pemeliharaan"],
    actions: ["view", "create", "update"],
    order: 73,
  },
  {
    key: "inventaris.pengaturan",
    group: "Inventarisasi Barang",
    label: "Pengaturan Inventaris",
    description: "Satuan, kondisi, sumber anggaran, kategori & ruangan",
    icon: SlidersHorizontal,
    navHref: "/inventaris/pengaturan",
    apiPrefixes: ["/api/inventaris/pengaturan"],
    actions: ["view", "update"],
    order: 74,
  },
  {
    key: "rekap-klaim",
    group: "Rekap Klaim BPJS",
    label: "Dashboard Rekap Klaim",
    description: "Ringkasan dana klaim INA-CBG's & rujukan ambulans",
    icon: Landmark,
    navHref: "/rekap-klaim",
    apiPrefixes: ["/api/rekap-klaim/dashboard"],
    actions: ["view"],
    order: 80,
  },
  {
    key: "rekap-klaim.data",
    group: "Rekap Klaim BPJS",
    label: "Data Klaim",
    description: "Entri klaim & potongan (CRUD, import, cetak)",
    icon: ReceiptText,
    navHref: "/rekap-klaim/data",
    apiPrefixes: ["/api/rekap-klaim/klaim", "/api/rekap-klaim/potongan", "/api/rekap-klaim/status", "/api/rekap-klaim/import"],
    actions: ["view", "create", "update", "delete", "print"],
    order: 81,
  },
  {
    key: "rekap-klaim.laporan",
    group: "Rekap Klaim BPJS",
    label: "Laporan & Rekapitulasi",
    description: "Rekap per tahun, pending, rujukan & export Excel/PDF",
    icon: FileBarChart,
    navHref: "/rekap-klaim/laporan",
    apiPrefixes: ["/api/rekap-klaim/laporan"],
    actions: ["view", "print"],
    order: 82,
  },
  {
    key: "rekap-klaim.audit",
    group: "Rekap Klaim BPJS",
    label: "Audit Trail Klaim",
    description: "Riwayat perubahan data klaim (read-only)",
    icon: History,
    navHref: "/rekap-klaim/audit",
    apiPrefixes: ["/api/rekap-klaim/audit"],
    actions: ["view"],
    order: 83,
  },
  {
    key: "audit-rme",
    group: "Audit Trail RME",
    label: "Audit Trail RME",
    description: "Log aktivitas rekam medis elektronik (read-only) — timeline, tren & kepatuhan",
    icon: Fingerprint,
    navHref: "/audit-rme",
    apiPrefixes: ["/api/audit-rme"],
    actions: ["view", "print"],
    order: 85,
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
  {
    key: "master.ruangan",
    group: "Master",
    label: "Mapping Ruangan",
    description: "Pejabat per ruangan (Kepala Ruangan = penandatangan Bukti Pelayanan)",
    icon: DoorOpen,
    navHref: "/master/ruangan",
    apiPrefixes: ["/api/master/ruangan"],
    actions: ["view", "update"],
    order: 92,
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

import {
  Activity,
  ArrowDownLeft,
  ArrowUpRight,
  BedDouble,
  ClipboardList,
  CreditCard,
  FileBarChart,
  FileText,
  FlaskConical,
  HandCoins,
  Hospital,
  MapPinned,
  NotebookText,
  Pill,
  ShieldCheck,
  Stethoscope,
  TrendingUp,
  Trophy,
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
  /** Modul RBAC tambahan (selain `laporan`) — kartu disembunyikan bila tak berizin. */
  moduleKey?: string;
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
        title: "Pengunjung Per Pasien",
        description:
          "Daftar kunjungan per pasien (RJ/IGD/RI) per ruangan — IGD dibedakan rawat jalan vs lanjut rawat inap. Ekspor Excel.",
        icon: ClipboardList,
        status: "tersedia",
        href: "/laporan/pengunjung",
      },
      {
        title: "Klasifikasi Kunjungan per Domisili",
        description:
          "Kunjungan IGD, rawat jalan & rawat inap menurut domisili pasien — dalam vs luar Kab. Bolaang Mongondow Timur, per kecamatan & kabupaten/kota asal. Ekspor Excel.",
        icon: MapPinned,
        status: "tersedia",
        href: "/laporan/domisili",
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
        title: "Cetak Resume Medis",
        description: "Resume medis lengkap (rawat jalan/inap) dari SP CetakMR2, siap cetak.",
        icon: NotebookText,
        status: "tersedia",
        href: "/laporan/resume-medis",
      },
      {
        title: "Cetak Resume Medik",
        description: "Cari kunjungan yang sudah selesai, lalu cetak resume mediknya.",
        icon: FileText,
        status: "tersedia",
        href: "/laporan/resume-medik",
      },
      {
        title: "10 Penyakit Terbanyak",
        description:
          "Peringkat diagnosa ICD-10 terbanyak — filter jenis layanan (RJ/IGD/RI), cara bayar & diagnosa utama.",
        icon: TrendingUp,
        status: "tersedia",
        href: "/laporan/penyakit",
      },
      {
        title: "RL 3.2 — Rawat Inap",
        description:
          "Rekap pelayanan rawat inap per jenis pelayanan (SIRS 6) per bulan, triwulan, atau rentang tanggal: pasien awal, masuk, pindahan, keluar hidup/mati, hari perawatan per kelas & alokasi TT — dikelompokkan menurut ruang rawat. Ekspor Excel/PDF.",
        icon: Hospital,
        status: "tersedia",
        href: "/laporan/rl32",
      },
      {
        title: "RL 4.1 — Morbiditas Rawat Inap",
        description:
          "Data morbiditas & mortalitas pasien rawat inap per ICD-10 dengan 25 kelompok umur, jenis kelamin & kematian (format SIRS Kemenkes). Ekspor Excel.",
        icon: Activity,
        status: "tersedia",
        href: "/laporan/rl41",
      },
      {
        title: "RL 5.1 — Morbiditas Rawat Jalan",
        description:
          "Data morbiditas pasien rawat jalan & gawat darurat per ICD-10 — kunjungan, kasus baru, jenis kelamin & 25 kelompok umur kasus baru (format SIRS Kemenkes). Ekspor Excel.",
        icon: Stethoscope,
        status: "tersedia",
        href: "/laporan/rl51",
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
    title: "Rujukan",
    description: "Rujukan antar fasilitas kesehatan (data BPJS).",
    items: [
      {
        title: "Rujukan Keluar",
        description: "Daftar pasien yang dirujuk keluar — faskes tujuan, diagnosa, & jenis pelayanan.",
        icon: ArrowUpRight,
        status: "tersedia",
        href: "/laporan/rujukan-keluar",
      },
      {
        title: "Rujukan Masuk",
        description: "Daftar rujukan masuk dari faskes lain ke rumah sakit.",
        icon: ArrowDownLeft,
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
    title: "Keuangan",
    description: "Laporan pendapatan — hanya tampil bagi peran dengan izin data keuangan.",
    items: [
      {
        title: "Pendapatan per Unit",
        description:
          "Pendapatan akomodasi & tindakan pelayanan tiap unit — Rawat Jalan, IGD, Rawat Inap, Laboratorium, Radiologi & Farmasi — untuk semua status tagihan: final, belum final & batal. Ekspor Excel/PDF.",
        icon: HandCoins,
        status: "tersedia",
        href: "/laporan/pendapatan-unit",
        moduleKey: "laporan.pendapatan",
      },
    ],
  },
  {
    title: "Farmasi & Penunjang",
    description: "Laporan unit penunjang.",
    items: [
      {
        title: "10 Obat Terbanyak",
        description: "Peringkat obat & alkes paling banyak dikeluarkan farmasi — filter jenis layanan, kategori & cara bayar.",
        icon: Trophy,
        status: "tersedia",
        href: "/laporan/farmasi-obat",
      },
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

/** Katalog yang boleh dilihat: buang kartu ber-`moduleKey` yang tak diizinkan, lalu grup kosong. */
export function katalogTerlihat(allowed: ReadonlySet<string>): ReportGroup[] {
  return LAPORAN_CATALOG.map((g) => ({
    ...g,
    items: g.items.filter((i) => !i.moduleKey || allowed.has(i.moduleKey)),
  })).filter((g) => g.items.length > 0);
}

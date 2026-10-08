/**
 * Konstanta laporan **RL 3.2 (SIRS 6) — Rawat Inap per Ruangan**. Bebas
 * `server-only`: dipakai server (agregasi, Excel, PDF) dan klien (label tabel,
 * saran pemetaan).
 *
 * Logika di-port dari SP SIMGOS `laporan.LaporanRL32RuanganRevisi`. SP itu
 * memetakan ruangan → jenis pelayanan lewat `master.rl32_ruangan_revisi`, yang
 * di instalasi ini berisi ID SMF (bukan ID ruangan) sehingga laporannya selalu
 * kosong. Pemetaan kini disimpan di DB aplikasi (`rl32_ruangan_peta`); SIMGOS
 * tetap READ-ONLY. Analisis: docs/analisis-rl32-ruangan-revisi.sql.
 */

import type { SatuanPeriode } from "./rl32.periode";

/** Jenis laporan SIMGOS (`master.jenis_laporan_detil`) "RL 3.2 (SIRS 6)" — kategori di `master.refrl`. */
export const RL32_JENIS_LAPORAN = { jenis: "100103", id: 102 } as const;

/** Rentang periode maksimum satu permintaan (hari). */
export const RL32_MAKS_HARI = 366;

export type MetrikRl32 =
  | "awal"
  | "masuk"
  | "pindahan"
  | "dipindahkan"
  | "hidup"
  | "mati"
  | "matiKurang48"
  | "matiLebih48"
  | "lamaDirawat"
  | "sisa"
  | "hariPerawatan"
  | "vvip"
  | "vip"
  | "kelas1"
  | "kelas2"
  | "kelas3"
  | "kelasKhusus";

export type InfoMetrik = {
  key: MetrikRl32;
  /** Label lengkap (Excel, tooltip). */
  label: string;
  /** Grup kolom bertingkat (header atas), bila ada. */
  grup?: string;
  /** Label di bawah grup / label sempit di tabel. */
  sub: string;
};

/** Kolom laporan sesuai urutan SP (`AWAL` … `KLSKHUSUS`); `JML_BED` terpisah. */
export const METRIK_RL32: readonly InfoMetrik[] = [
  { key: "awal", label: "Pasien Awal Bulan", sub: "Awal Bulan" },
  { key: "masuk", label: "Pasien Masuk", sub: "Masuk" },
  { key: "pindahan", label: "Pasien Pindahan", sub: "Pindahan" },
  { key: "dipindahkan", label: "Pasien Dipindahkan", sub: "Dipindahkan" },
  { key: "hidup", label: "Pasien Keluar Hidup", sub: "Keluar Hidup" },
  { key: "mati", label: "Pasien Keluar Mati", grup: "Pasien Keluar Mati", sub: "Jumlah" },
  { key: "matiKurang48", label: "Pasien Keluar Mati < 48 Jam", grup: "Pasien Keluar Mati", sub: "< 48 Jam" },
  { key: "matiLebih48", label: "Pasien Keluar Mati ≥ 48 Jam", grup: "Pasien Keluar Mati", sub: "≥ 48 Jam" },
  { key: "lamaDirawat", label: "Jumlah Lama Dirawat", sub: "Lama Dirawat" },
  { key: "sisa", label: "Pasien Akhir Bulan", sub: "Akhir Bulan" },
  { key: "hariPerawatan", label: "Jumlah Hari Perawatan", sub: "Hari Perawatan" },
  { key: "vvip", label: "Hari Perawatan VVIP", grup: "Rincian Hari Perawatan per Kelas", sub: "VVIP" },
  { key: "vip", label: "Hari Perawatan VIP", grup: "Rincian Hari Perawatan per Kelas", sub: "VIP" },
  { key: "kelas1", label: "Hari Perawatan Kelas I", grup: "Rincian Hari Perawatan per Kelas", sub: "Kelas I" },
  { key: "kelas2", label: "Hari Perawatan Kelas II", grup: "Rincian Hari Perawatan per Kelas", sub: "Kelas II" },
  { key: "kelas3", label: "Hari Perawatan Kelas III", grup: "Rincian Hari Perawatan per Kelas", sub: "Kelas III" },
  { key: "kelasKhusus", label: "Hari Perawatan Kelas Khusus", grup: "Rincian Hari Perawatan per Kelas", sub: "Kelas Khusus" },
];

export const LABEL_TEMPAT_TIDUR = "Jumlah Alokasi TT Awal Bulan";

/**
 * Label kolom menurut satuan periode: formulir SIRS 6 bulanan ("Pasien Awal
 * Bulan"); untuk triwulan/tahun/rentang bebas "Bulan" diganti satuannya.
 */
export function metrikRl32(satuan: SatuanPeriode = "Bulan"): readonly InfoMetrik[] {
  if (satuan === "Bulan") return METRIK_RL32;
  return METRIK_RL32.map((m) => ({ ...m, label: m.label.replace("Bulan", satuan), sub: m.sub.replace("Bulan", satuan) }));
}

export const labelTempatTidur = (satuan: SatuanPeriode = "Bulan") => LABEL_TEMPAT_TIDUR.replace("Bulan", satuan);

/** Kolom hari perawatan per kelas ← `master.kelas_simrs_rl.RL_KELAS` (1..6). */
export const METRIK_KELAS: Record<number, MetrikRl32> = {
  1: "vvip",
  2: "vip",
  3: "kelas1",
  4: "kelas2",
  5: "kelas3",
  6: "kelasKhusus",
};

/** Kelompok kolom bertingkat untuk header tabel (urutan tampil). */
export function grupMetrik(satuan: SatuanPeriode = "Bulan"): { grup: string | null; metrik: InfoMetrik[] }[] {
  const out: { grup: string | null; metrik: InfoMetrik[] }[] = [];
  for (const m of metrikRl32(satuan)) {
    const akhir = out.at(-1);
    if (m.grup && akhir?.grup === m.grup) akhir.metrik.push(m);
    else out.push({ grup: m.grup ?? null, metrik: [m] });
  }
  return out;
}

/**
 * Saran jenis pelayanan (ID `master.refrl` RL 3.2) dari nama ruangan. Hanya
 * saran — pemetaan tetap ditetapkan manusia. Urutan aturan penting: kata yang
 * lebih spesifik dulu (NICU/PICU/ICCU/RICU sebelum ICU). Nama yang tak cukup
 * jelas (mis. "PERAWATAN UMUM VIP") sengaja tanpa saran.
 */
const ATURAN_SARAN: readonly [RegExp, number][] = [
  [/\bNICU\b|NEONAT/, 31],
  [/\bPICU\b/, 32],
  [/\bICCU\b|\bCVCU\b|\bICVCU\b/, 29],
  [/\bRICU\b/, 30],
  [/\bHCU\b/, 28],
  [/\bICU\b/, 27],
  [/LUKA BAKAR/, 10],
  [/PERINATOLOGI/, 36],
  [/ISOLASI/, 33],
  [/REMAJA/, 4],
  [/ANAK/, 3],
  [/INTERNA|PENYAKIT DALAM/, 2],
  [/GINEKOLOGI/, 6],
  [/OBGYN|OBSTETRI|KEBIDANAN|BERSALIN|NIFAS/, 5],
  [/ORTHOPED|ORTOPED/, 8],
  [/BEDAH SARAF/, 9],
  [/BEDAH/, 7],
  [/SARAF|NEURO/, 11],
  [/JIWA/, 12],
  [/JANTUNG|KARDIO/, 18],
  [/PARU/, 19],
  [/GERIATRI/, 22],
];

export function saranJenisPelayanan(namaRuangan: string, idValid: ReadonlySet<number>): number | null {
  const nama = namaRuangan.toUpperCase();
  for (const [re, id] of ATURAN_SARAN) {
    if (re.test(nama)) return idValid.has(id) ? id : null;
  }
  return null;
}

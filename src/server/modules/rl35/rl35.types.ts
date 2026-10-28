/**
 * Tipe laporan **RL 3.5 (SIRS 6) — Rekapitulasi Kunjungan**. Angka dihitung per
 * ruangan (poliklinik & IGD) di SIMGOS (READ-ONLY), lalu dijumlahkan per jenis
 * kegiatan (`master.refrl`) memakai pemetaan ruangan di DB aplikasi.
 */
import type { SatuanPeriode } from "@/server/modules/rl32/rl32.periode";
import type { AlasanReklas } from "./rl35.constants";

/**
 * Cacah kunjungan formulir SIRS 6. L = JENIS_KELAMIN 1, P = JENIS_KELAMIN ≠ 1
 * (sama dengan SP; jenis kelamin kosong hanya masuk `total`). Dalam/luar =
 * domisili pasien (kabupaten `master.pasien.WILAYAH`) dibanding kabupaten RS.
 */
export type NilaiRl35 = {
  total: number;
  lk: number;
  pr: number;
  dalamLk: number;
  dalamPr: number;
  luarLk: number;
  luarPr: number;
};

/** Jenis kegiatan RL 3.5 (`master.refrl`). */
export type KategoriRl35 = { id: number; kode: string; deskripsi: string };

/**
 * terpetakan = ditetapkan admin; bawaan = belum ditetapkan, memakai saran dari
 * nama/jenis ruangan; dikecualikan = sengaja tidak dilaporkan; belum = tanpa
 * pemetaan & tanpa saran (angkanya tidak masuk laporan).
 */
export type StatusPeta = "terpetakan" | "bawaan" | "dikecualikan" | "belum";

/** Bagian kunjungan ruangan yang pindah baris karena diagnosis episode (aturan SP). */
export type PindahRl35 = { kategori: KategoriRl35; alasan: AlasanReklas; nilai: NilaiRl35 };

export type RuanganRl35 = {
  id: string;
  nama: string;
  /** 1 = rawat jalan (poliklinik), 2 = gawat darurat. */
  jenisKunjungan: number;
  aktif: boolean;
  status: StatusPeta;
  /** Jenis kegiatan ruangan (terpetakan/bawaan). */
  kategori: KategoriRl35 | null;
  /** Seluruh kunjungan ruangan (termasuk yang pindah baris). */
  nilai: NilaiRl35;
  /** Bagian yang pindah ke baris lain karena diagnosis (sudah termasuk di `nilai`). */
  pindah: PindahRl35[];
  aktivitas: boolean;
};

export type BarisRl35 = KategoriRl35 & {
  nilai: NilaiRl35;
  /** Ruangan penyumbang; `alasan` terisi bila hanya kunjungan berdiagnosis itu yang masuk ke sini. */
  ruangan: { id: string; nama: string; alasan: AlasanReklas | null }[];
};

/** Baris 66 & 77 formulir (SP tak menghitungnya). */
export type RataRataRl35 = {
  /** Jumlah tanggal dengan ≥ 1 kunjungan poliklinik terlaporkan. */
  hariBuka: number;
  /** Jumlah bulan kalender yang dicakup periode (pembagi rata-rata hari buka). */
  bulan: number;
  /** Baris 66: hariBuka ÷ bulan. */
  rataHariBuka: number;
  /** Kunjungan rawat jalan terlaporkan (tanpa IGD). */
  kunjunganRj: number;
  /** Baris 77: kunjunganRj ÷ hariBuka; null bila tak ada hari buka. */
  rataKunjunganPerHari: number | null;
};

export type InstansiRl35 = { kodeRs: string; nama: string; kodeWilayah: string; kota: string };

export type Rl35Result = {
  periode: { from: string; to: string; berjalan: boolean };
  /** "September 2026", "Triwulan III 2026", "Tahun 2025", selain itu rentang tanggal. */
  judulPeriode: string;
  satuan: SatuanPeriode;
  instansi: InstansiRl35 | null;
  /** Kabupaten/kota RS — acuan dalam/luar (4 digit `master.wilayah`). */
  kabupaten: { kode: string; nama: string };
  /** Semua jenis kegiatan RL 3.5 (urut ID; tanpa baris rata-rata/total). */
  baris: BarisRl35[];
  total: NilaiRl35;
  rataRata: RataRataRl35;
  /** Poliklinik & ruang IGD (yang ada di master + yang beraktivitas). */
  ruangan: RuanganRl35[];
  /** Ruangan tanpa pemetaan & tanpa saran yang beraktivitas → angkanya tidak masuk. */
  belumDipetakan: { id: string; nama: string; kunjungan: number }[];
  /** Kunjungan terlaporkan dengan domisili pasien tak tercatat (dihitung luar kab/kota). */
  domisiliTakTercatat: number;
  updatedAt: string;
};

/** Baris agregat mentah SIMGOS: satu ruangan × jenis kelamin × domisili × bendera diagnosis. */
export type BarisAgregat = {
  ruangan: string;
  /** 1 = L, 2 = P (≠ 1), 0 = tak tercatat. */
  jk: number;
  /** 1 = dalam kab/kota, 0 = luar, 2 = domisili tak tercatat. */
  dom: number;
  stroke: boolean;
  neonatal: boolean;
  gravid: boolean;
  /** Kunjungan = pasangan (pendaftaran, ruangan). */
  n: number;
};

/** Satu tanggal kunjungan poliklinik + ruangan yang melayani. */
export type HariKunjungan = { tanggal: string; ruangan: string[] };

/** Ruangan master SIMGOS yang ikut laporan. */
export type RuanganRow = { id: string; nama: string; jenisKunjungan: number; aktif: boolean };

/** Satu baris pemetaan tersimpan (DB aplikasi). `rlId` null = dikecualikan. */
export type PetaTersimpan = { ruanganId: string; rlId: number | null };

/** Satu ruangan di layar pemetaan. */
export type RuanganPemetaan = {
  id: string;
  nama: string;
  jenisKunjungan: number;
  aktif: boolean;
  status: StatusPeta;
  /** Jenis kegiatan efektif (terpetakan/bawaan). */
  rlId: number | null;
  saran: number | null;
  diubahOleh: string | null;
  diubahAt: string | null;
};

export type DaftarPemetaan = { ruangan: RuanganPemetaan[]; kategori: KategoriRl35[] };

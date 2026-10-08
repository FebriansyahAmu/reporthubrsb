/**
 * Tipe laporan **RL 3.2 (SIRS 6) — Rawat Inap per Ruangan**. Angka dihitung per
 * ruangan × SMF DPJP di SIMGOS (READ-ONLY), lalu dijumlahkan per jenis pelayanan
 * (`master.refrl`) memakai pemetaan ruangan (+ pemisahan menurut SMF DPJP) yang
 * disimpan di DB aplikasi.
 */
import type { MetrikRl32 } from "./rl32.constants";
import type { SatuanPeriode } from "./rl32.periode";

/** Cacah satu kolom: jumlah + laki-laki + perempuan (sesuai SP: P = JENIS_KELAMIN ≠ 1). */
export type Angka = { total: number; lk: number; pr: number };

export type NilaiRl32 = Record<MetrikRl32, Angka> & {
  /** Alokasi TT awal periode (`informasi.tempat_tidur`); null = tak ada data. */
  tempatTidur: number | null;
};

/** Jenis pelayanan RL 3.2 (`master.refrl`). */
export type KategoriRl32 = { id: number; kode: string; deskripsi: string };

/** SMF dokter (`master.referensi` JENIS 26). */
export type SmfRef = { id: number; nama: string };

/** terpetakan = ke satu jenis pelayanan; dikecualikan = sengaja tidak dilaporkan. */
export type StatusPeta = "terpetakan" | "dikecualikan" | "belum";

/** Bagian pasien ruangan ber-pisah DPJP yang jatuh ke satu jenis pelayanan. */
export type BagianRuangan = {
  kategori: KategoriRl32;
  /** SMF DPJP pasien bagian ini (kosong = hanya TT ruangan). */
  smf: SmfRef[];
  nilai: NilaiRl32;
};

export type RuanganRl32 = {
  id: string;
  nama: string;
  aktif: boolean;
  status: StatusPeta;
  /** Jenis pelayanan ruangan (bila terpetakan). */
  kategori: KategoriRl32 | null;
  /** Pasien dikelompokkan menurut SMF DPJP (hanya bila terpetakan). */
  pisahDpjp: boolean;
  /** Rincian per jenis pelayanan bila `pisahDpjp` (urut ID kategori). */
  bagian: BagianRuangan[];
  nilai: NilaiRl32;
  /** Ada pasien atau TT pada periode (ruangan tanpa aktivitas tak perlu diperingatkan). */
  aktivitas: boolean;
};

export type BarisRl32 = KategoriRl32 & {
  nilai: NilaiRl32;
  /** Ruangan penyumbang; `smf` terisi bila hanya pasien ber-SMF DPJP tsb yang masuk ke sini. */
  ruangan: { id: string; nama: string; smf: string[] | null }[];
};

export type InstansiRl32 = { kodeRs: string; nama: string; kodeProp: string; kota: string };

export type Rl32Result = {
  /** `hpSampai` = hari terakhir yang dihitung hari perawatannya (≤ hari ini); `berjalan` = periode belum berakhir. */
  periode: { from: string; to: string; hpSampai: string; berjalan: boolean };
  /** "September 2026", "Triwulan III 2026", "Tahun 2025", selain itu rentang tanggal. */
  judulPeriode: string;
  /** Satuan label kolom ("Pasien Awal Bulan/Triwulan/Tahun/Periode"). */
  satuan: SatuanPeriode;
  instansi: InstansiRl32 | null;
  /** Semua jenis pelayanan RL 3.2 (urut ID, termasuk yang kosong). */
  baris: BarisRl32[];
  /** Jumlah seluruh jenis pelayanan (= ruangan terpetakan). */
  total: NilaiRl32;
  /** Semua ruang rawat inap + ruangan lain yang beraktivitas pada periode. */
  ruangan: RuanganRl32[];
  /** Ruangan belum dipetakan tetapi beraktivitas → angkanya tidak masuk laporan. */
  belumDipetakan: { id: string; nama: string; pasien: number; tempatTidur: number | null }[];
  /** Pemetaan SMF DPJP yang dipakai ruangan ber-pisah DPJP. */
  pemisahan: { smf: SmfRef; kategori: KategoriRl32 }[];
  tempatTidur: { tanggal: string; tersedia: boolean };
  updatedAt: string;
};

/** Baris agregat mentah dari SIMGOS: satu metrik satu ruangan satu SMF DPJP (-1 = tak diketahui). */
export type BarisAgregat = { ruangan: string; smf: number; metrik: string; total: number; lk: number; pr: number };

/** Satu baris pemetaan ruangan tersimpan (DB aplikasi). `rlId` null = dikecualikan. */
export type PetaTersimpan = { ruanganId: string; rlId: number | null; pisahDpjp: boolean };

/** Satu ruangan di layar pemetaan. */
export type RuanganPemetaan = {
  id: string;
  nama: string;
  aktif: boolean;
  status: StatusPeta;
  rlId: number | null;
  pisahDpjp: boolean;
  /** Saran jenis pelayanan dari nama ruangan (null = tak ada saran). */
  saran: number | null;
  diubahOleh: string | null;
  diubahAt: string | null;
};

/** Satu SMF di layar pemetaan (dengan dokternya, agar mudah dikenali: "Saraf → DPJP 22"). */
export type SmfPemetaan = {
  id: number;
  nama: string;
  /** Jenis pelayanan untuk pasien ber-DPJP SMF ini di ruangan ber-pisah DPJP; null = ikut ruangan. */
  rlId: number | null;
  /** Saran dari `master.rl32_smf_revisi` SIMGOS (pemetaan SP versi SMF). */
  saran: number | null;
  dokter: { dpjp: number; nama: string }[];
  diubahOleh: string | null;
  diubahAt: string | null;
};

export type DaftarPemetaan = { ruangan: RuanganPemetaan[]; smf: SmfPemetaan[]; kategori: KategoriRl32[] };

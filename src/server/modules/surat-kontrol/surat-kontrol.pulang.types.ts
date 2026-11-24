/**
 * Tipe Audit "Terbit saat pulang" — dipakai server & klien (hanya tipe).
 * Tanggal `YYYY-MM-DD`, jam `HH:mm` (jam dinding WITA).
 */
import type { LayananPulang, StatusPulang } from "./surat-kontrol.pulang.constants";
import type { KodeNama } from "./surat-kontrol.types";

/** Asal tanggal terbit: webservice BPJS (live) atau cache SIMGOS `bpjs.monitoring_rencana_kontrol`. */
export type AsalTerbit = "LIVE" | "CACHE";

/** Satu Surat Kontrol BPJS yang tertaut ke episode (lewat SEP asal / jadwal SIMRS / catatan lokal). */
export type SuratPulang = {
  noSurat: string;
  /** Tanggal terbit di BPJS; null = belum terbaca. */
  tglTerbit: string | null;
  tglRencana: string | null;
  asalTerbit: AsalTerbit | null;
  poliTujuan: KodeNama | null;
  dokter: KodeNama | null;
  /** SEP kontrol sudah terbit (surat dipakai). null = tak diketahui. */
  sepTerbit: boolean | null;
  /** false = dihapus (catatan lokal berstatus hapus, atau tak ada lagi di respons BPJS live). */
  aktif: boolean;
  /** Jadwal SIMRS (`jadwal_kontrol`) yang merujuk surat ini. */
  jadwal: { tanggal: string; jam: string | null; aktif: boolean } | null;
};

export type EpisodePulang = {
  /** `RI-<kunjungan>` / `RJ-<kunjungan>`. */
  key: string;
  layanan: LayananPulang;
  nopen: string;
  kunjungan: string;
  norm: string | null;
  pasien: string | null;
  sep: string | null;
  tglPulang: string;
  jamPulang: string | null;
  ruangan: { id: string; nama: string } | null;
  dokter: string | null;
  /** Cara keluar (RI). RJ = null. */
  cara: number | null;
  caraLabel: string | null;
  wajib: boolean;
  /** Mengapa tidak wajib (cara pulang / dirujuk / lanjut rawat inap). */
  alasanTidakWajib: string | null;
  /** Semua surat tertaut, urut tanggal terbit. */
  surat: SuratPulang[];
  /** Surat acuan penilaian = surat aktif dengan tanggal terbit paling awal. */
  noSuratAcuan: string | null;
  /** Tanggal terbit acuan − tanggal pulang (hari); null bila tak ada. */
  selisihHari: number | null;
  /** Hari ini − tanggal pulang (hari) — umur "belum terbit". */
  hariSejakPulang: number;
  /** Ada jadwal kontrol SIMRS aktif yang belum punya nomor surat BPJS (belum di-bridging). */
  jadwalTanpaSurat: { tanggal: string; jam: string | null } | null;
  status: StatusPulang;
};

export type AuditTerbitPulang = {
  rentang: { from: string; to: string };
  hariIni: string;
  /** Waktu data disusun (jam dinding WITA `YYYY-MM-DDTHH:mm:ss`). */
  disusun: string;
  /** Jumlah surat menurut asal tanggal terbit. */
  asal: { live: number; cache: number; belum: number };
  /** Webservice BPJS dipanggil (melengkapi / segarkan) pada permintaan ini. */
  bpjsDipanggil: boolean;
  /** Pesan bila webservice gagal (data tetap dari cache SIMGOS). */
  galatBpjs: string | null;
  episode: EpisodePulang[];
};

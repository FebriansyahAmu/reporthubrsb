/**
 * Tipe Audit "Kontrol = SEP" — dipakai server & klien (hanya tipe).
 * Tanggal `YYYY-MM-DD`, jam `HH:mm` (jam dinding WITA).
 */
import type { JenisKontrol } from "./surat-kontrol.constants";
import type { AsalTerbit } from "./surat-kontrol.pulang.types";
import type { LayananSep, StatusSep } from "./surat-kontrol.sep.constants";
import type { KodeNama } from "./surat-kontrol.types";

/** Surat BPJS (Surat Kontrol / SPRI) dari daftar rencana kontrol VClaim. */
export type SuratSep = {
  noSurat: string;
  /** 2 = Surat Kontrol, 1 = SPRI. */
  jenis: JenisKontrol;
  /** Tanggal entri di BPJS (`tglTerbitKontrol`); null = belum terbaca. */
  tglTerbit: string | null;
  asalTerbit: AsalTerbit | null;
  tglRencana: string;
  poliTujuan: KodeNama | null;
  dokter: KodeNama | null;
  /** Penanda BPJS `terbitSEP` (Sudah/Belum); null = tak diketahui (data dari cache SIMGOS). */
  sepTerbitBpjs: boolean | null;
  /** Pengguna SIMGOS yang menerbitkan surat (`bpjs.rencana_kontrol.user`); null = di luar SIMGOS / tak tercatat. */
  pembuat: string | null;
  /** false = catatan lokal berstatus hapus. */
  aktif: boolean;
};

/** SEP yang memakai surat (`bpjs.kunjungan.noSuratSKDP`, tidak batal). */
export type SepPemakai = {
  sep: string;
  tglSep: string;
  jamSep: string | null;
  layanan: LayananSep;
  /** Ruangan SIMRS episode SEP (leg rawat inap / tujuan pendaftaran). */
  ruangan: { id: string; nama: string } | null;
  /** Poli tujuan di SEP (BPJS; kosong untuk rawat inap). */
  poliSep: KodeNama | null;
  /** Pengguna yang membuat SEP (`bpjs.kunjungan.user`). */
  pembuatSep: string | null;
  /** > 1 = surat dipakai lebih dari satu SEP (yang ditampilkan = SEP pertama). */
  jumlahSep: number;
};

/** SEP asal Surat Kontrol (kunjungan sebelumnya). */
export type AsalSurat = {
  sep: string;
  layanan: LayananSep | null;
  tglSep: string | null;
  /** Tanggal pulang SEP rawat inap asal (`bpjs.kunjungan.tglPlg`). */
  tglPulang: string | null;
};

/** Satu baris = satu surat BPJS. */
export type SepKontrol = {
  /** = nomor surat. */
  key: string;
  surat: SuratSep;
  /** Layanan SEP (bila dipakai) atau yang diharapkan (SPRI → RI, Surat Kontrol → RJ). */
  layanan: LayananSep;
  noKartu: string | null;
  nopen: string | null;
  norm: string | null;
  pasien: string | null;
  sep: SepPemakai | null;
  asal: AsalSurat | null;
  /** Tanggal entri surat − tanggal SEP (hari); null = belum dipakai / tanggal entri belum terbaca. */
  selisihHari: number | null;
  /** Surat Kontrol dari rawat inap yang sudah dipakai: hari dari pulang RI sampai SEP kontrol. */
  hariSejakPulangAsal: number | null;
  status: StatusSep;
};

/**
 * Rekap format audit BPJS: satu baris = satu SEP (tidak batal) bersurat dengan
 * TANGGAL SEP di rentang — basis yang sama dengan tarikan audit BPJS "Surkon < / = / > SEP".
 * Tanpa data pasien (hanya untuk hitungan).
 */
export type RekapSep = {
  tglSep: string;
  jenis: JenisKontrol;
  /** SEBELUM_SEP (Surkon < SEP), SAMA_HARI (=), SETELAH_SEP (>), TAK_TERBACA. */
  status: StatusSep;
  layanan: LayananSep;
  ruangan: string;
};

export type AuditKontrolSep = {
  rentang: { from: string; to: string };
  hariIni: string;
  /** Waktu data disusun (`YYYY-MM-DDTHH:mm:ss` WITA). */
  disusun: string;
  /** Daftar surat dari webservice BPJS (live); false = webservice gagal → cache SIMGOS. */
  dariBpjs: boolean;
  /** Asal tanggal entri surat. */
  asal: { live: number; cache: number; belum: number };
  galatBpjs: string | null;
  baris: SepKontrol[];
  /** Rekap format audit BPJS (basis tanggal SEP). */
  rekap: RekapSep[];
};

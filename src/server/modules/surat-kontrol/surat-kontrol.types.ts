/**
 * Tipe data Audit Surat Kontrol — dipakai server & klien (hanya tipe, bebas
 * server-only). Semua tanggal `YYYY-MM-DD`, jam `HH:mm` (jam dinding WITA).
 */
import type { JenisKontrol, StatusAudit, SumberBpjs, TemuanKey } from "./surat-kontrol.constants";

export type KodeNama = { kode: string; nama: string | null };

/** Satu surat (Surat Kontrol / SPRI) sebagaimana tercatat di BPJS. */
export type BpjsSurat = {
  noSurat: string;
  jenis: JenisKontrol;
  /** "Rawat Jalan" / "Rawat Inap" (pelayanan SEP asal). */
  jnsPelayanan: string | null;
  tglRencana: string;
  tglTerbit: string | null;
  sepAsal: string | null;
  tglSep: string | null;
  poliAsal: KodeNama | null;
  poliTujuan: KodeNama | null;
  dokter: KodeNama | null;
  noKartu: string | null;
  nama: string | null;
  /** SEP kontrol sudah terbit (surat sudah dipakai). null = tak diketahui (data lokal). */
  sepTerbit: boolean | null;
};

/** Jadwal di SIMRS yang merujuk surat: jadwal_kontrol (Surat Kontrol) / perencanaan_rawat_inap (SPRI). */
export type SimrsJadwal = {
  sumber: "JADWAL_KONTROL" | "SPRI";
  id: number;
  /** Nomor surat lokal SIMRS (6 digit). */
  nomor: string | null;
  referensi: string | null;
  tanggal: string;
  jam: string | null;
  aktif: boolean;
  sudahDigunakan: boolean;
  ruangan: { id: string; nama: string } | null;
  /** Kode poli BPJS hasil pemetaan ruangan tujuan (master.penjamin_ruangan). */
  poliBpjs: string | null;
  dokterId: number | null;
  dokter: string | null;
  dibuat: string | null;
  oleh: string | null;
  kunjungan: {
    nomor: string;
    nopen: string | null;
    norm: string | null;
    ruangan: string | null;
    jenis: string | null;
    /** Penjamin episode BPJS? null = tak diketahui. */
    bpjs: boolean | null;
  } | null;
  pasien: string | null;
};

/** Catatan penerbitan lokal SIMGOS (`bpjs.rencana_kontrol`). */
export type LokalSurat = {
  tglRencana: string;
  aktif: boolean;
  kodeDokter: string | null;
  poli: string | null;
  petugas: string | null;
};

export type SuratKontrolBaris = {
  /** Kunci stabil: nomor surat BPJS, atau `SIMRS-<id>` untuk jadwal tanpa surat. */
  key: string;
  noSurat: string | null;
  jenis: JenisKontrol;
  bpjs: BpjsSurat | null;
  /** True bila `bpjs` diambil dari catatan lokal (bukan respons webservice). */
  bpjsDariLokal: boolean;
  simrs: SimrsJadwal | null;
  lokal: LokalSurat | null;
  /** Tanggal jadwal SIMRS − tanggal rencana BPJS (hari); null bila tak terbandingkan. */
  selisihHari: number | null;
  /** Jumlah jadwal LAIN pada dokter + tanggal + jam yang sama. */
  bentrok: number;
  temuan: TemuanKey[];
  status: StatusAudit;
  /** Nama tampilan (BPJS, atau SIMRS bila tak ada). */
  pasien: string | null;
  /** Tanggal acuan urut & grafik: rencana BPJS, atau jadwal SIMRS. */
  tglAcuan: string;
  poli: string | null;
  dokter: string | null;
};

/** Slot jadwal SIMRS (dokter + tanggal + jam) yang diisi > 1 pasien. */
export type SlotBentrok = {
  tanggal: string;
  jam: string;
  dokter: string | null;
  ruangan: string | null;
  jumlah: number;
  /** Kunci baris audit yang ada di slot ini. */
  keys: string[];
};

export type AuditSuratKontrol = {
  rentang: { from: string; to: string };
  hariIni: string;
  sumber: SumberBpjs;
  /** Waktu data BPJS diambil (jam dinding WITA `YYYY-MM-DDTHH:mm:ss`). */
  diambil: string;
  dariCache: boolean;
  /** Pesan bila webservice gagal & dipakai cadangan lokal. */
  galatBpjs: string | null;
  baris: SuratKontrolBaris[];
  slot: SlotBentrok[];
  /** Jadwal SIMRS pasien non-BPJS (tanpa surat) yang tidak diaudit. */
  nonBpjsDilewati: number;
};

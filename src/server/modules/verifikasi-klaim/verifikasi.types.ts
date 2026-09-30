/**
 * Tipe modul Verifikasi Klaim BPJS — AMAN untuk client (hanya tipe).
 *
 * Alur data: EpisodeKlaim (SIMGOS) + FaktaKlaim (SIMGOS batch + reporthub) →
 * SnapshotKlaim → evaluasi aturan MURNI (verifikasi.rules.ts) → HasilCek.
 */
import type {
  JenisIcd,
  Kategori,
  LingkupTindakLanjut,
  PenanggungJawab,
  SasaranTindakLanjut,
  StatusKoreksi,
  StatusTindakLanjut,
  StatusVerifikasi,
} from "./verifikasi.constants";

/** Header satu episode klaim (NOPEN) — agregat leg kunjungan, READ-ONLY SIMGOS. */
export type EpisodeKlaim = {
  nopen: string;
  norm: string;
  nama: string;
  kategori: Kategori;
  /** `pendaftaran.penjamin.JENIS` terakhir (2 = BPJS), null bila tak ada. */
  penjamin: number | null;
  /** Jam dinding SIMGOS "YYYY-MM-DDTHH:mm:ss" (leg klinis). `pulang` null = belum final. */
  masuk: string | null;
  pulang: string | null;
  /** Leg klinis terakhir (untuk tampilan & sasaran unit). */
  ruanganId: string | null;
  ruang: string | null;
  /** `kunjungan.DPJP` (= master.dokter.ID) leg klinis terakhir. */
  dpjpId: number | null;
};

/* ------------------------------------------------------------------ koding */

/** Info satu kode ICD edisi INA-CBG (`master.mrconso` SAB `*_2010_IM`). */
export type IcdInfo = {
  kode: string;
  nama: string;
  /** `VALIDCODE = 1` — boleh dipakai untuk klaim (bukan kode kategori/header). */
  valid: boolean;
  /** `ACCPDX = Y` — boleh menjadi diagnosa utama (ICD-10). */
  accpdx: boolean;
  /** Kode asterisk (*) — manifestasi (ICD-10). */
  asterisk: boolean;
};

/** Info ICD per jenis, kunci = kode. Kode yang tak ada di master tidak tercantum. */
export type PetaIcd = Record<JenisIcd, Record<string, IcdInfo>>;

/** Baris diagnosa SIMRS aktif (`medicalrecord.diagnosa` STATUS 1). */
export type DxBaris = {
  id: number;
  /** Kosong ("") bila baris tanpa kode. */
  kode: string;
  utama: boolean;
  /** Kolom `INACBG` = 1: ikut klaim INA-CBG. */
  inacbg: boolean;
  /** Kolom `INA_GROUPER` (SIMGOS mencatat diagnosa kembar 0/1 — tampil sebagai info). */
  grouper: boolean;
  /** Teks diagnosa yang ditulis di SIMRS. */
  teks: string | null;
};

/** Baris prosedur SIMRS aktif (`medicalrecord.prosedur` STATUS 1). */
export type PxBaris = { id: number; kode: string; inacbg: boolean; teks: string | null };

export type FaktaKoding = {
  diagnosa: DxBaris[];
  prosedur: PxBaris[];
  /** Tindakan medis berjenis Prosedur Bedah (`master.tindakan.JENIS` 2) pada episode. */
  bedah: number;
};

/** Satu kode diagnosa klaim (baris ber-`INACBG` 1 digabung per kode). */
export type DxKlaim = { kode: string; primer: boolean; sekunder: boolean };

/** Koding klaim — dari SIMRS (`setKlaim`) atau dari usulan coder. */
export type SetKoding = {
  diagnosa: DxKlaim[];
  /** Kode prosedur bertanda INA-CBG. */
  prosedur: string[];
  /** Kode prosedur yang tercatat di SIMRS tanpa tanda INA-CBG (info). */
  prosedurLain: string[];
  /** Baris diagnosa ber-tanda INA-CBG tanpa kode. */
  tanpaKode: number;
};

export type UsulanDx = { kode: string; utama: boolean };
export type UsulanKoding = { diagnosa: UsulanDx[]; prosedur: { kode: string }[] };

export type AksiPerubahan =
  | "tambah-utama"
  | "tambah-sekunder"
  | "jadikan-utama"
  | "jadikan-sekunder"
  | "hapus"
  | "rapikan-kosong"
  | "tambah-px"
  | "hapus-px";

/** Satu langkah yang harus diterapkan di SIMRS agar koding = usulan. */
export type PerubahanKoding = {
  jenis: "dx" | "px";
  aksi: AksiPerubahan;
  kode: string | null;
  /** Kalimat perintah untuk DPJP / unit, mis. "Jadikan K35.8 diagnosa utama". */
  teks: string;
  nama?: string | null;
};

/** Jejak perubahan di SIMGOS setelah usulan dibuat (log update + baris baru). */
export type JejakBukti = {
  aksi: "tambah" | "ubah";
  tabel: "diagnosa" | "prosedur";
  kode: string | null;
  /** Kolom yang berubah (nama saja, tanpa isi). */
  kolom: string[];
  oleh: string | null;
  /** Jam dinding SIMGOS "YYYY-MM-DDTHH:mm:ss". */
  pada: string;
};

export type BuktiKoding = { oleh: string | null; pada: string | null; jejak: JejakBukti[] };

export type KoreksiItem = {
  id: string;
  status: StatusKoreksi;
  usulan: UsulanKoding;
  /** Langkah terhadap koding SIMRS saat usulan dibuat. */
  perubahan: PerubahanKoding[];
  catatan: string | null;
  dibuatOlehNama: string | null;
  createdAt: string;
  updatedAt: string;
  sesuaiAt: string | null;
  bukti: BuktiKoding | null;
};

/** Fakta kelengkapan satu episode — hasil query batch. */
export type FaktaKlaim = {
  /** SEP terpilih (jenis pelayanan cocok kategori, tglSEP terdekat). */
  sep: { nomor: string; tanggal: string } | null;
  /** SEP terdekat berjenis pelayanan LAIN (dasar aturan `sep-jenis`) — null bila tak ada. */
  sepLain: { nomor: string; tanggal: string; jenisPelayanan: number } | null;
  diagnosa: {
    /** Baris diagnosa aktif. */
    total: number;
    /** Kode BERBEDA bertanda primer (UTAMA=1) — baris duplikat umum di SIMGOS. */
    primer: number;
    /** Baris tanpa kode ICD. */
    tanpaKode: number;
  };
  resume: number;
  cppt: {
    total: number;
    /** Baris verifikasi DPJP (`verifikasi_cppt`). */
    verifikasi: number;
    /** CPPT yang ditulis SETELAH batas verifikasi terakhir leg-nya. */
    belumVerif: number;
  };
  /** Triase episode ini (STATUS 1 belum final / 2 final). */
  triase: number;
  /** SPRI yang menunjuk NOPEN ini sebagai pendaftaran RI. */
  spri: number;
  /** Episode asal (IGD) yang digabung ke RI ini + triasenya. */
  asal: { nopen: string; triase: number } | null;
  pulang: { cara: number | null; keadaan: number | null } | null;
  penunjang: { lab: number; labBelum: number; rad: number; radBelum: number };
  tagihan: boolean;
  /** Bukti Pelayanan sudah diisi di aplikasi (reporthub). */
  bukti: boolean;
  /** Diagnosa & prosedur SIMRS (Tahap 2 — koding). */
  koding: FaktaKoding;
};

export type SnapshotKlaim = EpisodeKlaim & { fakta: FaktaKlaim };

/* --------------------------------------------------------------- evaluasi */

/** W = wajib (gagal memblokir), O = opsional (gagal → peringatan). */
export type Keharusan = "W" | "O";

export type StatusHasil = "lolos" | "gagal" | "peringatan";

export type HasilAturan = {
  key: string;
  label: string;
  status: StatusHasil;
  keharusan: Keharusan;
  pesan: string;
  pj: PenanggungJawab;
};

export type HasilCek = {
  tahap: 1 | 2;
  hasil: HasilAturan[];
  lolos: number;
  gagal: number;
  peringatan: number;
  /** Jumlah aturan yang berlaku untuk episode ini. */
  total: number;
  /** Tidak ada aturan WAJIB yang gagal. */
  lengkap: boolean;
};

/* ----------------------------------------------------------------- antrean */

export type MasalahRingkas = Pick<HasilAturan, "key" | "label" | "status" | "pesan" | "pj">;

export type AntreanItem = {
  nopen: string;
  norm: string;
  nama: string;
  kategori: Kategori;
  penjamin: number | null;
  ruang: string | null;
  ruanganId: string | null;
  masuk: string | null;
  pulang: string | null;
  /** Lama rawat (hari kalender, min 1 untuk RI; 0 untuk IGD/RJ). */
  lamaRawat: number;
  sep: string | null;
  /** NOPEN IGD asal yang digabung ke episode RI ini. */
  asalNopen: string | null;
  status: StatusVerifikasi;
  /** Versi baris verifikasi (null = belum pernah diputuskan). */
  versi: number | null;
  cek: Omit<HasilCek, "hasil" | "tahap"> & { masalah: MasalahRingkas[] };
  /** Item tindak lanjut berkas ini: masih terbuka & seluruhnya. */
  tl: { open: number; total: number };
  /** Hasil aturan Tahap 2 (koding) terhadap koding SIMRS sekarang. */
  koding: Pick<HasilCek, "gagal" | "peringatan"> & { masalah: MasalahRingkas[] };
  /** Usulan koreksi yang menunggu SIMRS: jumlah langkah & yang belum diterapkan. */
  koreksi: { perubahan: number; sisa: number; sejak: string } | null;
};

export type AntreanRingkasan = {
  total: number;
  perStatus: Record<StatusVerifikasi, number>;
  perKategori: Record<Kategori, number>;
  /** Jumlah episode yang GAGAL per aturan (untuk chip masalah teratas). */
  perAturan: Record<string, number>;
  /** Berkas BELUM_DIPERIKSA yang lengkap otomatis (kandidat setujui massal). */
  lengkapOtomatis: number;
  /** TIDAK_LENGKAP yang seluruh tindak lanjutnya sudah selesai → siap diperiksa ulang. */
  siapPeriksaUlang: number;
  /** Berkas pekerjaan coder (Lolos RM / Koreksi Koding) yang GAGAL per aturan Tahap 2. */
  perAturanKoding: Record<string, number>;
  /** Berkas Lolos RM tanpa aturan koding yang gagal. */
  kodingBersih: number;
};

export type AntreanResult = {
  items: AntreanItem[];
  page: number;
  pageSize: number;
  /** Jumlah item setelah filter (sebelum paginasi). */
  filtered: number;
  ringkasan: AntreanRingkasan;
  meta: {
    from: string;
    to: string;
    cakupan: "bpjs" | "semua";
    /** Episode non-RI yang digabung ke episode RI (tidak tampil sendiri). */
    digabung: number;
    dihitungPada: string;
    durasiMs: number;
    dariCache: boolean;
  };
  /** Pilihan filter ruang (dari seluruh episode rentang). */
  opsi: { ruang: { id: string; nama: string; n: number }[] };
};

/* ------------------------------------------------ tindak lanjut & riwayat */

/** Item kekurangan yang dikirim ke penanggung jawab (dibentuk aturan murni). */
export type ItemTindakLanjut = { aturan: string; pesan: string; pj: PenanggungJawab };

export type TindakLanjutItem = {
  id: string;
  nopen: string;
  aturan: string;
  label: string;
  pesan: string;
  sasaranJenis: SasaranTindakLanjut;
  sasaranRef: string;
  sasaranNama: string | null;
  status: StatusTindakLanjut;
  catatan: string | null;
  dibuatOlehNama: string | null;
  createdAt: string;
  selesaiAt: string | null;
  /** OTOMATIS | MANUAL | BATAL */
  selesaiCara: string | null;
  selesaiOlehNama: string | null;
  /** Item cek manual (hanya bisa ditutup manual). */
  manual: boolean;
};

export type RiwayatItem = {
  id: string;
  aksi: string;
  label: string;
  dariStatus: StatusVerifikasi | null;
  keStatus: StatusVerifikasi | null;
  versi: number;
  catatan: string | null;
  data: Record<string, unknown> | null;
  olehNama: string | null;
  createdAt: string;
};

export type CekManualItem = { key: string; label: string; pj: PenanggungJawab };

export type DetailKlaim = {
  snapshot: SnapshotKlaim;
  cek: HasilCek;
  status: StatusVerifikasi;
  versi: number | null;
  /** Semua leg episode sudah KELUAR. */
  final: boolean;
  /** Bila episode ini (IGD) digabung ke episode RI: NOPEN RI tujuan. */
  digabungKe: string | null;
  cekManual: CekManualItem[];
  tindakLanjut: TindakLanjutItem[];
  riwayat: RiwayatItem[];
  /** Aturan Tahap 2 terhadap koding SIMRS sekarang. */
  cekKoding: HasilCek;
  /** Info ICD untuk kode SIMRS & usulan berkas ini. */
  icd: PetaIcd;
  /** Usulan koreksi koding (terbaru dulu). */
  koreksi: KoreksiItem[];
};

/** Aksi yang boleh dilakukan pengguna pada berkas ini sekarang. */
export type IzinKlaim = {
  loloskan: boolean;
  tandai: boolean;
  ajukanKoreksi: boolean;
  loloskanKlaim: boolean;
  kembalikan: boolean;
};

export type RuangKerjaKlaim = DetailKlaim & { izin: IzinKlaim };

export type HasilMassal = {
  disetujui: string[];
  dilewati: { nopen: string; alasan: string }[];
};

/* ------------------------------------------------ halaman Tindak Lanjut */

export type TindakLanjutBaris = TindakLanjutItem & {
  pasien: { nama: string | null; norm: string | null; kategori: string; ruang: string | null; tglPulang: string | null };
  statusKlaim: StatusVerifikasi;
  /** Penerima boleh menandai selesai (item cek manual yang ditujukan kepadanya / verifikator). */
  bolehSelesai: boolean;
  /** Item koreksi koding: langkah yang harus diterapkan di SIMRS (sesuai jenis item). */
  perubahan: PerubahanKoding[] | null;
};

export type TindakLanjutDaftar = {
  items: TindakLanjutBaris[];
  page: number;
  pageSize: number;
  total: number;
  ringkasan: { open: number; selesai: number };
  lingkup: LingkupTindakLanjut;
  /** Pengguna boleh melihat semua item (verifikator RM). */
  bolehSemua: boolean;
  /** Pengguna belum punya sasaran pribadi (NIP / akses ruangan) — hanya lewat peran. */
  tanpaSasaranPribadi: boolean;
  meta: { ditutupOtomatis: number; dihitungPada: string };
};

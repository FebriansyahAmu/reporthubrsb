/**
 * Tipe modul Verifikasi Klaim BPJS — AMAN untuk client (hanya tipe).
 *
 * Alur data: EpisodeKlaim (SIMGOS) + FaktaKlaim (SIMGOS batch + reporthub) →
 * SnapshotKlaim → evaluasi aturan MURNI (verifikasi.rules.ts) → HasilCek.
 */
import type {
  Kategori,
  PenanggungJawab,
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

/** Fakta kelengkapan satu episode — hasil query batch (tanpa kolom teks klinis). */
export type FaktaKlaim = {
  /** SEP terpilih (jenis pelayanan cocok kategori, tglSEP terdekat). */
  sep: { nomor: string; tanggal: string } | null;
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
};

export type AntreanRingkasan = {
  total: number;
  perStatus: Record<StatusVerifikasi, number>;
  perKategori: Record<Kategori, number>;
  /** Jumlah episode yang GAGAL per aturan (untuk chip masalah teratas). */
  perAturan: Record<string, number>;
  /** Berkas BELUM_DIPERIKSA yang lengkap otomatis (kandidat setujui massal). */
  lengkapOtomatis: number;
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
};

export type DetailKlaim = {
  snapshot: SnapshotKlaim;
  cek: HasilCek;
  status: StatusVerifikasi;
  versi: number | null;
  /** Semua leg episode sudah KELUAR. */
  final: boolean;
  /** Bila episode ini (IGD) digabung ke episode RI: NOPEN RI tujuan. */
  digabungKe: string | null;
};

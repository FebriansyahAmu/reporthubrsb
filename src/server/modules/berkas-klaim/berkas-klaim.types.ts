/**
 * Tipe bersama modul Berkas Klaim (server + client, type-only).
 * List memakai bentuk kunjungan + turunan yang sama dengan Monitoring Pelayanan.
 */
import type { PageMeta } from "@/lib/types";
import type {
  KategoriKunjungan,
  KunjunganPelayananItem,
  TurunanLayananItem,
} from "@/server/modules/pelayanan/pelayanan.types";

export type { KategoriKunjungan, TurunanLayananItem };

/** Satu pasien final untuk daftar "Berkas Klaim RM" (dengan turunan layanan). */
export type BerkasKlaimItem = KunjunganPelayananItem & {
  turunan: TurunanLayananItem[];
};

export type BerkasKlaimCounts = Record<"Semua" | KategoriKunjungan, number>;

export type BerkasKlaimResult = {
  data: BerkasKlaimItem[];
  meta: PageMeta;
  counts: BerkasKlaimCounts;
  updatedAt: string;
};

// ---------------------------------------------------------------------------
// Detail berkas — status tiap dokumen klaim untuk satu episode (NOPEN).
// ---------------------------------------------------------------------------

/**
 * Status dokumen:
 * - ADA     : data/dokumen tersedia (hijau) — siap/lengkap
 * - TIDAK   : diharapkan ada tapi belum tersedia (merah)
 * - NA      : tidak berlaku untuk episode ini (mis. SPRI pada non-RI) (netral)
 * - PENDING : belum terintegrasi di aplikasi ini (mis. SEP/BPJS) (kuning)
 */
export type DokumenStatus = "ADA" | "TIDAK" | "NA" | "PENDING";

export type DokumenBerkas = {
  key: string;
  label: string;
  /** Ikon lucide (nama) untuk kartu — dipetakan di view. */
  icon:
    | "rekam-medis"
    | "triase"
    | "sep"
    | "spri"
    | "bukti"
    | "cppt"
    | "resume";
  status: DokumenStatus;
  /** Keterangan singkat (mis. "5 catatan", "belum diinput"). */
  keterangan: string;
  /** Bila dapat dicetak: path halaman cetak. */
  printHref?: string;
};

// ---------------------------------------------------------------------------
// Bukti Pelayanan — dokumen yang DIISI SENDIRI (disimpan di DB reporthub).
// ---------------------------------------------------------------------------

/** Satu baris tindakan/pelayanan (bisa disunting petugas). */
export type BuktiTindakanRow = {
  /** "YYYY-MM-DD" atau ISO lokal; boleh kosong. */
  tanggal: string;
  nama: string;
  pelaksana: string;
  keterangan: string;
};

/** Isi form Bukti Pelayanan (disimpan sebagai JSON di reporthub). */
export type BuktiPelayananForm = {
  tanggalPelayanan: string;
  dpjp: string;
  penjamin: string;
  noSep: string;
  catatan: string;
  /** Nama peserta/keluarga penandatangan — kolom "TT & Nama Peserta/Keluarga". */
  pesertaNama: string;
  /** Tanda tangan peserta/keluarga (PNG data-URL) — tampil di tiap baris tindakan. */
  pesertaTtd: string;
  tindakan: BuktiTindakanRow[];
};

/** Rekaman tersimpan + metadata. */
export type BuktiPelayananSaved = {
  nopen: string;
  data: BuktiPelayananForm;
  updatedAt: string;
  updatedBy: string | null;
};

/** Respons GET untuk form: rekaman tersimpan (bila ada) + prefill dari SIMGOS. */
export type BuktiPelayananContext = {
  saved: BuktiPelayananSaved | null;
  /** Tindakan ditarik dari SIMGOS (prefill saat belum pernah disimpan). */
  tindakanSimgos: BuktiTindakanRow[];
  /** Nama DPJP dari SIMGOS (prefill field DPJP saat belum disimpan). */
  dpjpSimgos: string;
};

export type BerkasDetail = {
  nopen: string;
  norm: string;
  nama: string;
  jenisKelamin: string;
  umur: string | null;
  /** Kategori utama episode (RI > IGD > RJ). */
  kategori: KategoriKunjungan;
  ruangUtama: string;
  /** ISO lokal. */
  masuk: string;
  keluar: string | null;
  final: boolean;
  /** Semua leg layanan pada episode ini. */
  turunan: TurunanLayananItem[];
  dokumen: DokumenBerkas[];
};

// ---------------------------------------------------------------------------
// Tagihan — total & rincian biaya episode (READ-ONLY dari pembayaran.tagihan).
// ---------------------------------------------------------------------------

/** Satu komponen biaya (gaya INA-CBG) dari header tagihan. */
export type TagihanKategori = { key: string; label: string; nilai: number };

/** Satu baris rincian item tagihan. */
export type TagihanItem = {
  /** 1&3 tindakan, 2 konsultasi, 4 farmasi. */
  jenis: number;
  nama: string;
  qty: number;
  tarif: number;
  diskon: number;
  subtotal: number;
  /** Tanggal layanan "YYYY-MM-DD" atau "". */
  tanggal: string;
};

/** Ringkasan tagihan untuk header detail (tanpa item). */
export type TagihanRingkas = {
  /** false bila episode belum punya tagihan. */
  ada: boolean;
  total: number;
  /** Tanggal tagihan "YYYY-MM-DD" atau "". */
  tanggal: string;
  /** Komponen biaya bernilai > 0, terurut menurun. */
  kategori: TagihanKategori[];
};

/** Ringkasan + seluruh item (untuk modal rincian). */
export type TagihanLengkap = TagihanRingkas & { items: TagihanItem[] };

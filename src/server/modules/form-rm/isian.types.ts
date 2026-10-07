/**
 * Tipe DTO isian Form RM v2. Type-only → aman diimpor client & server.
 */
import type { KategoriForm, KodeForm } from "@/features/form-rm/registry";
import type { AksiIsian, StatusIsian } from "@/features/form-rm/isian.status";
import type { HakForm } from "@/features/form-rm/hak";

export type IsianForm = {
  id: string;
  kode: KodeForm;
  versi: number;
  judul: string;
  kategori: KategoriForm;
  nopen: string;
  urutan: number;
  norm: string;
  namaPasien: string;
  ruang: string | null;
  status: StatusIsian;
  /** Wajib dikirim balik saat menyimpan / transisi (konkurensi optimistis). */
  rev: number;
  /** Isi form; TTD berupa "" atau referensi "ttd:<id>". */
  data: unknown;
  /** Kolom yang terisi otomatis dari SIMRS saat isian dibuat. */
  asal: string[];
  dibuatOlehId: string | null;
  diubahOlehId: string | null;
  difinalkanOlehId: string | null;
  difinalkanAt: string | null;
  createdAt: string;
  updatedAt: string;
};

/** Ringkasan isian aktif satu form untuk daftar / profil pasien. */
export type RingkasIsian = { id: string; status: StatusIsian; rev: number; updatedAt: string };

export type RevisiIsian = {
  rev: number;
  aksi: AksiIsian;
  status: StatusIsian;
  alasan: string | null;
  olehNama: string | null;
  waktu: string;
};

export type RiwayatIsian = {
  revisi: RevisiIsian[];
  /** Hasil pemeriksaan segel HMAC berantai + kecocokan isian dengan revisi terakhir. */
  integritas: { utuh: boolean; masalah: string[] };
};

/** Izin pengguna atas halaman isian (dihitung server per kategori form, dipakai UI untuk tombol). */
export type IzinIsian = {
  /** Simpan draf, finalkan, batalkan draf (update pada kategori form). */
  ubah: boolean;
  /** Buka koreksi / batalkan isian FINAL (`form-rm.kelola` update). */
  kelola: boolean;
  /** Buat isian baru setelah dibatalkan (create pada kategori form). */
  buat: boolean;
  /** Cetak (print pada kategori form). */
  cetak: boolean;
};

/** Pelaku aksi (dari sesi) + IP untuk audit. */
export type Aktor = { id: string; nama: string; ip: string | null };

/** Pelaku + hak per kategori form — wajib untuk setiap baca/tulis isian berdasarkan ID. */
export type AktorForm = Aktor & { hak: HakForm };

/**
 * Tipe modul Master › Mapping Ruangan (pejabat per ruangan).
 * Ruangan dibaca dari SIMGOS (read-only); penetapan pejabat disimpan di reporthub.
 */
import type { KategoriKunjungan } from "@/server/modules/pelayanan/pelayanan.types";

export type { KategoriKunjungan };

/** Satu pejabat: nama + NIP (NIP opsional). */
export type Pejabat = { nama: string; nip: string };

/** Set jabatan yang bisa diisi (disimpan sebagai JSON `data`). */
export type PejabatData = {
  kepalaInstalasi?: Pejabat;
  kepalaRuangan?: Pejabat;
  ketuaTim?: Pejabat;
};

/** Satu ruangan + penetapan pejabat ruangannya (untuk UI). */
export type RuanganPejabatItem = {
  ruanganId: string;
  nama: string;
  kategori: KategoriKunjungan;
  kepalaRuangan: Pejabat | null;
  ketuaTim: Pejabat | null;
};

/** Satu instalasi (grup) dengan kepala instalasi + daftar ruangan. */
export type InstalasiGroup = {
  /** ID stabil grup (juga kunci simpan Kepala Instalasi), mis. "inst:igd". */
  instalasiId: string;
  kategori: KategoriKunjungan;
  label: string;
  kepalaInstalasi: Pejabat | null;
  ruangan: RuanganPejabatItem[];
};

export type RuanganMappingResult = { instalasi: InstalasiGroup[] };

/** Hasil pencarian pegawai SIMGOS (untuk combobox). */
export type PegawaiHit = { nip: string; nama: string };

/** Instalasi (urutan tampilan) — kategori → id & label. */
export const INSTALASI: { kategori: KategoriKunjungan; label: string; instalasiId: string }[] = [
  { kategori: "IGD", label: "IGD", instalasiId: "inst:igd" },
  { kategori: "Rawat Jalan Klinik", label: "Rawat Jalan", instalasiId: "inst:rj" },
  { kategori: "Rawat Inap", label: "Rawat Inap", instalasiId: "inst:ri" },
];

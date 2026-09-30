/** Tipe notifikasi dalam aplikasi — AMAN untuk client (hanya tipe). */
import type { SasaranNotifikasi } from "./notifikasi.constants";

export type NotifikasiItem = {
  id: string;
  jenis: string;
  judul: string;
  pesan: string | null;
  /** Tautan internal aplikasi (path relatif). */
  tautan: string | null;
  createdAt: string;
  dibaca: boolean;
};

export type NotifikasiDaftar = { items: NotifikasiItem[]; belumDibaca: number };

/** Satu notifikasi yang akan dikirim (dibuat oleh modul lain). */
export type NotifikasiBaru = {
  jenis: string;
  judul: string;
  pesan?: string | null;
  tautan?: string | null;
  sasaranJenis: SasaranNotifikasi;
  sasaranRef: string;
  refTipe?: string | null;
  refId?: string | null;
  dibuatOlehId?: string | null;
};

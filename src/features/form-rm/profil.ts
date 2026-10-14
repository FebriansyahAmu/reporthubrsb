import type { StatusFormPasien } from "@/server/modules/form-rm/form-rm.types";
import type { StatusIsian } from "./isian.status";

/**
 * Status tampilan profil pasien Form RM (`/form-rm/pasien/[nopen]`) — murni,
 * dipakai kartu form & pita kelengkapan. Kartu berwarna menurut status:
 * KOSONG = netral, DRAF = kuning (diisi, belum final), FINAL = hijau.
 */

/**
 * Status satu kartu form berulang dari seluruh isiannya: ada yang DRAF → DRAF
 * (masih ada yang harus difinalkan); ada isian dan semuanya FINAL → FINAL;
 * belum ada isian aktif → KOSONG. Isian BATAL diabaikan (server pun menyaringnya).
 */
export function statusBerulang(daftar: readonly { status: StatusIsian }[]): StatusFormPasien {
  const aktif = daftar.filter((x) => x.status !== "BATAL");
  if (aktif.some((x) => x.status === "DRAF")) return "DRAF";
  return aktif.length > 0 ? "FINAL" : "KOSONG";
}

/** Jumlah form per status (legenda pita kelengkapan). */
export function hitungPerStatus(formulir: readonly { status: StatusFormPasien }[]): Record<StatusFormPasien, number> {
  const n: Record<StatusFormPasien, number> = { KOSONG: 0, DRAF: 0, FINAL: 0 };
  for (const f of formulir) n[f.status] += 1;
  return n;
}

/** Id jangkar kartu form (`#form-RM.03`) — tujuan tautan segmen pita kelengkapan. */
export const jangkarForm = (kode: string): string => `form-${kode}`;

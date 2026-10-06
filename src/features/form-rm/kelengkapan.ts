import { DEFINISI_FORM, type KodeForm } from "./registry";
import type { FormRmKelengkapan, StatusFormPasien } from "@/server/modules/form-rm/form-rm.types";
import type { RingkasIsian } from "@/server/modules/form-rm/isian.types";

const statusPasien = (i: RingkasIsian | undefined): StatusFormPasien =>
  i?.status === "DRAF" || i?.status === "FINAL" ? i.status : "KOSONG";

/** Kelengkapan form RM satu pasien dari isian aktifnya; "lengkap" = semua form FINAL. */
export function kelengkapanDari(isian: Partial<Record<KodeForm, RingkasIsian>>): FormRmKelengkapan {
  const status = Object.fromEntries(
    DEFINISI_FORM.map((d) => [d.kode, statusPasien(isian[d.kode])]),
  ) as Record<KodeForm, StatusFormPasien>;
  const nilai = Object.values(status);
  const final = nilai.filter((v) => v === "FINAL").length;
  return {
    status,
    terisi: nilai.filter((v) => v !== "KOSONG").length,
    final,
    total: nilai.length,
    lengkap: final === nilai.length,
  };
}

import type { DefinisiForm, JenisKunjungan, KodeForm } from "./registry";
import type { FormRmKelengkapan, StatusFormPasien } from "@/server/modules/form-rm/form-rm.types";
import type { RingkasIsian } from "@/server/modules/form-rm/isian.types";

/** Isian aktif → status form pasien (BATAL tak pernah aktif, diperlakukan belum ada). */
export const statusPasien = (i: RingkasIsian | null | undefined): StatusFormPasien =>
  i?.status === "DRAF" || i?.status === "FINAL" ? i.status : "KOSONG";

/** Form wajib bagi episode yang punya leg berjenis `jenisEpisode` (PRD §7, `wajibUntuk`). */
export const wajibBagi = (def: Pick<DefinisiForm, "wajibUntuk">, jenisEpisode: ReadonlySet<JenisKunjungan>): boolean =>
  def.wajibUntuk.some((j) => jenisEpisode.has(j));

/**
 * Kelengkapan form RM satu episode atas form yang boleh dilihat pengguna. Hanya
 * form WAJIB yang dihitung; "lengkap" = ada form wajib dan semuanya FINAL.
 */
export function kelengkapanDari(
  isian: Partial<Record<KodeForm, RingkasIsian>>,
  forms: readonly Pick<DefinisiForm, "kode" | "wajibUntuk">[],
  jenisEpisode: ReadonlySet<JenisKunjungan>,
): FormRmKelengkapan {
  const formulir = forms.map((d) => ({ kode: d.kode, status: statusPasien(isian[d.kode]), wajib: wajibBagi(d, jenisEpisode) }));
  const wajib = formulir.filter((f) => f.wajib);
  const final = wajib.filter((f) => f.status === "FINAL").length;
  return {
    formulir,
    terisi: wajib.filter((f) => f.status !== "KOSONG").length,
    final,
    total: wajib.length,
    lengkap: wajib.length > 0 && final === wajib.length,
  };
}

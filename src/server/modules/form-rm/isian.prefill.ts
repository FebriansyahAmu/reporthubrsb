import "server-only";
import { tanggalHariIniWita } from "@/lib/format";
import { ambilPath, pasangPath, type AsalIsian, type SumberId } from "@/features/form-rm/asal";
import type { DefinisiForm } from "@/features/form-rm/registry";
import { pangkasTeksPanjang } from "@/features/form-rm/skema";
import type { FormRmHeader } from "./form-rm.types";
import { PETA_FORM, type PetaForm } from "./isian.petakan";
import { ambilSumber, type IgdAsal, type StatusSumber } from "./isian.sumber";

/**
 * ISI OTOMATIS (PRD §6.4): sumber SIMRS form diambil (read-only), dipetakan ke
 * kolom isian, lalu dicatat asalnya per kolom (sumber + nilai SIMRS + episode
 * IGD asal bila dari sana). Dipakai sekali saat isian dibuat, dan ulang saat
 * petugas memilih "Muat ulang dari SIMRS" — perubahan SIMRS sesudahnya tidak
 * pernah mengubah isian diam-diam.
 */

export type HasilIsiOtomatis = {
  /** Isian kosong + nilai SIMRS + nilai bawaan, sudah lolos skema. */
  data: object;
  /** Hanya kolom yang benar-benar terisi dari SIMRS. */
  asal: AsalIsian;
  status: Partial<Record<SumberId, StatusSumber>>;
  igdAsal: IgdAsal | null;
};

/** Form tanpa pemetaan SIMRS: isian kosong saja. */
const TANPA_PETA = { sumber: [], petakan: () => ({}) } as const satisfies PetaForm;

export async function isiOtomatis(def: DefinisiForm, nopen: string, header: FormRmHeader): Promise<HasilIsiOtomatis> {
  const peta: PetaForm = PETA_FORM[def.kode] ?? TANPA_PETA;
  const sumber = await ambilSumber(peta.sumber, nopen, header);
  const nilai = peta.petakan(sumber.hasil);

  const susun = (pakaiSimrs: boolean) => {
    const data = def.kosong() as Record<string, unknown>;
    const terpasang = pakaiSimrs ? Object.keys(nilai).filter((p) => pasangPath(data, p, nilai[p].nilai)) : [];
    peta.bawaan?.(data, tanggalHariIniWita());
    // Teks SIMRS yang melebihi batas kolom dipangkas, bukan menggagalkan isian.
    return { sah: pangkasTeksPanjang(def.skema, data), terpasang };
  };

  let { sah, terpasang } = susun(true);
  if (!sah) {
    // Nilai SIMRS di luar skema (mis. referensi baru) tak boleh menghalangi isian dibuat.
    console.warn(`[form-rm] isi otomatis ${def.kode} di luar skema — isian dibuat tanpa data SIMRS`);
    ({ sah, terpasang } = susun(false));
  }
  if (!sah) throw new Error(`Isian kosong ${def.kode} tidak lolos skema`);

  const asal: AsalIsian = {};
  for (const path of terpasang) {
    const s = nilai[path].sumber;
    const nopenIgd = sumber.dariIgd[s];
    asal[path] = { sumber: s, nilai: ambilPath(sah, path), ...(nopenIgd ? { nopen: nopenIgd } : {}) };
  }
  return { data: sah, asal, status: sumber.status, igdAsal: sumber.igdAsal };
}

export type HasilTertaut = {
  /** path → nilai SIMRS terkini; SIMRS tanpa data → nilai isian kosong (bukan nilai lama). */
  nilai: Record<string, unknown>;
  /** Asal kolom yang berisi nilai SIMRS (kolom tanpa nilai tidak dicantumkan). */
  asal: AsalIsian;
};

/**
 * Nilai kolom TERTAUT (`def.tertaut`) terkini — hanya sumbernya yang dibaca.
 * null bila salah satu sumber gagal dibaca: pemanggil memakai nilai tersimpan,
 * tak pernah menebak.
 */
export async function isiTertaut(def: DefinisiForm, nopen: string, header: FormRmHeader): Promise<HasilTertaut | null> {
  const paths = def.tertaut ?? [];
  if (paths.length === 0) return { nilai: {}, asal: {} };
  const peta: PetaForm = PETA_FORM[def.kode] ?? TANPA_PETA;
  const kolom = def.simrs.flatMap((b) => b.kolom).filter((k) => paths.includes(k.path));
  const ids = [...new Set(kolom.map((k) => k.sumber))];
  const sumber = await ambilSumber(ids, nopen, header);
  if (ids.some((s) => sumber.status[s] === "gagal")) return null;

  const petaan = peta.petakan(sumber.hasil);
  const kosong = def.kosong();
  const out: HasilTertaut = { nilai: {}, asal: {} };
  for (const p of paths) {
    const n = Object.hasOwn(petaan, p) ? petaan[p] : undefined;
    out.nilai[p] = n ? n.nilai : ambilPath(kosong, p);
    if (n) {
      const nopenIgd = sumber.dariIgd[n.sumber];
      out.asal[p] = { sumber: n.sumber, nilai: n.nilai, ...(nopenIgd ? { nopen: nopenIgd } : {}) };
    }
  }
  return out;
}

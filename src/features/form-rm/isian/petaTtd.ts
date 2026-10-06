import type { DefinisiForm } from "@/features/form-rm/registry";
import { adalahDataUrlTtd, idDariRefTtd } from "@/features/form-rm/skema";

/**
 * Setelah simpan: TTD data-URL yang DIKIRIM → referensi `ttd:<id>` yang
 * DIKEMBALIKAN server, dicocokkan per slot. Hasilnya diterapkan ke state form
 * terbaru sehingga suntingan lain selama menyimpan tidak tertimpa. Murni.
 */
export function petaTtdBaru(def: DefinisiForm, kirim: object, balik: object): Map<string, string> {
  const dikirim = new Map<string, string>();
  def.petaTtd(kirim, (v, slot) => {
    if (adalahDataUrlTtd(v)) dikirim.set(slot, v);
    return v;
  });
  const peta = new Map<string, string>();
  if (dikirim.size === 0) return peta;
  def.petaTtd(balik, (v, slot) => {
    const dataUrl = dikirim.get(slot);
    if (dataUrl && idDariRefTtd(v)) peta.set(dataUrl, v);
    return v;
  });
  return peta;
}

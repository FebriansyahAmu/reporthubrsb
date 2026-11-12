import "server-only";
import { ValidationError } from "@/server/lib/errors";
import { legEpisode } from "./form-rm.pasien";
import { getFormRmHeader } from "./form-rm.service";
import type { UnitKonteks } from "./isian.log.inti";
import { lanjutanAktif } from "./rantai.service";

/**
 * KONTEKS PERUBAHAN ISIAN (PRD Berlanjut IGD → RI §3, §8.3): episode anggota
 * rantai tempat petugas membuka isian, plus unit & ruang yang DIBACA SERVER
 * (klien tak pernah menentukan unit/ruang). Dipakai label log & konflik.
 */

export type KonteksLog = { nopen: string; unit: UnitKonteks; ruang: string | null };

const UMUR_CACHE_MS = 5 * 60_000;
const MAKS_CACHE = 1000;
type InfoEpisode = { jenis: readonly number[]; ruang: string | null; sampai: number };
const g = globalThis as unknown as { formRmInfoEpisode?: Map<string, InfoEpisode> };

/** Jenis leg & ruang episode (SIMGOS, read-only) — di-cache 5 menit; gagal baca → cache lama / null. */
async function infoEpisode(nopen: string): Promise<InfoEpisode | null> {
  const cache = (g.formRmInfoEpisode ??= new Map());
  const ada = cache.get(nopen);
  if (ada && ada.sampai > Date.now()) return ada;
  try {
    const [legs, header] = await Promise.all([legEpisode(nopen), getFormRmHeader(nopen)]);
    const info: InfoEpisode = {
      jenis: [...new Set(legs.map((l) => l.jenis))],
      ruang: header?.ruang && header.ruang !== "—" ? header.ruang : null,
      sampai: Date.now() + UMUR_CACHE_MS,
    };
    cache.delete(nopen);
    if (cache.size >= MAKS_CACHE) cache.delete(cache.keys().next().value as string);
    cache.set(nopen, info);
    return info;
  } catch {
    return ada ?? null;
  }
}

const unitDariJenis = (jenis: readonly number[] | undefined): UnitKonteks =>
  !jenis ? "" : jenis.includes(2) ? "IGD" : jenis.includes(3) ? "RI" : jenis.includes(1) ? "RJ" : "";

/**
 * Konteks perubahan isian. `konteks` kosong = episode isian (akar). Bukan
 * anggota rantai → 422 tanpa membaca episode itu (keberadaannya tak bocor).
 * Akar rantai = IGD, lanjutan = RI (keduanya diverifikasi saat ditautkan);
 * isian tanpa rantai → unit dari jenis leg episode.
 */
export async function konteksLog(isian: { nopen: string }, konteks: string | undefined): Promise<KonteksLog> {
  const k = konteks ?? isian.nopen;
  const lanjutan = isian.nopen ? await lanjutanAktif(isian.nopen) : [];
  const peran = k === isian.nopen ? (lanjutan.length > 0 ? "akar" : "sendiri") : lanjutan.some((l) => l.nopen === k) ? "lanjutan" : null;
  if (!peran || !k) {
    throw new ValidationError({
      formErrors: [],
      fieldErrors: { konteks: ["Episode ini bukan bagian dari perawatan isian tersebut"] },
    });
  }
  const info = await infoEpisode(k);
  const unit: UnitKonteks = peran === "akar" ? "IGD" : peran === "lanjutan" ? "RI" : unitDariJenis(info?.jenis);
  return { nopen: k, unit, ruang: info?.ruang ?? null };
}

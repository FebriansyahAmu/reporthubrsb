import "server-only";
import { getAppDb } from "@/server/db/app.client";
import { getRuanganKunjunganList } from "@/server/modules/ruangan/ruangan.service";
import { queryPegawaiSearch } from "./ruangan-pejabat.dal";
import type { SaveRuanganPejabatInput } from "./ruangan-pejabat.schema";
import {
  INSTALASI,
  type Pejabat,
  type PejabatData,
  type PegawaiHit,
  type RuanganMappingResult,
} from "./ruangan-pejabat.types";

/** Normalisasi pejabat: null bila nama & NIP kosong. */
function pej(p: Pejabat | undefined): Pejabat | null {
  if (!p) return null;
  const nama = (p.nama ?? "").trim();
  const nip = (p.nip ?? "").trim();
  return nama || nip ? { nama, nip } : null;
}

/** Peta ruanganId → data pejabat tersimpan (reporthub). */
async function getSavedMap(): Promise<Map<string, PejabatData>> {
  const rows = await getAppDb().ruanganPejabat.findMany({
    select: { ruanganId: true, data: true },
  });
  return new Map(rows.map((r) => [r.ruanganId, (r.data as PejabatData) ?? {}]));
}

/**
 * Mapping ruangan lengkap: ruangan dari SIMGOS (READ-ONLY) digabung penetapan
 * pejabat tersimpan (reporthub), dikelompokkan per instalasi (IGD/RJ/RI).
 */
export async function getRuanganMapping(): Promise<RuanganMappingResult> {
  const [rooms, saved] = await Promise.all([getRuanganKunjunganList(), getSavedMap()]);

  const instalasi = INSTALASI.map((inst) => {
    const instData = saved.get(inst.instalasiId);
    const ruangan = rooms
      .filter((r) => r.kategori === inst.kategori)
      .map((r) => {
        const d = saved.get(r.id);
        return {
          ruanganId: r.id,
          nama: r.nama,
          kategori: r.kategori,
          kepalaRuangan: pej(d?.kepalaRuangan),
          ketuaTim: pej(d?.ketuaTim),
        };
      });
    return {
      instalasiId: inst.instalasiId,
      kategori: inst.kategori,
      label: inst.label,
      kepalaInstalasi: pej(instData?.kepalaInstalasi),
      ruangan,
    };
  });

  return { instalasi };
}

/** Simpan/replace penetapan pejabat satu entitas (ruangan `master.ruangan.ID` atau "inst:*"). */
export async function saveRuanganPejabat(
  ruanganId: string,
  input: SaveRuanganPejabatInput,
  userId: string | null,
): Promise<void> {
  await getAppDb().ruanganPejabat.upsert({
    where: { ruanganId },
    create: {
      ruanganId,
      nama: input.nama ?? null,
      kategori: input.kategori ?? null,
      data: input.data as object,
      updatedBy: userId,
    },
    update: {
      nama: input.nama ?? null,
      kategori: input.kategori ?? null,
      data: input.data as object,
      updatedBy: userId,
    },
  });
}

/** Cari pegawai SIMGOS (min 2 huruf) untuk combobox pejabat. */
export async function searchPegawai(q: string): Promise<PegawaiHit[]> {
  const term = (q ?? "").trim();
  if (term.length < 2) return [];
  const rows = await queryPegawaiSearch(term);
  return rows
    .map((r) => ({ nip: r.NIP?.trim() ?? "", nama: r.NAMA?.trim() ?? "" }))
    .filter((r) => r.nama);
}

/** Kepala Ruangan tersimpan untuk satu ruangan (untuk tanda tangan Bukti Pelayanan). */
export async function getKepalaRuangan(ruanganId: string): Promise<Pejabat | null> {
  if (!ruanganId) return null;
  const row = await getAppDb().ruanganPejabat.findUnique({
    where: { ruanganId },
    select: { data: true },
  });
  return pej((row?.data as PejabatData | undefined)?.kepalaRuangan);
}

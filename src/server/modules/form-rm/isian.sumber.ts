import "server-only";
import type { SumberId } from "@/features/form-rm/asal";
import { queryDiagnosaByNopen, queryTriaseSimgos } from "./form-rm.dal";
import type { FormRmHeader } from "./form-rm.types";
import type { HasilSumber, TipeSumber } from "./isian.petakan";
import {
  queryEdukasi,
  queryEpisode,
  queryIgdAsal,
  queryKeluarga,
  queryMorse,
  queryPulang,
  queryRujukan,
  querySosial,
} from "./isian.sumber.dal";

/**
 * PUSTAKA SUMBER ISI OTOMATIS (PRD §8.3). Setiap sumber unik diambil sekali,
 * paralel maks 4, lewat client SIMGOS singleton. Sumber yang gagal tidak
 * menggagalkan pengisian: statusnya "gagal" dan kolomnya dibiarkan kosong.
 * Sumber asesmen yang kosong pada episode rawat inap diambil dari episode IGD
 * asalnya (SIMGOS memberi NOPEN baru saat pasien IGD dirawat inap; PRD §6.4).
 */

export type StatusSumber = "ada" | "kosong" | "gagal";
export type IgdAsal = { nopen: string; cara: "spri" | "waktu" };

type Kunci = { nopen: string; header: FormRmHeader };
type DefSumber<S extends SumberId> = {
  /** Kosong di episode rawat inap → coba episode IGD asal. */
  readonly igdAsal: boolean;
  ambil(k: Kunci): Promise<TipeSumber[S] | null>;
};

const takKosong = <T>(rows: T[]): T[] | null => (rows.length > 0 ? rows : null);

const SUMBER: { readonly [S in SumberId]: DefSumber<S> } = {
  identitas: { igdAsal: false, ambil: async (k) => k.header },
  sosial: { igdAsal: false, ambil: (k) => querySosial(k.header.norm) },
  keluarga: { igdAsal: false, ambil: async (k) => takKosong(await queryKeluarga(k.header.norm)) },
  episode: { igdAsal: false, ambil: (k) => queryEpisode(k.nopen) },
  diagnosa: { igdAsal: false, ambil: async (k) => takKosong(await queryDiagnosaByNopen(k.nopen)) },
  pulang: { igdAsal: false, ambil: (k) => queryPulang(k.nopen) },
  triase: { igdAsal: true, ambil: (k) => queryTriaseSimgos(k.nopen) },
  edukasi: { igdAsal: true, ambil: (k) => queryEdukasi(k.nopen) },
  morse: { igdAsal: true, ambil: (k) => queryMorse(k.nopen) },
  // Rujukan milik episode tempat dibuat (episode RI membuat rujukannya sendiri).
  rujukan: { igdAsal: false, ambil: (k) => queryRujukan(k.nopen) },
};

/** Jalankan `fn` atas `items` dengan paling banyak `batas` sekaligus; urutan hasil = urutan masukan. */
async function petaTerbatas<T, R>(items: readonly T[], batas: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const hasil = new Array<R>(items.length);
  let berikut = 0;
  const pekerja = Array.from({ length: Math.min(batas, items.length) }, async () => {
    while (berikut < items.length) {
      const i = berikut++;
      hasil[i] = await fn(items[i]);
    }
  });
  await Promise.all(pekerja);
  return hasil;
}

export type HasilAmbil = {
  hasil: HasilSumber;
  status: Partial<Record<SumberId, StatusSumber>>;
  /** Sumber yang datanya diambil dari episode IGD asal → NOPEN episode itu. */
  dariIgd: Partial<Record<SumberId, string>>;
  igdAsal: IgdAsal | null;
};

/** Episode IGD asal episode rawat inap (SPRI lebih dulu, lalu pendaftaran IGD ≤ 24 jam sebelumnya). */
export async function cariIgdAsal(nopen: string): Promise<IgdAsal | null> {
  const r = await queryIgdAsal(nopen);
  if (r?.NOPEN_SPRI) return { nopen: String(r.NOPEN_SPRI).trim(), cara: "spri" };
  if (r?.NOPEN_WAKTU) return { nopen: String(r.NOPEN_WAKTU).trim(), cara: "waktu" };
  return null;
}

/**
 * Satu sumber per episode dengan cadangan episode IGD asal — untuk rujukan
 * baca-saja di halaman isian (triase SIMRS, kebutuhan edukasi).
 */
async function denganIgdAsal<T>(
  nopen: string,
  ambil: (nopen: string) => Promise<T | null>,
): Promise<{ nilai: T; nopenIgd: string | null } | null> {
  const sendiri = await ambil(nopen);
  if (sendiri != null) return { nilai: sendiri, nopenIgd: null };
  const asal = await cariIgdAsal(nopen);
  const igd = asal ? await ambil(asal.nopen) : null;
  return asal && igd != null ? { nilai: igd, nopenIgd: asal.nopen } : null;
}

export const bacaTriaseRujukan = (nopen: string) => denganIgdAsal(nopen, queryTriaseSimgos);
export const bacaEdukasiRujukan = (nopen: string) => denganIgdAsal(nopen, queryEdukasi);

export async function ambilSumber(ids: readonly SumberId[], nopen: string, header: FormRmHeader): Promise<HasilAmbil> {
  const unik = [...new Set(ids)];
  const out: HasilAmbil = { hasil: {}, status: {}, dariIgd: {}, igdAsal: null };

  const ambilSatu = async (s: SumberId, k: Kunci): Promise<StatusSumber> => {
    try {
      const nilai = await SUMBER[s].ambil(k);
      if (nilai == null) return "kosong";
      (out.hasil as Record<SumberId, unknown>)[s] = nilai;
      return "ada";
    } catch (e) {
      // Tanpa NOPEN / isi data di log (PRD §10.2): cukup sumber + kode galat.
      console.warn(`[form-rm] sumber isi otomatis "${s}" gagal (${(e as { code?: string })?.code ?? (e as Error)?.name ?? "galat"})`);
      return "gagal";
    }
  };

  const awal = await petaTerbatas(unik, 4, (s) => ambilSatu(s, { nopen, header }));
  unik.forEach((s, i) => (out.status[s] = awal[i]));

  const keIgd = unik.filter((s) => SUMBER[s].igdAsal && out.status[s] === "kosong");
  if (keIgd.length > 0) {
    out.igdAsal = await cariIgdAsal(nopen).catch(() => null);
    const asal = out.igdAsal;
    if (asal) {
      const st = await petaTerbatas(keIgd, 4, (s) => ambilSatu(s, { nopen: asal.nopen, header }));
      keIgd.forEach((s, i) => {
        out.status[s] = st[i];
        if (st[i] === "ada") out.dariIgd[s] = asal.nopen;
      });
    }
  }
  return out;
}

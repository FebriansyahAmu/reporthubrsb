import "server-only";
import { isSimgosConfigured } from "@/server/lib/env";
import { filterMockKunjungan } from "@/lib/mock/kunjungan";
import type { KategoriKunjungan, KunjunganResumeItem } from "./kunjungan.types";
import { queryKunjunganResume } from "./kunjungan.dal";
import { mapKunjungan } from "./kunjungan.mapper";

export type { KunjunganResumeItem, KategoriKunjungan };

export type KunjunganListParams = {
  from: string; // YYYY-MM-DD (inklusif)
  to: string; // YYYY-MM-DD (eksklusif)
  ruanganId?: string;
};

/**
 * Daftar kunjungan untuk katalog cetak Resume Medis, difilter rentang tanggal
 * (kolom MASUK) + ruangan opsional. Dipisah RI/RJ Klinik/IGD lewat master.ruangan;
 * status final dari kolom KELUAR.
 *
 * SIMGOS terkonfigurasi → query lintas-DB read-only; belum → data simulasi.
 */
export async function getKunjunganResumeList(
  params: KunjunganListParams,
): Promise<KunjunganResumeItem[]> {
  if (!isSimgosConfigured()) {
    return filterMockKunjungan(params);
  }
  const rows = await queryKunjunganResume({
    from: params.from,
    to: params.to,
    ruanganId: params.ruanganId,
  });
  return rows.map(mapKunjungan);
}

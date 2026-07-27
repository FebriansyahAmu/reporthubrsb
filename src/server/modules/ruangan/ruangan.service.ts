import "server-only";
import { isSimgosConfigured } from "@/server/lib/env";
import { MOCK_RUANGAN } from "@/lib/mock/kunjungan";
import type { RuanganOption } from "@/server/modules/kunjungan/kunjungan.types";
import { queryRuanganKunjungan } from "./ruangan.dal";

export type { RuanganOption };

/**
 * Daftar ruangan untuk dropdown filter. SIMGOS terkonfigurasi → dari
 * `master.ruangan` (9-digit); belum → data simulasi.
 */
export async function getRuanganKunjunganList(): Promise<RuanganOption[]> {
  if (!isSimgosConfigured()) return MOCK_RUANGAN;
  return queryRuanganKunjungan();
}

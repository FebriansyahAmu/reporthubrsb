import "server-only";
import { isSimgosConfigured } from "@/server/lib/env";
import { buildAntreanResult, type AntreanFilter, type AntreanResult } from "@/lib/antrean-core";
import { getMockAntreanResult } from "@/lib/mock/bpjs";
import { queryReservasiByTanggal, queryTaskActionsByTanggal } from "./antrean.dal";
import { buildAntreanList } from "./antrean.mapper";
import type { AntreanQuery } from "./antrean.schema";

export type { AntreanResult };

/**
 * Data monitoring Antrean BPJS untuk satu tanggal (ringkasan + pipeline dihitung
 * atas seluruh antrean tanggal itu; daftar disaring & dipaginasi sesuai filter).
 *
 * SIMGOS terkonfigurasi → tarik nyata dari `regonline` (reservasi + task_action_antrian,
 * read-only). Belum → data simulasi agar UI tetap jalan saat pengembangan.
 */
export async function getAntreanBpjsData(params: AntreanQuery): Promise<AntreanResult> {
  const filter: AntreanFilter = {
    tanggal: params.tanggal,
    search: params.search,
    poli: params.poli ?? "ALL",
    status: params.status ?? "ALL",
    tahap: params.tahap ?? "ALL",
    page: params.page,
    pageSize: params.pageSize,
  };

  if (!isSimgosConfigured()) {
    return getMockAntreanResult(filter);
  }

  const [reservasi, tasks] = await Promise.all([
    queryReservasiByTanggal(params.tanggal),
    queryTaskActionsByTanggal(params.tanggal),
  ]);
  const scoped = buildAntreanList(reservasi, tasks);
  return buildAntreanResult(scoped, filter);
}

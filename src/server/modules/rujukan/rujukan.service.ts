import "server-only";
import { countRujukanKeluar, queryRujukanKeluar } from "./rujukan.dal";
import { mapRujukan } from "./rujukan.mapper";
import type { RujukanKeluarFilter, RujukanKeluarResult } from "./rujukan.types";
import type { RujukanKeluarQuery } from "./rujukan.schema";

/**
 * Rujukan keluar terbaru (default 10 terakhir), dapat difilter tanggal/jenis/cari.
 * Read-only SIMGOS (bpjs.*). Paginasi + hitung per jenis untuk chip filter.
 */
export async function getRujukanKeluar(input: RujukanKeluarQuery): Promise<RujukanKeluarResult> {
  const { page, pageSize } = input;
  const filter: RujukanKeluarFilter = {
    from: input.from,
    to: input.to,
    jnsPelayanan: input.jnsPelayanan as RujukanKeluarFilter["jnsPelayanan"],
    search: input.search,
  };
  const offset = (page - 1) * pageSize;

  const [rows, counts] = await Promise.all([
    queryRujukanKeluar(filter, pageSize, offset),
    countRujukanKeluar(filter),
  ]);

  const total =
    filter.jnsPelayanan === 1
      ? counts.rawatInap
      : filter.jnsPelayanan === 2
        ? counts.rawatJalan
        : counts.semua;

  return {
    data: rows.map(mapRujukan),
    counts,
    meta: {
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    },
    updatedAt: new Date().toISOString(),
  };
}

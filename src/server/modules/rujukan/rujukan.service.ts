import "server-only";
import { countRujukanKeluar, queryRujukanKeluar, queryRujukanKeluarAll } from "./rujukan.dal";
import { mapRujukan, mapRujukanExport } from "./rujukan.mapper";
import type {
  RujukanKeluarExportItem,
  RujukanKeluarFilter,
  RujukanKeluarResult,
} from "./rujukan.types";
import type { RujukanKeluarQuery } from "./rujukan.schema";

/** Batas aman jumlah baris export (hindari file raksasa). */
export const RUJUKAN_EXPORT_CAP = 10_000;

function toFilter(input: RujukanKeluarQuery): RujukanKeluarFilter {
  return {
    from: input.from,
    to: input.to,
    jnsPelayanan: input.jnsPelayanan as RujukanKeluarFilter["jnsPelayanan"],
    search: input.search,
  };
}

/**
 * Rujukan keluar terbaru (default 10 terakhir), dapat difilter tanggal/jenis/cari.
 * Read-only SIMGOS (bpjs.*). Paginasi + hitung per jenis untuk chip filter.
 */
export async function getRujukanKeluar(input: RujukanKeluarQuery): Promise<RujukanKeluarResult> {
  const { page, pageSize } = input;
  const filter = toFilter(input);
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

/** Semua baris rujukan (berlabel lengkap) sesuai filter — untuk export Excel. */
export async function getRujukanKeluarExport(
  input: RujukanKeluarQuery,
): Promise<RujukanKeluarExportItem[]> {
  const rows = await queryRujukanKeluarAll(toFilter(input), RUJUKAN_EXPORT_CAP);
  return rows.map(mapRujukanExport);
}

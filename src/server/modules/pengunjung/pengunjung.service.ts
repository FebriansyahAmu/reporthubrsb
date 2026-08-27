import "server-only";
import { queryPengunjungRows, queryPengunjungSummary, queryRuanganOptions } from "./pengunjung.dal";
import { mapPengunjung, readSummary } from "./pengunjung.mapper";
import type { PengunjungQuery } from "./pengunjung.schema";
import type {
  CaraBayar,
  JenisLayanan,
  PengunjungFilter,
  PengunjungItem,
  PengunjungResult,
  PengunjungSummary,
  RuanganOption,
} from "./pengunjung.types";

/** Batas baris export (tanpa paginasi) agar aman. */
const EXPORT_CAP = 10000;

function toFilter(input: PengunjungQuery, page: number, pageSize: number): PengunjungFilter {
  return {
    from: input.from,
    to: input.to,
    jenis: input.jenis as JenisLayanan,
    ruangan: input.ruangan,
    caraBayar: input.caraBayar as CaraBayar,
    tindak: input.tindak,
    page,
    pageSize,
  };
}

/**
 * "Laporan Pengunjung Per Pasien" — daftar kunjungan berpaginasi + ringkasan.
 * Read-only SIMGOS (port dari SP `LaporanPengunjungPerpasien`).
 */
export async function getPengunjung(input: PengunjungQuery): Promise<PengunjungResult> {
  const filter = toFilter(input, input.page, input.pageSize);
  const [summaryRow, rows] = await Promise.all([
    queryPengunjungSummary(filter),
    queryPengunjungRows(filter, filter.pageSize, (filter.page - 1) * filter.pageSize),
  ]);
  const summary = readSummary(summaryRow, filter.jenis);
  const data = rows.map((r) => mapPengunjung(r, filter.jenis));
  const totalPages = Math.max(1, Math.ceil(summary.total / filter.pageSize));
  return {
    data,
    meta: { page: filter.page, pageSize: filter.pageSize, total: summary.total, totalPages },
    summary,
    jenis: filter.jenis,
    caraBayar: filter.caraBayar,
    tindak: filter.tindak,
    ruangan: filter.ruangan,
    periode: { from: filter.from, to: filter.to },
    updatedAt: new Date().toISOString(),
  };
}

export type PengunjungExport = {
  data: PengunjungItem[];
  summary: PengunjungSummary;
  filter: PengunjungFilter;
};

/** Seluruh baris cocok filter (cap {@link EXPORT_CAP}) + ringkasan, untuk export. */
export async function getPengunjungExport(input: PengunjungQuery): Promise<PengunjungExport> {
  const filter = toFilter(input, 1, EXPORT_CAP);
  const [summaryRow, rows] = await Promise.all([
    queryPengunjungSummary(filter),
    queryPengunjungRows(filter, EXPORT_CAP, 0),
  ]);
  return {
    data: rows.map((r) => mapPengunjung(r, filter.jenis)),
    summary: readSummary(summaryRow, filter.jenis),
    filter,
  };
}

export async function getRuanganOptions(): Promise<RuanganOption[]> {
  return queryRuanganOptions();
}

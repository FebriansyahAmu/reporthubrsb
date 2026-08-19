import "server-only";
import { queryKategoriOptions, queryObatGrandTotal, queryTopObat } from "./farmasi.dal";
import { mapObat, readGrandTotal } from "./farmasi.mapper";
import { parseKategoriCsv, type ObatTerbanyakQuery } from "./farmasi.schema";
import type {
  CaraBayar,
  KategoriOption,
  ObatFilter,
  ObatTerbanyakResult,
} from "./farmasi.types";

/** Jumlah obat teratas yang ditampilkan (sesuai nama laporan: 10 besar). */
export const TOP_OBAT_LIMIT = 10;

function toFilter(input: ObatTerbanyakQuery): ObatFilter {
  return {
    from: input.from,
    to: input.to,
    caraBayar: input.caraBayar as CaraBayar,
    kategori: parseKategoriCsv(input.kategori),
    metric: input.metric,
    limit: TOP_OBAT_LIMIT,
  };
}

/**
 * "10 Obat Terbanyak" pada periode + filter (kategori multi-pilih, cara bayar,
 * metrik kuantitas/nilai). Read-only SIMGOS — logika di-port dari SP
 * `LaporanFarmasiPerobat`. Peringkat + total keseluruhan diambil paralel.
 */
export async function getObatTerbanyak(input: ObatTerbanyakQuery): Promise<ObatTerbanyakResult> {
  const filter = toFilter(input);

  const [rows, grandRow] = await Promise.all([
    queryTopObat(filter),
    queryObatGrandTotal(filter),
  ]);

  const data = rows.map((r, i) => mapObat(r, i + 1));
  const grand = readGrandTotal(grandRow);

  const top10Qty = data.reduce((s, d) => s + d.qty, 0);
  const top10Nilai = data.reduce((s, d) => s + d.nilai, 0);

  return {
    data,
    summary: {
      jenisObat: grand.jenisObat,
      totalQty: grand.totalQty,
      totalNilai: grand.totalNilai,
      top10Qty,
      top10Nilai,
      qtyShare: grand.totalQty > 0 ? top10Qty / grand.totalQty : 0,
    },
    periode: { from: filter.from, to: filter.to },
    metric: filter.metric,
    caraBayar: filter.caraBayar,
    updatedAt: new Date().toISOString(),
  };
}

/** Opsi kategori (centang) untuk FE. */
export async function getKategoriOptions(): Promise<KategoriOption[]> {
  return queryKategoriOptions();
}

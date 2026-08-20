import "server-only";
import { queryPenyakitGrandTotal, queryTopPenyakit } from "./penyakit.dal";
import { mapPenyakit, readGrandTotal } from "./penyakit.mapper";
import type { PenyakitQuery } from "./penyakit.schema";
import type {
  CaraBayar,
  JenisLayanan,
  PenyakitFilter,
  PenyakitResult,
} from "./penyakit.types";

/** Jumlah penyakit teratas yang ditampilkan (sesuai nama laporan: 10 besar). */
export const TOP_PENYAKIT_LIMIT = 10;

function toFilter(input: PenyakitQuery): PenyakitFilter {
  return {
    from: input.from,
    to: input.to,
    jenis: input.jenis as JenisLayanan,
    caraBayar: input.caraBayar as CaraBayar,
    utama: input.utama,
    metric: input.metric,
    limit: TOP_PENYAKIT_LIMIT,
  };
}

/**
 * "10 Penyakit Terbanyak" pada periode + filter (jenis layanan, cara bayar,
 * diagnosa utama, metrik kasus/pasien). Read-only SIMGOS — logika di-port dari
 * SP `LaporanPasienPerICD10`. Peringkat + total keseluruhan diambil paralel.
 */
export async function getPenyakitTerbanyak(input: PenyakitQuery): Promise<PenyakitResult> {
  const filter = toFilter(input);

  const [rows, grandRow] = await Promise.all([
    queryTopPenyakit(filter),
    queryPenyakitGrandTotal(filter),
  ]);

  const data = rows.map((r, i) => mapPenyakit(r, i + 1));
  const grand = readGrandTotal(grandRow);

  const top10Kasus = data.reduce((s, d) => s + d.kasus, 0);
  const top10Pasien = data.reduce((s, d) => s + d.pasien, 0);

  return {
    data,
    summary: {
      jenisDiag: grand.jenisDiag,
      totalKasus: grand.totalKasus,
      totalPasien: grand.totalPasien,
      top10Kasus,
      top10Pasien,
      kasusShare: grand.totalKasus > 0 ? top10Kasus / grand.totalKasus : 0,
    },
    periode: { from: filter.from, to: filter.to },
    jenis: filter.jenis,
    metric: filter.metric,
    caraBayar: filter.caraBayar,
    utama: filter.utama,
    updatedAt: new Date().toISOString(),
  };
}

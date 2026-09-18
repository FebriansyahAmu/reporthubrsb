import "server-only";
import { isSimgosConfigured } from "@/server/lib/env";
import { queryRl51Instansi, queryRl51Matrix } from "./rl51.dal";
import { MONTHS_ID } from "@/server/modules/rl41/rl41.constants";
import type { Rl51Filter, Rl51Instansi, Rl51Result, Rl51Row } from "./rl51.types";
import type { Rl51Query } from "./rl51.schema";

const num = (x: unknown): number => Number((x as number | bigint | null) ?? 0);
const str = (x: unknown): string => (typeof x === "string" ? x : x == null ? "" : String(x));

function bulanDari(from: string): string {
  return MONTHS_ID[Number(from.slice(5, 7)) - 1] ?? "";
}

/**
 * RL 5.1 — Data Morbiditas Pasien Rawat Jalan pada periode. Read-only SIMGOS;
 * logika di-port dari SP `LaporanRL51Revisi` dengan kelompok umur diperbaiki ke
 * 25 batas resmi (SP asli memakai getKelompokUmur 9-kelompok yang salah).
 */
export async function getRl51(input: Rl51Query): Promise<Rl51Result> {
  const filter: Rl51Filter = { from: input.from, to: input.to };
  const base = {
    periode: filter,
    bulan: bulanDari(input.from),
    tahun: Number(input.to.slice(0, 4)),
    updatedAt: new Date().toISOString(),
  };

  if (!isSimgosConfigured()) {
    return {
      data: [],
      summary: { jenisDiag: 0, totalKunjungan: 0, totalBaru: 0, totalLk: 0, totalPr: 0 },
      instansi: null,
      ...base,
    };
  }

  const [rows, instansiRow] = await Promise.all([
    queryRl51Matrix(filter),
    queryRl51Instansi().catch(() => null),
  ]);

  const data: Rl51Row[] = rows.map((raw, i) => {
    const umur = [];
    for (let n = 1; n <= 25; n++) {
      umur.push({ lk: num(raw[`k${n}l`]), pr: num(raw[`k${n}p`]) });
    }
    const kode = str(raw.kode);
    const nama = str(raw.nama).trim();
    return {
      rank: i + 1,
      kode,
      diagnosa: nama || kode,
      total: num(raw.total),
      lk: num(raw.lk),
      pr: num(raw.pr),
      baru: num(raw.baru),
      baruLk: num(raw.baruLk),
      baruPr: num(raw.baruPr),
      umur,
    };
  });

  const summary = {
    jenisDiag: data.length,
    totalKunjungan: data.reduce((s, d) => s + d.total, 0),
    totalBaru: data.reduce((s, d) => s + d.baru, 0),
    totalLk: data.reduce((s, d) => s + d.lk, 0),
    totalPr: data.reduce((s, d) => s + d.pr, 0),
  };

  const instansi: Rl51Instansi | null = instansiRow
    ? {
        kodeRs: str(instansiRow.kodeRs),
        nama: str(instansiRow.nama),
        kodeProp: str(instansiRow.kodeProp),
        kota: str(instansiRow.kota),
      }
    : null;

  return { data, summary, instansi, ...base };
}

import "server-only";
import { isSimgosConfigured } from "@/server/lib/env";
import { queryRl41Instansi, queryRl41Matrix } from "./rl41.dal";
import { MONTHS_ID } from "./rl41.constants";
import type { Rl41Filter, Rl41Instansi, Rl41Result, Rl41Row } from "./rl41.types";
import type { Rl41Query } from "./rl41.schema";

const num = (x: unknown): number => Number((x as number | bigint | null) ?? 0);
const str = (x: unknown): string => (typeof x === "string" ? x : x == null ? "" : String(x));

function bulanDari(from: string): string {
  const m = Number(from.slice(5, 7)) - 1;
  return MONTHS_ID[m] ?? "";
}

/**
 * RL 4.1 — Data Morbiditas & Mortalitas Pasien Rawat Inap pada periode.
 * Read-only SIMGOS; logika di-port dari SP `LaporanRL41Revisi` (yang gagal
 * jalan karena fungsi umur SIMGOS hilang). Matriks + identitas instansi diambil
 * paralel; agregasi kolom umur sudah dilakukan di SQL, di sini hanya dipetakan.
 */
export async function getRl41(input: Rl41Query): Promise<Rl41Result> {
  const filter: Rl41Filter = { from: input.from, to: input.to, menular: input.menular };
  const base = {
    periode: { from: filter.from, to: filter.to },
    menular: filter.menular,
    bulan: bulanDari(input.from),
    tahun: Number(input.to.slice(0, 4)),
    updatedAt: new Date().toISOString(),
  };

  if (!isSimgosConfigured()) {
    return {
      data: [],
      summary: { jenisDiag: 0, totalKasus: 0, totalLk: 0, totalPr: 0, totalMati: 0 },
      instansi: null,
      ...base,
    };
  }

  const [rows, instansiRow] = await Promise.all([
    queryRl41Matrix(filter),
    queryRl41Instansi().catch(() => null),
  ]);

  const data: Rl41Row[] = rows.map((raw, i) => {
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
      mati: num(raw.mati),
      matiLk: num(raw.matiLk),
      matiPr: num(raw.matiPr),
      umur,
    };
  });

  const summary = {
    jenisDiag: data.length,
    totalKasus: data.reduce((s, d) => s + d.total, 0),
    totalLk: data.reduce((s, d) => s + d.lk, 0),
    totalPr: data.reduce((s, d) => s + d.pr, 0),
    totalMati: data.reduce((s, d) => s + d.mati, 0),
  };

  const instansi: Rl41Instansi | null = instansiRow
    ? {
        kodeRs: str(instansiRow.kodeRs),
        nama: str(instansiRow.nama),
        kodeProp: str(instansiRow.kodeProp),
        kota: str(instansiRow.kota),
      }
    : null;

  return { data, summary, instansi, ...base };
}

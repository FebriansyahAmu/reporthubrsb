/** Utilitas tanggal murni RL 3.2 (`YYYY-MM-DD`, UTC — tanpa pergeseran zona waktu server). */
import { MONTHS_ID } from "@/server/modules/rl41/rl41.constants";

export function tambahHari(ymd: string, n: number): string {
  const d = new Date(`${ymd}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

const tglPendek = (ymd: string) =>
  `${Number(ymd.slice(8, 10))} ${MONTHS_ID[Number(ymd.slice(5, 7)) - 1]?.slice(0, 3)} ${ymd.slice(0, 4)}`;

/** "September 2026" bila tepat satu bulan kalender, selain itu "1 Sep 2026 – 15 Sep 2026". */
export function judulPeriode(from: string, to: string): string {
  const satuBulan = from.endsWith("-01") && from.slice(0, 7) === to.slice(0, 7) && tambahHari(to, 1).endsWith("-01");
  return satuBulan ? `${MONTHS_ID[Number(from.slice(5, 7)) - 1]} ${from.slice(0, 4)}` : `${tglPendek(from)} – ${tglPendek(to)}`;
}

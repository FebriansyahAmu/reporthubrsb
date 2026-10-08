/** Utilitas tanggal murni RL 3.2 (`YYYY-MM-DD`, UTC — tanpa pergeseran zona waktu server). Aman untuk klien. */
import { MONTHS_ID } from "@/server/modules/rl41/rl41.constants";

export function tambahHari(ymd: string, n: number): string {
  const d = new Date(`${ymd}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Selisih hari kalender `b − a`. */
export const selisihHari = (a: string, b: string) =>
  Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);

const p2 = (n: number) => String(n).padStart(2, "0");
const hariTerakhir = (tahun: number, bulan: number) => new Date(Date.UTC(tahun, bulan, 0)).getUTCDate();

export type Triwulan = 1 | 2 | 3 | 4;
export const ROMAWI_TRIWULAN = ["I", "II", "III", "IV"] as const;

/** Bulan kalender (1..12) → rentang tanggal. */
export const rentangBulan = (tahun: number, bulan: number) => ({
  from: `${tahun}-${p2(bulan)}-01`,
  to: `${tahun}-${p2(bulan)}-${p2(hariTerakhir(tahun, bulan))}`,
});

/** Triwulan I (Jan–Mar) … IV (Okt–Des) → rentang tanggal. */
export const rentangTriwulan = (tahun: number, tw: Triwulan) => ({
  from: rentangBulan(tahun, tw * 3 - 2).from,
  to: rentangBulan(tahun, tw * 3).to,
});

export const triwulanDari = (bulan: number) => Math.ceil(bulan / 3) as Triwulan;

/**
 * Jenis periode menurut batasnya — menentukan judul dan label kolom
 * ("Pasien Awal Bulan" / "Awal Triwulan" / "Awal Tahun" / "Awal Periode").
 */
export type SatuanPeriode = "Bulan" | "Triwulan" | "Tahun" | "Periode";

export function satuanPeriode(from: string, to: string): SatuanPeriode {
  const tahun = Number(from.slice(0, 4));
  const bulan = Number(from.slice(5, 7));
  if (!from.endsWith("-01") || tambahHari(to, 1).slice(8) !== "01") return "Periode";
  if (from.slice(0, 7) === to.slice(0, 7)) return "Bulan";
  if (bulan % 3 === 1 && to === rentangTriwulan(tahun, triwulanDari(bulan)).to) return "Triwulan";
  if (bulan === 1 && to === `${tahun}-12-31`) return "Tahun";
  return "Periode";
}

const tglPendek = (ymd: string) =>
  `${Number(ymd.slice(8, 10))} ${MONTHS_ID[Number(ymd.slice(5, 7)) - 1]?.slice(0, 3)} ${ymd.slice(0, 4)}`;

/** "September 2026", "Triwulan III 2026", "Tahun 2025", selain itu "1 Sep 2026 – 15 Sep 2026". */
export function judulPeriode(from: string, to: string): string {
  const tahun = from.slice(0, 4);
  const bulan = Number(from.slice(5, 7));
  switch (satuanPeriode(from, to)) {
    case "Bulan":
      return `${MONTHS_ID[bulan - 1]} ${tahun}`;
    case "Triwulan":
      return `Triwulan ${ROMAWI_TRIWULAN[triwulanDari(bulan) - 1]} ${tahun}`;
    case "Tahun":
      return `Tahun ${tahun}`;
    default:
      return `${tglPendek(from)} – ${tglPendek(to)}`;
  }
}

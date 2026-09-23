import "server-only";
import { getAppDb } from "@/server/db/app.client";
import {
  JENIS_KLAIM, JENIS_KLAIM_LABEL, JENIS_KLAIM_TONE,
  STATUS_KLAIM, STATUS_KLAIM_LABEL, STATUS_KLAIM_TONE,
  type JenisKlaim, type StatusKlaim,
} from "./klaim.schema";
import type { KlaimDashboardData, KomposisiSlice, ToneStr, TrenBulan } from "./dashboard.types";

/**
 * Dashboard analitik Rekap Klaim BPJS (F-04.6): total YTD, pending belum cair,
 * potongan berjalan, tren bulanan & tahunan, komposisi jenis, sebaran status.
 * Semua dihitung on-the-fly dari `klaim_klaim` (+ `klaim_potongan`). Uang rupiah
 * penuh (BigInt→Number).
 */

const BELUM_CAIR = new Set<StatusKlaim>(["SUBMITTED", "APPROVED", "PARTIAL"]);

type Row = {
  jenisKlaim: string;
  kategori: string;
  tahunPelayanan: number;
  bulanPelayanan: number;
  jumlah: bigint;
  jumlahDiajukan: bigint | null;
  jumlahKasus: number | null;
  status: string;
};
type PotRow = { jenis: string; jumlah: bigint; cicilanKe: number | null; totalCicilan: number | null };

export async function getKlaimDashboard(): Promise<KlaimDashboardData> {
  const db = getAppDb();
  const [rows, pots] = await Promise.all([
    db.klaimKlaim.findMany({
      select: {
        jenisKlaim: true, kategori: true, tahunPelayanan: true, bulanPelayanan: true,
        jumlah: true, jumlahDiajukan: true, jumlahKasus: true, status: true,
      },
      take: 5000,
    }) as Promise<Row[]>,
    db.klaimPotongan.findMany({
      select: { jenis: true, jumlah: true, cicilanKe: true, totalCicilan: true },
      take: 5000,
    }) as Promise<PotRow[]>,
  ]);

  const tahunBerjalan = new Date().getFullYear();

  // Ringkasan YTD (tahun berjalan).
  let totalYtd = 0, diterimaYtd = 0, entriYtd = 0, kasusYtd = 0;
  // Belum cair & perlu perhatian (seluruh periode).
  let bcCount = 0, bcNilai = 0, perluPerhatian = 0;

  const entriJenis: Record<JenisKlaim, number> = { REGULER: 0, PENDING: 0, SUSULAN: 0 };
  const statusCount: Record<string, number> = {};
  const tahunMap = new Map<number, { dana: number; entri: number }>();
  const bulanArr: TrenBulan[] = Array.from({ length: 12 }, (_, i) => ({ bulan: i + 1, dana: 0, diterima: 0, entri: 0 }));

  for (const r of rows) {
    const jumlah = Number(r.jumlah);
    const diajukan = r.jumlahDiajukan == null ? null : Number(r.jumlahDiajukan);
    const kasus = r.jumlahKasus ?? 0;

    if (BELUM_CAIR.has(r.status as StatusKlaim)) { bcCount++; bcNilai += jumlah; }
    if (r.status === "EXPIRED" || r.status === "REJECTED" || (diajukan != null && diajukan !== jumlah)) perluPerhatian++;

    entriJenis[(r.jenisKlaim as JenisKlaim) in entriJenis ? (r.jenisKlaim as JenisKlaim) : "REGULER"] += 1;
    statusCount[r.status] = (statusCount[r.status] ?? 0) + 1;

    const ty = tahunMap.get(r.tahunPelayanan) ?? { dana: 0, entri: 0 };
    ty.dana += jumlah; ty.entri++;
    tahunMap.set(r.tahunPelayanan, ty);

    if (r.tahunPelayanan === tahunBerjalan) {
      totalYtd += jumlah;
      entriYtd++;
      kasusYtd += kasus;
      if (r.status === "RECEIVED") diterimaYtd += jumlah;
      const b = bulanArr[r.bulanPelayanan - 1];
      if (b) {
        b.dana += jumlah;
        b.entri++;
        if (r.status === "RECEIVED") b.diterima += jumlah;
      }
    }
  }

  // Potongan berjalan (cicilan belum lunas).
  let potCount = 0, potNilai = 0;
  for (const p of pots) {
    const berjalan = p.jenis === "POTONGAN_BERKALA" && p.cicilanKe != null && p.totalCicilan != null && p.cicilanKe < p.totalCicilan;
    if (berjalan) { potCount++; potNilai += Number(p.jumlah); }
  }

  const komposisiJenis: KomposisiSlice[] = JENIS_KLAIM
    .map((j): KomposisiSlice => ({ label: JENIS_KLAIM_LABEL[j], value: entriJenis[j], tone: JENIS_KLAIM_TONE[j] as ToneStr }))
    .filter((s) => s.value > 0);

  const statusKlaim: KomposisiSlice[] = STATUS_KLAIM
    .map((s): KomposisiSlice => ({ label: STATUS_KLAIM_LABEL[s], value: statusCount[s] ?? 0, tone: STATUS_KLAIM_TONE[s] as ToneStr }))
    .filter((s) => s.value > 0);

  const trenTahun = [...tahunMap.entries()]
    .map(([tahun, v]) => ({ tahun, dana: v.dana, entri: v.entri }))
    .sort((a, b) => a.tahun - b.tahun);

  return {
    tahunBerjalan,
    adaData: rows.length > 0,
    totals: { totalYtd, diterimaYtd, entriYtd, kasusYtd },
    belumCair: { count: bcCount, nilai: bcNilai },
    potonganBerjalan: { count: potCount, nilai: potNilai },
    perluPerhatian,
    komposisiJenis,
    statusKlaim,
    trenBulanan: bulanArr,
    trenTahun,
  };
}

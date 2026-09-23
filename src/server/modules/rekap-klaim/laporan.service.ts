import "server-only";
import { getAppDb } from "@/server/db/app.client";
import {
  JENIS_KLAIM, JENIS_KLAIM_LABEL,
  JENIS_LAYANAN,
  type JenisKlaim,
  type StatusKlaim,
} from "./klaim.schema";

/**
 * Laporan & rekapitulasi klaim (F-04). Semua angka dihitung on-the-fly dari
 * tabel `klaim_klaim` (+ potongan), TANPA tabel materialized — sesuai keputusan
 * modul. Empat bentuk laporan: rekap per tahun (matriks jenis×layanan),
 * perbandingan antar tahun, laporan klaim pending (RI vs RJ), dan laporan
 * rujukan ambulans. Uang tetap rupiah penuh (BigInt→Number).
 */

/** Status "belum cair" (dana belum/parsial masuk). Selaras status.service. */
const BELUM_CAIR = new Set<StatusKlaim>(["SUBMITTED", "APPROVED", "PARTIAL"]);

/* ------------------------------------------------------------------- tipe */

export type RekapCell = { ritl: number; rjtl: number; total: number };
export type RekapBulan = { bulan: number; entri: number; dana: number; kasus: number; potongan: number };

export type RekapTahunan = {
  tahun: number;
  /** Matriks INA-CBG's: jenis klaim → {RITL, RJTL, Total}. */
  inaCbgs: Record<JenisKlaim, RekapCell>;
  inaCbgsTotal: RekapCell;
  rujukan: { entri: number; kasus: number; dana: number };
  totalDana: number;
  totalPotongan: number;
  nilaiBersih: number;
  totalKasus: number;
  entri: number;
  belumCair: { count: number; nilai: number };
  perBulan: RekapBulan[];
};

export type PerbandinganRow = { key: string; label: string; perTahun: Record<number, number> };
export type Perbandingan = {
  tahun: number[];
  rows: PerbandinganRow[];
  totalDana: Record<number, number>;
  totalPotongan: Record<number, number>;
  nilaiBersih: Record<number, number>;
  totalKasus: Record<number, number>;
  entri: Record<number, number>;
};

export type PendingBulan = {
  tahun: number; bulan: number;
  riKasus: number; riBiaya: number;
  rjKasus: number; rjBiaya: number;
  kasus: number; biaya: number;
};
export type PendingReport = {
  perBulan: PendingBulan[];
  totals: { riKasus: number; riBiaya: number; rjKasus: number; rjBiaya: number; kasus: number; biaya: number };
};

export type RujukanBulan = { tahun: number; bulan: number; entri: number; kasus: number; biaya: number };
export type RujukanTahun = { tahun: number; entri: number; kasus: number; biaya: number };
export type RujukanReport = {
  perBulan: RujukanBulan[];
  perTahun: RujukanTahun[];
  totals: { entri: number; kasus: number; biaya: number };
};

export type LaporanData = {
  tahunTersedia: number[];
  /** Tahun terpilih utk rekap tahunan / pending / rujukan (null = semua tahun). */
  tahun: number | null;
  tahunan: RekapTahunan | null;
  perbandingan: Perbandingan;
  pending: PendingReport;
  rujukan: RujukanReport;
};

/* ------------------------------------------------------------ agregasi */

type Row = {
  jenisKlaim: string;
  jenisLayanan: string;
  kategori: string;
  tahunPelayanan: number;
  bulanPelayanan: number;
  jumlah: bigint;
  jumlahKasus: number | null;
  status: string;
  potongan: { jumlah: bigint }[];
};

const cell = (): RekapCell => ({ ritl: 0, rjtl: 0, total: 0 });
const potOf = (r: Row) => r.potongan.reduce((s, p) => s + Number(p.jumlah), 0);

function computeTahunan(rows: Row[], tahun: number): RekapTahunan {
  const inaCbgs: Record<JenisKlaim, RekapCell> = { REGULER: cell(), PENDING: cell(), SUSULAN: cell() };
  const rujukan = { entri: 0, kasus: 0, dana: 0 };
  let totalPotongan = 0, totalKasus = 0, entri = 0, bcCount = 0, bcNilai = 0;
  const bulanMap = new Map<number, RekapBulan>();

  for (const r of rows) {
    if (r.tahunPelayanan !== tahun) continue;
    const jumlah = Number(r.jumlah);
    const pot = potOf(r);
    const kasus = r.jumlahKasus ?? 0;
    entri++;
    totalPotongan += pot;
    totalKasus += kasus;
    if (BELUM_CAIR.has(r.status as StatusKlaim)) { bcCount++; bcNilai += jumlah; }

    if (r.kategori === "RUJUKAN_AMBULANS") {
      rujukan.entri++; rujukan.kasus += kasus; rujukan.dana += jumlah;
    } else {
      const c = inaCbgs[r.jenisKlaim as JenisKlaim] ?? inaCbgs.REGULER;
      if (r.jenisLayanan === "RITL") c.ritl += jumlah; else c.rjtl += jumlah;
      c.total += jumlah;
    }

    const b = bulanMap.get(r.bulanPelayanan) ?? { bulan: r.bulanPelayanan, entri: 0, dana: 0, kasus: 0, potongan: 0 };
    b.entri++; b.dana += jumlah; b.kasus += kasus; b.potongan += pot;
    bulanMap.set(r.bulanPelayanan, b);
  }

  const inaCbgsTotal = cell();
  for (const j of JENIS_KLAIM) {
    inaCbgsTotal.ritl += inaCbgs[j].ritl;
    inaCbgsTotal.rjtl += inaCbgs[j].rjtl;
    inaCbgsTotal.total += inaCbgs[j].total;
  }
  const totalDana = inaCbgsTotal.total + rujukan.dana;

  return {
    tahun, inaCbgs, inaCbgsTotal, rujukan,
    totalDana, totalPotongan, nilaiBersih: totalDana - totalPotongan,
    totalKasus, entri,
    belumCair: { count: bcCount, nilai: bcNilai },
    perBulan: [...bulanMap.values()].sort((a, b) => a.bulan - b.bulan),
  };
}

function computePerbandingan(rows: Row[], years: number[]): Perbandingan {
  const mkRec = () => Object.fromEntries(years.map((y) => [y, 0])) as Record<number, number>;
  const defs: { key: string; label: string; test: (r: Row) => boolean }[] = [];
  for (const j of JENIS_KLAIM) {
    for (const l of JENIS_LAYANAN) {
      defs.push({
        key: `${j}|${l}`,
        label: `${JENIS_KLAIM_LABEL[j]} · ${l}`,
        test: (r) => r.kategori === "INA_CBGS" && r.jenisKlaim === j && r.jenisLayanan === l,
      });
    }
  }
  defs.push({ key: "RUJUKAN", label: "Rujukan Ambulans", test: (r) => r.kategori === "RUJUKAN_AMBULANS" });

  const rowsOut: PerbandinganRow[] = defs.map((d) => ({ key: d.key, label: d.label, perTahun: mkRec() }));
  const totalDana = mkRec(), totalPotongan = mkRec(), totalKasus = mkRec(), entri = mkRec();

  for (const r of rows) {
    const y = r.tahunPelayanan;
    if (!(y in totalDana)) continue;
    const jumlah = Number(r.jumlah);
    totalDana[y] += jumlah;
    totalPotongan[y] += potOf(r);
    totalKasus[y] += r.jumlahKasus ?? 0;
    entri[y] += 1;
    for (let i = 0; i < defs.length; i++) {
      if (defs[i].test(r)) { rowsOut[i].perTahun[y] += jumlah; break; }
    }
  }

  const nilaiBersih = mkRec();
  for (const y of years) nilaiBersih[y] = totalDana[y] - totalPotongan[y];

  return {
    tahun: years,
    rows: rowsOut.filter((rw) => years.some((y) => rw.perTahun[y] !== 0)),
    totalDana, totalPotongan, nilaiBersih, totalKasus, entri,
  };
}

function computePending(rows: Row[], scopeYear: number | null): PendingReport {
  const map = new Map<string, PendingBulan>();
  for (const r of rows) {
    if (r.jenisKlaim !== "PENDING") continue;
    if (scopeYear != null && r.tahunPelayanan !== scopeYear) continue;
    const key = `${r.tahunPelayanan}-${r.bulanPelayanan}`;
    const e = map.get(key) ?? {
      tahun: r.tahunPelayanan, bulan: r.bulanPelayanan,
      riKasus: 0, riBiaya: 0, rjKasus: 0, rjBiaya: 0, kasus: 0, biaya: 0,
    };
    const jumlah = Number(r.jumlah);
    const k = r.jumlahKasus ?? 0;
    if (r.jenisLayanan === "RITL") { e.riKasus += k; e.riBiaya += jumlah; } else { e.rjKasus += k; e.rjBiaya += jumlah; }
    e.kasus += k; e.biaya += jumlah;
    map.set(key, e);
  }
  const perBulan = [...map.values()].sort((a, b) => a.tahun - b.tahun || a.bulan - b.bulan);
  const totals = perBulan.reduce(
    (t, e) => ({
      riKasus: t.riKasus + e.riKasus, riBiaya: t.riBiaya + e.riBiaya,
      rjKasus: t.rjKasus + e.rjKasus, rjBiaya: t.rjBiaya + e.rjBiaya,
      kasus: t.kasus + e.kasus, biaya: t.biaya + e.biaya,
    }),
    { riKasus: 0, riBiaya: 0, rjKasus: 0, rjBiaya: 0, kasus: 0, biaya: 0 },
  );
  return { perBulan, totals };
}

function computeRujukan(rows: Row[], scopeYear: number | null): RujukanReport {
  const mb = new Map<string, RujukanBulan>();
  const mt = new Map<number, RujukanTahun>();
  for (const r of rows) {
    if (r.kategori !== "RUJUKAN_AMBULANS") continue;
    if (scopeYear != null && r.tahunPelayanan !== scopeYear) continue;
    const jumlah = Number(r.jumlah);
    const k = r.jumlahKasus ?? 0;
    const key = `${r.tahunPelayanan}-${r.bulanPelayanan}`;
    const e = mb.get(key) ?? { tahun: r.tahunPelayanan, bulan: r.bulanPelayanan, entri: 0, kasus: 0, biaya: 0 };
    e.entri++; e.kasus += k; e.biaya += jumlah;
    mb.set(key, e);
    const t = mt.get(r.tahunPelayanan) ?? { tahun: r.tahunPelayanan, entri: 0, kasus: 0, biaya: 0 };
    t.entri++; t.kasus += k; t.biaya += jumlah;
    mt.set(r.tahunPelayanan, t);
  }
  const perBulan = [...mb.values()].sort((a, b) => a.tahun - b.tahun || a.bulan - b.bulan);
  const perTahun = [...mt.values()].sort((a, b) => a.tahun - b.tahun);
  const totals = perBulan.reduce(
    (t, e) => ({ entri: t.entri + e.entri, kasus: t.kasus + e.kasus, biaya: t.biaya + e.biaya }),
    { entri: 0, kasus: 0, biaya: 0 },
  );
  return { perBulan, perTahun, totals };
}

/* ---------------------------------------------------------------- publik */

/** Ambil semua bentuk laporan sekaligus untuk lingkup tahun terpilih. */
export async function getLaporan(tahunParam?: number | "semua"): Promise<LaporanData> {
  const db = getAppDb();
  const rows = (await db.klaimKlaim.findMany({
    select: {
      jenisKlaim: true, jenisLayanan: true, kategori: true,
      tahunPelayanan: true, bulanPelayanan: true, jumlah: true,
      jumlahKasus: true, status: true,
      potongan: { select: { jumlah: true } },
    },
    take: 5000,
  })) as Row[];

  const yearsSet = new Set<number>();
  for (const r of rows) yearsSet.add(r.tahunPelayanan);
  const yearsAsc = [...yearsSet].sort((a, b) => a - b);
  const yearsDesc = [...yearsAsc].reverse();

  let tahun: number | null;
  if (tahunParam === "semua") tahun = null;
  else if (typeof tahunParam === "number" && yearsSet.has(tahunParam)) tahun = tahunParam;
  else tahun = yearsDesc[0] ?? null; // default: tahun terbaru

  return {
    tahunTersedia: yearsDesc,
    tahun,
    tahunan: tahun != null ? computeTahunan(rows, tahun) : null,
    perbandingan: computePerbandingan(rows, yearsAsc),
    pending: computePending(rows, tahun),
    rujukan: computeRujukan(rows, tahun),
  };
}

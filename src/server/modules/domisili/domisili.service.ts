import "server-only";
import { createTtlCache } from "@/server/lib/ttl-cache";
import { KODE_KAB_BOLTIM } from "./domisili.constants";
import { queryAgregatDomisili, queryWilayahKabupaten, type AgregatRow } from "./domisili.dal";
import { klasifikasi, namaRapi, type BarisAgregat, type HasilAgregat } from "./domisili.olah";
import type { DomisiliQuery } from "./domisili.schema";
import type { DomisiliResult } from "./domisili.types";

const angka = (v: number | bigint | null | undefined) => Number(v ?? 0);

/**
 * Satu hasil per periode dipakai bersama tampilan & ekspor, dan permintaan
 * bersamaan berbagi satu query (single-flight) — membuka laporan lalu
 * mengunduh Excel tidak memukul SIMGOS dua kali.
 */
const cacheHasil = createTtlCache<DomisiliResult>("laporan-domisili", { ttlMs: 60_000, max: 12 });
/** Nama kabupaten & daftar kecamatannya jarang berubah. */
const cacheWilayah = createTtlCache<{ nama: string; kecamatan: { kode: string; nama: string }[] }>(
  "laporan-domisili-wilayah",
  { ttlMs: 10 * 60_000, max: 1 },
);

function bacaAgregat(rows: AgregatRow[]): HasilAgregat {
  const baris: BarisAgregat[] = [];
  let total = { kunjungan: 0, pasien: 0 };
  for (const r of rows) {
    const nilai = { kunjungan: angka(r.kunjungan), pasien: angka(r.pasien) };
    if (angka(r.gKec) === 1) {
      total = nilai; // baris total keseluruhan ROLLUP
      continue;
    }
    baris.push({
      kec: r.kec ?? "",
      jenis: angka(r.gJenis) === 1 ? null : angka(r.jenis),
      ...nilai,
      namaKab: r.namaKab,
      namaKec: r.namaKec,
      namaProv: r.namaProv,
    });
  }
  return { baris, total };
}

async function wilayahKabupaten() {
  const { value } = await cacheWilayah.get(KODE_KAB_BOLTIM, async () => {
    const rows = await queryWilayahKabupaten(KODE_KAB_BOLTIM);
    const kab = rows.find((r) => Number(r.jenis) === 2);
    return {
      nama: namaRapi(kab?.nama) || "Bolaang Mongondow Timur",
      kecamatan: rows.filter((r) => Number(r.jenis) === 3).map((r) => ({ kode: r.id, nama: r.nama })),
    };
  });
  return value;
}

/**
 * Laporan Klasifikasi Kunjungan per Domisili: kunjungan IGD, rawat jalan, dan
 * rawat inap sekaligus, dikelompokkan dalam/luar Kab. Bolaang Mongondow Timur.
 * Read-only SIMGOS.
 */
export async function getDomisili(q: DomisiliQuery): Promise<DomisiliResult> {
  const { value } = await cacheHasil.get(`${q.from}|${q.to}`, async () => {
    const [rows, wil] = await Promise.all([queryAgregatDomisili(q.from, q.to), wilayahKabupaten()]);
    const k = klasifikasi(bacaAgregat(rows), KODE_KAB_BOLTIM, wil.kecamatan);
    return {
      periode: { from: q.from, to: q.to },
      kabupaten: { kode: KODE_KAB_BOLTIM, nama: wil.nama },
      ...k,
      updatedAt: new Date().toISOString(),
    };
  });
  return value;
}

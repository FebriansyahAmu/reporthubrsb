import "server-only";
import { buildMultiSheetWorkbook, reportSheet, stampWita, type ExcelColumn } from "@/server/lib/excel";
import { judulPeriode } from "@/server/modules/rl32/rl32.periode";
import { KELAS_DOMISILI, LAYANAN } from "./domisili.constants";
import type { BarisWilayah, DomisiliResult, KelasDomisili, NilaiLayanan } from "./domisili.types";

const ANGKA = "#,##0";
const PERSEN = "0.0%";

/** Kolom angka bersama: kunjungan per layanan + semua (+ porsi), lalu pasien unik. */
function kolomNilai<T>(nilai: (r: T) => NilaiLayanan, porsi?: (r: T) => number | null): ExcelColumn<T>[] {
  const kunjungan: ExcelColumn<T>[] = [...LAYANAN, { key: "semua", label: "Semua" } as const].map((l) => ({
    header: `Kunjungan ${l.label}`,
    width: 13,
    value: (r: T) => nilai(r)[l.key].kunjungan,
    numFmt: ANGKA,
    bold: l.key === "semua",
  }));
  const pasien: ExcelColumn<T>[] = [...LAYANAN, { key: "semua", label: "Semua" } as const].map((l) => ({
    header: `Pasien ${l.label}`,
    width: 12,
    value: (r: T) => nilai(r)[l.key].pasien,
    numFmt: ANGKA,
  }));
  const kolomPorsi: ExcelColumn<T>[] = porsi
    ? [{ header: "% Kunjungan", width: 11, value: porsi, numFmt: PERSEN, align: "right" }]
    : [];
  return [...kunjungan, ...kolomPorsi, ...pasien];
}

const totalNilai = (n: NilaiLayanan, porsi?: number | null) => [
  ...[...LAYANAN.map((l) => n[l.key].kunjungan), n.semua.kunjungan],
  ...(porsi === undefined ? [] : [porsi]),
  ...[...LAYANAN.map((l) => n[l.key].pasien), n.semua.pasien],
];

function jumlahkan(baris: BarisWilayah[]): NilaiLayanan {
  const t: NilaiLayanan = {
    igd: { kunjungan: 0, pasien: 0 },
    rj: { kunjungan: 0, pasien: 0 },
    ri: { kunjungan: 0, pasien: 0 },
    semua: { kunjungan: 0, pasien: 0 },
  };
  for (const b of baris) {
    for (const k of ["igd", "rj", "ri", "semua"] as const) {
      t[k].kunjungan += b.nilai[k].kunjungan;
      t[k].pasien += b.nilai[k].pasien;
    }
  }
  return t;
}

export type DomisiliExcelMeta = { generatedAt: Date; by?: string };

/** Workbook "Klasifikasi Kunjungan per Domisili": ringkasan + rincian dalam & luar kabupaten. */
export async function buildDomisiliExcel(d: DomisiliResult, meta: DomisiliExcelMeta): Promise<Buffer> {
  const kab = `Kab. ${d.kabupaten.nama}`;
  const periode = `Periode: ${judulPeriode(d.periode.from, d.periode.to)} (${d.periode.from} s/d ${d.periode.to})`;
  const definisi =
    "Kunjungan = pendaftaran per jenis layanan (pasien IGD yang lanjut rawat inap terhitung di IGD dan Rawat Inap). " +
    "Pasien = No. RM unik. Domisili = alamat pasien saat ini di SIMGOS (master pasien → wilayah).";
  const info = `Dibuat: ${stampWita(meta.generatedAt)}${meta.by ? ` oleh ${meta.by}` : ""}   ·   Sumber: SIMGOS (read-only)`;
  const subtitle = "RSUD Pratama Bolaang Mongondow Timur";
  const totalKunjungan = d.ringkasan.total.semua.kunjungan;
  const porsi = (n: number) => (totalKunjungan > 0 ? n / totalKunjungan : null);

  type BarisRingkasan = { label: string; nilai: NilaiLayanan };
  const kelas: KelasDomisili[] = ["dalam", "luar", "tidakDiketahui"];
  const ringkasan: BarisRingkasan[] = kelas.map((k) => ({ label: KELAS_DOMISILI[k], nilai: d.ringkasan[k] }));

  const lembarRingkasan = reportSheet<BarisRingkasan>({
    sheetName: "Ringkasan",
    title: "KLASIFIKASI KUNJUNGAN PER DOMISILI",
    subtitle,
    metaLines: [periode, definisi, info],
    columns: [
      { header: "Domisili", width: 38, value: (r) => r.label, bold: true },
      ...kolomNilai<BarisRingkasan>((r) => r.nilai, (r) => porsi(r.nilai.semua.kunjungan)),
    ],
    rows: ringkasan,
    totals: ["Total", ...totalNilai(d.ringkasan.total, totalKunjungan > 0 ? 1 : null)],
    generatedAt: meta.generatedAt,
  });

  const lembarDalam = reportSheet<BarisWilayah>({
    sheetName: "Dalam Kabupaten",
    title: `KUNJUNGAN DARI DALAM ${kab.toUpperCase()} — PER KECAMATAN`,
    subtitle,
    metaLines: [periode, info],
    columns: [
      { header: "Kode", width: 10, value: (r) => r.kode || "—", align: "center", text: true },
      { header: "Kecamatan", width: 28, value: (r) => r.nama },
      ...kolomNilai<BarisWilayah>((r) => r.nilai),
    ],
    rows: d.kecamatan,
    totals: [null, "Total", ...totalNilai(d.ringkasan.dalam)],
    generatedAt: meta.generatedAt,
  });

  const lembarLuar = reportSheet<BarisWilayah>({
    sheetName: "Luar Kabupaten",
    title: `KUNJUNGAN DARI LUAR ${kab.toUpperCase()} — PER KABUPATEN/KOTA`,
    subtitle,
    metaLines: [periode, info],
    columns: [
      { header: "Kode", width: 8, value: (r) => r.kode, align: "center", text: true },
      { header: "Kabupaten/Kota", width: 30, value: (r) => r.nama },
      { header: "Provinsi", width: 22, value: (r) => r.provinsi ?? "" },
      ...kolomNilai<BarisWilayah>((r) => r.nilai),
    ],
    rows: d.luar,
    totals: [null, "Total", null, ...totalNilai(jumlahkan(d.luar))],
    emptyText: "Tidak ada kunjungan dari luar kabupaten pada periode ini.",
    generatedAt: meta.generatedAt,
  });

  return buildMultiSheetWorkbook(meta.generatedAt, [lembarRingkasan, lembarDalam, lembarLuar]);
}

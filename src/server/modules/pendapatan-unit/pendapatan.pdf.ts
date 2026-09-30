import "server-only";
import { buildReportPdf, loadInstansiLogo, type PdfColumnDef, type PdfTableSpec } from "@/server/lib/pdf";
import { STATUS_TAGIHAN } from "./pendapatan.constants";
import {
  HEADER_NILAI,
  SUBJUDUL,
  angkaId,
  judulDokumen,
  kolomDokumen,
  metaDokumen,
  rupiah,
  type KolomDokumen,
} from "./pendapatan.dokumen";
import type { PendapatanUnitResult } from "./pendapatan.types";

/** Lebar area tabel A4 lanskap (pt) = 841,89 − 2 × margin 36. */
const LEBAR_TABEL = 769;
// Kolom nilai tunggal diberi lebar tetap agar judul panjangnya muat dalam 2 baris.
const LEBAR_TETAP: Record<string, number> = { No: 22, Layanan: 44, Kode: 52, Tagihan: 40, Porsi: 36, [HEADER_NILAI]: 110 };
const UNIT_MIN = 96;

const persen = (v: number) => `${(v * 100).toFixed(1).replace(".", ",")}%`;

const fmt = (k: KolomDokumen, v: string | number | null): string => {
  if (v == null) return "";
  if (typeof v === "string") return v;
  if (k.tipe === "persen") return persen(v);
  return angkaId(v);
};

const NOMINAL_MIN = 46; // "99.999.999" Helvetica 8pt + padding
const NOMINAL_MAKS = 68;

const tetapDari = (kolom: KolomDokumen[]) => kolom.reduce((a, k) => a + (LEBAR_TETAP[k.header] ?? 0), 0);
/** Kolom nominal berlebar dinamis (rincian per status). */
const jumlahNominal = (kolom: KolomDokumen[]) => kolom.filter((k) => k.tipe === "uang" && !(k.header in LEBAR_TETAP)).length;

/** Muat di A4 lanskap dengan lebar nominal minimum? */
const muat = (kolom: KolomDokumen[]) =>
  tetapDari(kolom) + UNIT_MIN + NOMINAL_MIN * jumlahNominal(kolom) <= LEBAR_TABEL;

/** Lebar kolom: kolom tetap, nominal rata dibagi, sisa untuk nama unit. */
function lebarKolom(kolom: KolomDokumen[]): PdfColumnDef[] {
  const nominal = jumlahNominal(kolom);
  const tetap = tetapDari(kolom);
  const perNominal = Math.min(NOMINAL_MAKS, Math.max(NOMINAL_MIN, (LEBAR_TABEL - tetap - UNIT_MIN) / Math.max(1, nominal)));
  const unit = Math.max(UNIT_MIN, LEBAR_TABEL - tetap - perNominal * nominal);
  return kolom.map((k) => ({
    header: k.header,
    width: k.header === "Unit" ? unit : (LEBAR_TETAP[k.header] ?? perNominal),
    align: k.tipe === "teks" ? "left" : k.header === "No" ? "center" : "right",
    maxLines: k.header === "Unit" ? 2 : 1,
  }));
}

/** Rekap per layanan (hanya cakupan Semua Layanan tanpa filter unit → totalnya = tabel unit). */
function tabelLayanan(r: PendapatanUnitResult): PdfTableSpec {
  const total = r.perLayanan.reduce((a, l) => a + l.total, 0);
  return {
    caption: "Rekap per Layanan",
    columns: [
      { header: "Layanan", width: 140 },
      { header: "Tagihan", width: 70, align: "right" },
      { header: "Total (Rp)", width: 110, align: "right" },
      { header: "Porsi", width: 60, align: "right" },
    ],
    rows: r.perLayanan.map((l) => [l.label, angkaId(l.tagihan), angkaId(l.total), persen(total > 0 ? l.total / total : 0)]),
    totals: ["TOTAL", angkaId(r.total.tagihan), angkaId(total), total > 0 ? "100,0%" : ""],
    note: "Satu tagihan dapat berpendapatan di lebih dari satu layanan (mis. IGD lalu rawat inap), sehingga jumlah tagihan per layanan dapat melebihi total.",
  };
}

/**
 * PDF A4 lanskap; bila tak muat, kolom rincian per status dilepas (tetap ada
 * di tabel Rekap Status).
 */
export async function buildPendapatanPdf(
  r: PendapatanUnitResult,
  opts: { generatedAt: Date; by: string },
): Promise<Buffer> {
  const lengkap = kolomDokumen(r);
  const kolom = muat(lengkap) ? lengkap : kolomDokumen(r, { perStatus: false });
  const logo = loadInstansiLogo();
  const judul = judulDokumen(r);
  return buildReportPdf({
    title: judul,
    subtitle: SUBJUDUL,
    metaLines: metaDokumen(r, { oleh: opts.by, waktu: opts.generatedAt }),
    generatedAt: opts.generatedAt,
    orientation: "landscape",
    logo: logo ? { bytes: logo, format: "png", height: 44 } : undefined,
    tables: [
      {
        caption: "Pendapatan per Unit",
        columns: lebarKolom(kolom),
        rows: r.units.map((u, i) => kolom.map((k) => fmt(k, k.nilai(u, i)))),
        totals: kolom.map((k) => fmt(k, k.total)),
      },
      ...(r.layanan.key === "semua" && !r.filter.ruangan ? [tabelLayanan(r)] : []),
      {
        caption: "Rekap Status Tagihan",
        columns: [
          { header: "Status", width: 140 },
          { header: "Dihitung", width: 70, align: "center" },
          { header: "Tagihan", width: 70, align: "right" },
          { header: "Total (Rp)", width: 110, align: "right" },
        ],
        rows: STATUS_TAGIHAN.map((s) => [
          s.label,
          r.perStatus[s.key].dipilih ? "Ya" : "Tidak",
          angkaId(r.perStatus[s.key].tagihan),
          angkaId(r.perStatus[s.key].total),
        ]),
        note: `Total yang dihitung: ${rupiah(r.total.total)} dari ${angkaId(r.total.tagihan)} tagihan.`,
      },
    ],
    footerNote: judul,
  });
}

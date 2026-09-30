import "server-only";
import { buildReportWorkbook, type ExcelColumn } from "@/server/lib/excel";
import { SUBJUDUL, judulDokumen, kolomDokumen, metaDokumen, type TipeKolom } from "./pendapatan.dokumen";
import type { PendapatanUnitResult, UnitPendapatan } from "./pendapatan.types";

const NUMFMT: Record<TipeKolom, string | undefined> = {
  teks: undefined,
  angka: "#,##0",
  uang: "#,##0",
  persen: "0.0%",
};

/** Excel: kolom ringkas (satu kolom nilai + rincian per status) + baris TOTAL. */
export async function buildPendapatanExcel(
  r: PendapatanUnitResult,
  opts: { generatedAt: Date; by: string },
): Promise<Buffer> {
  const kolom = kolomDokumen(r);
  const columns: ExcelColumn<UnitPendapatan>[] = kolom.map((k) => ({
    header: k.header,
    width: k.lebar,
    value: k.nilai,
    numFmt: NUMFMT[k.tipe],
    text: k.header === "Kode",
    align: k.tipe === "teks" ? "left" : k.header === "No" ? "center" : "right",
  }));
  return buildReportWorkbook({
    sheetName: "Pendapatan per Unit",
    title: judulDokumen(r),
    subtitle: SUBJUDUL,
    metaLines: metaDokumen(r, { oleh: opts.by, waktu: opts.generatedAt }),
    columns,
    rows: r.units,
    totals: kolom.map((k) => k.total),
    generatedAt: opts.generatedAt,
    emptyText: `Tidak ada unit ${r.layanan.label} dalam cakupan.`,
  });
}

import type { RujukanExportRow, RujukanRow } from "./rujukan.dal";
import type { JenisPelayanan, RujukanKeluarExportItem, RujukanKeluarItem } from "./rujukan.types";

const clean = (s: string | null | undefined) => (s ?? "").trim();

function statusLabel(status: number): string {
  if (status === 1) return "Aktif";
  if (status === 0) return "Batal";
  return String(status);
}

export function mapRujukan(r: RujukanRow): RujukanKeluarItem {
  const jns: JenisPelayanan = Number(r.jnsPelayanan) === 1 ? 1 : 2;
  const tujuanKode = clean(r.ppkDirujuk);
  return {
    noRujukan: clean(r.noRujukan),
    noSep: clean(r.noSep),
    tglRujukan: r.tglRujukan ?? "",
    tglRencanaKunjungan: r.tglRencanaKunjungan ?? "",
    jnsPelayanan: jns,
    jenisLabel: jns === 1 ? "Rawat Inap" : "Rawat Jalan",
    diagRujukan: clean(r.diagRujukan),
    catatan: clean(r.catatan),
    status: Number(r.status),
    pasienNama: clean(r.pasienNama) || "—",
    pasienNik: clean(r.pasienNik),
    tujuanKode,
    tujuanNama: clean(r.tujuanNama) || tujuanKode || "—",
    poliKode: clean(r.poliRujukan),
    poliNama: clean(r.poliNama),
  };
}

export function mapRujukanExport(r: RujukanExportRow): RujukanKeluarExportItem {
  const jns: JenisPelayanan = Number(r.jnsPelayanan) === 1 ? 1 : 2;
  const tujuanKode = clean(r.ppkDirujuk);
  return {
    tglRujukan: r.tglRujukan ?? "",
    tglRencanaKunjungan: r.tglRencanaKunjungan ?? "",
    tglBerlakuKunjungan: r.tglBerlakuKunjungan ?? "",
    noRujukan: clean(r.noRujukan),
    noSep: clean(r.noSep),
    noKartu: clean(r.noKartu),
    pasienNama: clean(r.pasienNama),
    pasienNik: clean(r.pasienNik),
    jenisLabel: jns === 1 ? "Rawat Inap" : "Rawat Jalan",
    diagRujukan: clean(r.diagRujukan),
    tujuanKode,
    tujuanNama: clean(r.tujuanNama) || tujuanKode,
    poliKode: clean(r.poliRujukan),
    poliNama: clean(r.poliNama),
    catatan: clean(r.catatan),
    statusLabel: statusLabel(Number(r.status)),
    pembuat: clean(r.pembuat),
  };
}

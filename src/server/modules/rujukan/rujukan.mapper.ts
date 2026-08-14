import type { RujukanRow } from "./rujukan.dal";
import type { JenisPelayanan, RujukanKeluarItem } from "./rujukan.types";

const clean = (s: string | null | undefined) => (s ?? "").trim();

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

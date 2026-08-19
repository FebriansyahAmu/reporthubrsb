import "server-only";
import { getSimgos } from "@/server/db/simgos.client";
import { SIMGOS_DB } from "@/server/db/simgos-databases";
import type { KategoriOption, ObatFilter } from "./farmasi.types";

const LAYANAN = SIMGOS_DB.LAYANAN;
const PENDAFTARAN = SIMGOS_DB.PENDAFTARAN;
const MASTER = SIMGOS_DB.MASTER;
const INV = SIMGOS_DB.INVENTORY;
const BAYAR = SIMGOS_DB.PEMBAYARAN;

/**
 * Ruangan pelayanan Farmasi (referensi JENIS_KUNJUNGAN=11). SP asli memfilter
 * `rg.JENIS_KUNJUNGAN = <param LAPORAN>`; untuk laporan farmasi nilainya SELALU 11
 * (semua resep farmasi masuk ruangan berjenis Farmasi), jadi kita kunci di sini.
 */
const JENIS_FARMASI = 11;

/**
 * Sub-query per baris resep (satu baris per `layanan.farmasi.ID`). Hanya join yang
 * MEMENGARUHI inklusi baris & nilai yang dipertahankan (rt untuk tarif, pk untuk
 * ruangan/status, pp untuk validitas pendaftaran, pj bila difilter cara bayar).
 * Semua LEFT JOIN "kosmetik" milik SP dibuang → hasil identik tapi jauh lebih cepat.
 *
 * `qty`/`nilai` dibungkus MAX agar aman terhadap ONLY_FULL_GROUP_BY & fan-out.
 * Tanggal & cara bayar di-bind (`?`); tak ada nilai user yang di-concat di sini.
 */
function innerSql(caraBayar: number): string {
  const pjJoin = caraBayar > 0 ? `LEFT JOIN ${PENDAFTARAN}.penjamin pj ON pp.NOMOR = pj.NOPEN` : "";
  const pjCond = caraBayar > 0 ? "AND pj.JENIS = ?" : "";
  return `
    SELECT lf.FARMASI AS farmasi,
           MAX(lf.JUMLAH) AS qty,
           MAX(lf.JUMLAH * rt.TARIF) AS nilai
    FROM ${LAYANAN}.farmasi lf
      LEFT JOIN ${BAYAR}.rincian_tagihan rt ON lf.ID = rt.REF_ID AND rt.JENIS = 4
    , ${PENDAFTARAN}.kunjungan pk
      LEFT JOIN ${MASTER}.ruangan rg ON pk.RUANGAN = rg.ID AND rg.JENIS = 5
    , ${PENDAFTARAN}.pendaftaran pp
      ${pjJoin}
    WHERE lf.\`STATUS\` = 2
      AND lf.KUNJUNGAN = pk.NOMOR AND pk.\`STATUS\` IN (1, 2)
      AND pk.NOPEN = pp.NOMOR
      AND rg.JENIS_KUNJUNGAN = ${JENIS_FARMASI}
      AND lf.TANGGAL BETWEEN ? AND ?
      ${pjCond}
    GROUP BY lf.ID, lf.FARMASI`;
}

/** Klausa filter kategori (prefix). Nilai sudah dijamin numerik oleh schema. */
function kategoriWhere(kategori: string[]): string {
  if (kategori.length === 0) return "";
  const ors = kategori.map((id) => `ik.ID LIKE '${id}%'`).join(" OR ");
  return `WHERE (${ors})`;
}

/** Parameter bind untuk innerSql (tanggal + cara bayar bila ada). */
function innerParams(f: ObatFilter): unknown[] {
  const from = `${f.from} 00:00:00`;
  const to = `${f.to} 23:59:59`;
  return f.caraBayar > 0 ? [from, to, f.caraBayar] : [from, to];
}

export type TopObatRow = {
  farmasiId: number;
  nama: string;
  kategori: string | null;
  kategoriLeaf: string | null;
  generik: number;
  merk: string | null;
  qty: number | bigint | null;
  nilai: number | bigint | string | null;
  resep: number | bigint | null;
};

/** Peringkat N obat terbesar (per kuantitas / nilai) pada periode & filter. */
export async function queryTopObat(f: ObatFilter): Promise<TopObatRow[]> {
  const order = f.metric === "nilai" ? "nilai" : "qty";
  const sql = `
    SELECT ib.ID AS farmasiId, ib.NAMA AS nama,
           ${MASTER}.getHeaderKategoriBarang(ik.ID) AS kategori,
           ik.NAMA AS kategoriLeaf,
           IF(ib.JENIS_GENERIK = 1, 1, 0) AS generik,
           mr.DESKRIPSI AS merk,
           SUM(t.qty) AS qty, SUM(t.nilai) AS nilai, COUNT(*) AS resep
    FROM ( ${innerSql(f.caraBayar)} ) t
    JOIN ${INV}.barang ib ON ib.ID = t.farmasi
    LEFT JOIN ${INV}.kategori ik ON ik.ID = ib.KATEGORI
    LEFT JOIN ${MASTER}.referensi mr ON mr.ID = ib.MERK AND mr.JENIS = 39
    ${kategoriWhere(f.kategori)}
    GROUP BY ib.ID, ib.NAMA, ib.JENIS_GENERIK, ik.ID, ik.NAMA, mr.DESKRIPSI
    ORDER BY ${order} DESC, ib.NAMA
    LIMIT ${Math.trunc(f.limit)}`;
  return getSimgos().$queryRawUnsafe<TopObatRow[]>(sql, ...innerParams(f));
}

export type GrandTotalRow = {
  jenisObat: number | bigint | null;
  totalQty: number | bigint | null;
  totalNilai: number | bigint | string | null;
};

/** Total keseluruhan (semua obat pada filter) untuk konteks "10 besar vs total". */
export async function queryObatGrandTotal(f: ObatFilter): Promise<GrandTotalRow> {
  const sql = `
    SELECT COUNT(DISTINCT ib.ID) AS jenisObat,
           SUM(t.qty) AS totalQty, SUM(t.nilai) AS totalNilai
    FROM ( ${innerSql(f.caraBayar)} ) t
    JOIN ${INV}.barang ib ON ib.ID = t.farmasi
    LEFT JOIN ${INV}.kategori ik ON ik.ID = ib.KATEGORI
    ${kategoriWhere(f.kategori)}`;
  const rows = await getSimgos().$queryRawUnsafe<GrandTotalRow[]>(sql, ...innerParams(f));
  return rows[0] ?? { jenisObat: 0, totalQty: 0, totalNilai: 0 };
}

export type KategoriRow = { id: string; nama: string; grup: string | null; grupId: string | null };

/**
 * Daftar kategori daun (JENIS=3) aktif beserta induknya (JENIS=2) untuk multi-pilih.
 * Statis relatif — tak bergantung filter. Read-only.
 */
export async function queryKategoriOptions(): Promise<KategoriOption[]> {
  const sql = `
    SELECT c.ID AS id, c.NAMA AS nama, pr.NAMA AS grup, pr.ID AS grupId
    FROM ${INV}.kategori c
    LEFT JOIN ${INV}.kategori pr ON pr.ID = LEFT(c.ID, 3) AND pr.JENIS = 2
    WHERE c.JENIS = 3 AND c.\`STATUS\` = 1
    ORDER BY pr.ID, c.NAMA`;
  const rows = await getSimgos().$queryRawUnsafe<KategoriRow[]>(sql);
  return rows.map((r) => ({
    id: r.id,
    nama: r.nama,
    grup: r.grup ?? "Lainnya",
    grupId: r.grupId ?? r.id.slice(0, 3),
  }));
}

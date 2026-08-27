import "server-only";
import { getSimgos } from "@/server/db/simgos.client";
import { SIMGOS_DB } from "@/server/db/simgos-databases";
import type { PengunjungFilter, RuanganOption } from "./pengunjung.types";

const PEND = SIMGOS_DB.PENDAFTARAN;
const MASTER = SIMGOS_DB.MASTER;

/**
 * FROM + WHERE inti (porting dari SP `LaporanPengunjungPerpasien`). Satu baris per
 * pendaftaran (GROUP BY pd.NOMOR). `tk` = kunjungan masuk utama (REF IS NULL) di
 * ruangan tujuan; `jkr.JENIS_KUNJUNGAN` menentukan RJ/IGD/RI. Tanggal (`tk.MASUK`)
 * di-bind (`?`); jenis/ruangan/caraBayar sudah divalidasi schema → aman di-inline.
 */
function coreFromWhere(f: PengunjungFilter): string {
  const bayar = f.caraBayar > 0 ? `AND pj.JENIS = ${f.caraBayar}` : "";
  return `
    FROM ${MASTER}.pasien p
    , ${PEND}.pendaftaran pd
      LEFT JOIN ${PEND}.penjamin pj ON pd.NOMOR = pj.NOPEN
      LEFT JOIN ${MASTER}.referensi ref ON pj.JENIS = ref.ID AND ref.JENIS = 10
    , ${PEND}.tujuan_pasien tp
      LEFT JOIN ${MASTER}.ruangan r ON tp.RUANGAN = r.ID AND r.JENIS = 5
      LEFT JOIN ${MASTER}.dokter dok ON tp.DOKTER = dok.ID
    , ${PEND}.kunjungan tk
    , ${MASTER}.ruangan jkr
    WHERE p.NORM = pd.NORM AND pd.NOMOR = tp.NOPEN AND pd.NOMOR = tk.NOPEN AND tp.RUANGAN = tk.RUANGAN
      AND pd.\`STATUS\` IN (1, 2) AND tk.REF IS NULL
      AND tk.RUANGAN = jkr.ID AND jkr.JENIS = 5
      AND tk.MASUK BETWEEN ? AND ? AND tk.\`STATUS\` IN (1, 2)
      AND jkr.JENIS_KUNJUNGAN = ${f.jenis} AND tp.RUANGAN LIKE '${f.ruangan}%'
      ${bayar}`;
}

/** Sub-query per kunjungan (kolom mentah, +nopenRi bila IGD). */
function baseSubquery(f: PengunjungFilter): string {
  const nopenRi = f.jenis === 2 ? `, ${MASTER}.getNopenIRNA(pd.NORM, pd.NOMOR) nopenRi` : "";
  return `
    SELECT pd.NOMOR nopen, p.NORM norm, p.JENIS_KELAMIN jns, p.TANGGAL_LAHIR tglLahir,
           pd.TANGGAL tglReg, tk.MASUK masuk, tk.KELUAR keluar, r.DESKRIPSI unit,
           ref.DESKRIPSI caraBayar, dok.NIP dokterNip,
           IF(DATE(p.TANGGAL) = DATE(tk.MASUK), 1, 0) baru ${nopenRi}
    ${coreFromWhere(f)}
    GROUP BY pd.NOMOR`;
}

/** base + filter tindak lanjut (IGD saja). */
function filteredBase(f: PengunjungFilter): string {
  let w = "";
  if (f.jenis === 2 && f.tindak === "rajal") w = "WHERE (v.nopenRi IS NULL OR v.nopenRi = '')";
  else if (f.jenis === 2 && f.tindak === "ranap") w = "WHERE (v.nopenRi IS NOT NULL AND v.nopenRi <> '')";
  return `SELECT v.* FROM ( ${baseSubquery(f)} ) v ${w}`;
}

const params = (f: PengunjungFilter) => [`${f.from} 00:00:00`, `${f.to} 23:59:59`];

export type PengunjungListRow = {
  nopen: string;
  norm: number | string;
  nama: string | null;
  jns: number;
  umurThn: number | null;
  baru: number;
  tglReg: string | null;
  masuk: string | null;
  keluar: string | null;
  unit: string | null;
  caraBayar: string | null;
  dokter: string | null;
  nopenRi?: string | null;
};

/**
 * Daftar pengunjung (satu halaman). Fungsi nama (getNamaLengkap /
 * getNamaLengkapPegawai) dievaluasi HANYA untuk baris hasil LIMIT.
 */
export async function queryPengunjungRows(
  f: PengunjungFilter,
  limit: number,
  offset: number,
): Promise<PengunjungListRow[]> {
  const nopenRi = f.jenis === 2 ? ", pg.nopenRi" : "";
  // Tanggal diformat di SQL (verbatim jam RS) agar tak bergeser TZ oleh adapter.
  const sql = `
    SELECT pg.nopen, pg.norm,
           ${MASTER}.getNamaLengkap(pg.norm) nama,
           pg.jns, TIMESTAMPDIFF(YEAR, pg.tglLahir, pg.tglReg) umurThn, pg.baru,
           DATE_FORMAT(pg.tglReg, '%d-%m-%Y %H:%i') tglReg,
           DATE_FORMAT(pg.masuk, '%d-%m-%Y %H:%i') masuk,
           DATE_FORMAT(pg.keluar, '%d-%m-%Y %H:%i') keluar,
           pg.unit, pg.caraBayar,
           ${MASTER}.getNamaLengkapPegawai(pg.dokterNip) dokter ${nopenRi}
    FROM ( SELECT * FROM ( ${filteredBase(f)} ) f ORDER BY f.unit, f.tglReg LIMIT ? OFFSET ? ) pg`;
  return getSimgos().$queryRawUnsafe<PengunjungListRow[]>(
    sql,
    ...params(f),
    Math.trunc(limit),
    Math.trunc(offset),
  );
}

export type PengunjungSummaryRow = {
  total: number | bigint | null;
  baru: number | bigint | null;
  lk: number | bigint | null;
  pr: number | bigint | null;
  rajal?: number | bigint | null;
};

/** Ringkasan agregat (total, baru, L/P, + split IGD) atas filter aktif. */
export async function queryPengunjungSummary(f: PengunjungFilter): Promise<PengunjungSummaryRow> {
  const rajal = f.jenis === 2 ? ", SUM(s.nopenRi IS NULL OR s.nopenRi = '') rajal" : "";
  const sql = `
    SELECT COUNT(*) total, SUM(s.baru) baru, SUM(s.jns = 1) lk, SUM(s.jns = 2) pr ${rajal}
    FROM ( ${filteredBase(f)} ) s`;
  const rows = await getSimgos().$queryRawUnsafe<PengunjungSummaryRow[]>(sql, ...params(f));
  return rows[0] ?? { total: 0, baru: 0, lk: 0, pr: 0 };
}

export type RuanganRow = { id: string; nama: string | null; jenis: number };

/** Daftar ruangan aktif (JENIS=5) berjenis RJ/IGD/RI untuk selektor. Read-only. */
export async function queryRuanganOptions(): Promise<RuanganOption[]> {
  const sql = `
    SELECT ID id, DESKRIPSI nama, JENIS_KUNJUNGAN jenis
    FROM ${MASTER}.ruangan
    WHERE JENIS = 5 AND JENIS_KUNJUNGAN IN (1, 2, 3) AND \`STATUS\` = 1
    ORDER BY JENIS_KUNJUNGAN, DESKRIPSI`;
  const rows = await getSimgos().$queryRawUnsafe<RuanganRow[]>(sql);
  return rows.map((r) => ({
    id: r.id,
    nama: r.nama?.trim() || r.id,
    jenis: Number(r.jenis) as RuanganOption["jenis"],
  }));
}

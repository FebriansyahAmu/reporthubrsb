import "server-only";
import { getSimgos } from "@/server/db/simgos.client";
import { SIMGOS_DB } from "@/server/db/simgos-databases";
import type { RujukanKeluarFilter } from "./rujukan.types";

const B = SIMGOS_DB.BPJS;

/** Baris mentah hasil join (nama kolom apa adanya / alias). */
export type RujukanRow = {
  noRujukan: string;
  noSep: string;
  tglRujukan: string | null;
  tglRencanaKunjungan: string | null;
  jnsPelayanan: number;
  diagRujukan: string | null;
  catatan: string | null;
  status: number;
  ppkDirujuk: string | null;
  poliRujukan: string | null;
  pasienNama: string | null;
  pasienNik: string | null;
  tujuanNama: string | null;
  poliNama: string | null;
};

/**
 * Join rujukan → SEP kunjungan → peserta (nama/nik), + faskes tujuan (ppk) & poli.
 * Rujukan (bpjs.rujukan) tak punya nama pasien → resolusi lewat noSep.
 * SEMUA read-only, lintas-DB; nama DB dari konstanta; nilai filter di-bind (`?`).
 */
const JOINS = `
  FROM ${B}.rujukan r
  LEFT JOIN ${B}.kunjungan k ON k.noSEP = r.noSep
  LEFT JOIN ${B}.peserta ps ON ps.noKartu = k.noKartu
  LEFT JOIN ${B}.ppk ppk ON ppk.kode = r.ppkDirujuk
  LEFT JOIN ${B}.poli po ON po.kode = r.poliRujukan`;

function buildWhere(f: RujukanKeluarFilter, opts?: { ignoreJenis?: boolean }) {
  const cond: string[] = [];
  const params: unknown[] = [];
  if (f.from) {
    cond.push("r.tglRujukan >= ?");
    params.push(f.from);
  }
  if (f.to) {
    cond.push("r.tglRujukan <= ?");
    params.push(f.to);
  }
  if (f.jnsPelayanan && !opts?.ignoreJenis) {
    cond.push("r.jnsPelayanan = ?");
    params.push(f.jnsPelayanan);
  }
  if (f.search) {
    cond.push("(ps.nama LIKE ? OR r.noSep LIKE ? OR r.noRujukan LIKE ? OR ppk.nama LIKE ?)");
    const like = `%${f.search}%`;
    params.push(like, like, like, like);
  }
  return { where: cond.length ? `WHERE ${cond.join(" AND ")}` : "", params };
}

/**
 * Daftar rujukan keluar (halaman). `limit`/`offset` = integer tervalidasi (zod)
 * sehingga aman di-inline; sisanya di-bind.
 */
export async function queryRujukanKeluar(
  f: RujukanKeluarFilter,
  limit: number,
  offset: number,
): Promise<RujukanRow[]> {
  const { where, params } = buildWhere(f);
  const sql = `
    SELECT r.noRujukan, r.noSep,
           DATE_FORMAT(r.tglRujukan, '%Y-%m-%d') AS tglRujukan,
           DATE_FORMAT(r.tglRencanaKunjungan, '%Y-%m-%d') AS tglRencanaKunjungan,
           r.jnsPelayanan, r.diagRujukan, r.catatan, r.status,
           r.ppkDirujuk, r.poliRujukan,
           ps.nama AS pasienNama, ps.nik AS pasienNik,
           ppk.nama AS tujuanNama, po.nama AS poliNama
    ${JOINS}
    ${where}
    ORDER BY r.tglRujukan DESC, r.noRujukan DESC
    LIMIT ${Math.trunc(limit)} OFFSET ${Math.trunc(offset)}`;
  return getSimgos().$queryRawUnsafe<RujukanRow[]>(sql, ...params);
}

/** Baris lengkap untuk EXPORT (kolom lebih banyak, tanpa paginasi). */
export type RujukanExportRow = RujukanRow & {
  tglBerlakuKunjungan: string | null;
  noKartu: string | null;
  pembuat: string | null;
};

/**
 * Semua rujukan yang cocok filter (untuk export Excel) — tanpa paginasi, dibatasi
 * `cap` baris agar aman. Kolom lengkap. Menghormati filter tanggal/jenis/cari.
 */
export async function queryRujukanKeluarAll(
  f: RujukanKeluarFilter,
  cap: number,
): Promise<RujukanExportRow[]> {
  const { where, params } = buildWhere(f);
  const sql = `
    SELECT r.noRujukan, r.noSep,
           DATE_FORMAT(r.tglRujukan, '%Y-%m-%d') AS tglRujukan,
           DATE_FORMAT(r.tglRencanaKunjungan, '%Y-%m-%d') AS tglRencanaKunjungan,
           DATE_FORMAT(r.tglBerlakuKunjungan, '%Y-%m-%d') AS tglBerlakuKunjungan,
           r.jnsPelayanan, r.diagRujukan, r.catatan, r.status,
           r.ppkDirujuk, r.poliRujukan, r.user AS pembuat,
           ps.nama AS pasienNama, ps.nik AS pasienNik, k.noKartu AS noKartu,
           ppk.nama AS tujuanNama, po.nama AS poliNama
    ${JOINS}
    ${where}
    ORDER BY r.tglRujukan DESC, r.noRujukan DESC
    LIMIT ${Math.trunc(cap)}`;
  return getSimgos().$queryRawUnsafe<RujukanExportRow[]>(sql, ...params);
}

/**
 * Hitung jumlah per jenis pelayanan (mengabaikan filter jenis → untuk chip),
 * menghormati filter tanggal & pencarian.
 */
export async function countRujukanKeluar(
  f: RujukanKeluarFilter,
): Promise<{ semua: number; rawatInap: number; rawatJalan: number }> {
  const { where, params } = buildWhere(f, { ignoreJenis: true });
  const sql = `
    SELECT r.jnsPelayanan AS j, COUNT(*) AS n
    ${JOINS}
    ${where}
    GROUP BY r.jnsPelayanan`;
  const rows = await getSimgos().$queryRawUnsafe<{ j: number; n: number | bigint }[]>(
    sql,
    ...params,
  );
  let ri = 0;
  let rj = 0;
  for (const row of rows) {
    const n = Number(row.n);
    if (Number(row.j) === 1) ri = n;
    else if (Number(row.j) === 2) rj = n;
  }
  return { rawatInap: ri, rawatJalan: rj, semua: ri + rj };
}

import "server-only";
import { getSimgos } from "@/server/db/simgos.client";
import { SIMGOS_DB } from "@/server/db/simgos-databases";

/**
 * DAL "Kontrol = SEP" — **READ-ONLY** SIMGOS (HIGH ALERT: hanya SELECT, tanpa
 * mengubah tabel/prosedur apa pun). Hanya `*.dal.ts` yang mengimpor `getSimgos`.
 *
 * Indeks (diverifikasi EXPLAIN 26 Nov 2026): bpjs.kunjungan.noSuratSKDP — WAJIB
 * `FORCE INDEX`: dengan ± 460 nomor di `IN (…)` optimizer memilih pindai penuh
 * (± 5 dtk) alih-alih range (± 0,5–1 dtk);
 * monitoring_rencana_kontrol.tglRencanaKontrol (range) & PRIMARY, rencana_kontrol
 * PRIMARY (noSurat), penjamin.NOMOR, pendaftaran/tujuan_pasien PRIMARY, kunjungan
 * NOPEN_RUANGAN_MASUK. SEP asal lewat PRIMARY (noKartu, noSEP) — join berekspresi
 * (`ref: func`) jauh lebih lambat. Daftar `IN (…)` dipotong per 500, berurutan.
 */

const PD = SIMGOS_DB.PENDAFTARAN;
const MS = SIMGOS_DB.MASTER;
const BP = SIMGOS_DB.BPJS;
const CAP = "/*+ MAX_EXECUTION_TIME(15000) */";
const CHUNK = 500;

type Num = number | bigint | string | null;
const num = (v: Num): number | null => (v == null || v === "" ? null : Number(v));
const teks = (v: string | null | undefined): string | null => v?.trim() || null;
const tgl = (v: string | null): string | null => (v && !v.startsWith("0000") ? v : null);

function query<T>(sql: string, params: readonly unknown[] = []): Promise<T[]> {
  return getSimgos().$queryRawUnsafe<T[]>(sql, ...params);
}

async function perPotongan<T>(nilai: readonly string[], run: (chunk: string[], ph: string) => Promise<T[]>): Promise<T[]> {
  const unik = [...new Set(nilai.filter(Boolean))];
  const out: T[] = [];
  for (let i = 0; i < unik.length; i += CHUNK) {
    const chunk = unik.slice(i, i + CHUNK);
    out.push(...(await run(chunk, chunk.map(() => "?").join(","))));
  }
  return out;
}

/** Satu baris per SEP: penjamin BPJS dengan ID terbesar (satu SEP bisa punya > 1 baris penjamin). */
function satuPerSep<T extends { sep: string; pjId: Num }>(rows: T[]): T[] {
  const per = new Map<string, { r: T; id: number }>();
  for (const r of rows) {
    const key = String(r.sep).trim();
    const id = num(r.pjId) ?? -1;
    const ada = per.get(key);
    if (!ada || id > ada.id) per.set(key, { r, id });
  }
  return [...per.values()].map((x) => x.r);
}

export type SepPakaiRow = {
  noSurat: string;
  sep: string;
  noKartu: string;
  tglSep: string;
  jamSep: string | null;
  /** `bpjs.kunjungan.jenisPelayanan`: 1 = Rawat Inap, 2 = Rawat Jalan. */
  jenisPelayanan: number | null;
  poliSep: string | null;
  pembuatSep: string | null;
  nopen: string | null;
  norm: string | null;
  nama: string | null;
  ruanganId: string | null;
};

type SepPakaiMentah = Omit<SepPakaiRow, "jenisPelayanan" | "norm"> & { jenisPelayanan: Num; norm: Num; pjId: Num };

/**
 * SEP (tidak batal) yang MEMAKAI surat-surat ini (`noSuratSKDP` — Surat Kontrol
 * untuk SEP rawat jalan, SPRI untuk SEP rawat inap) + pasien & ruangan SIMRS.
 */
export async function querySepPerSurat(nos: readonly string[]): Promise<SepPakaiRow[]> {
  const rows = await perPotongan(nos, (chunk, ph) =>
    query<SepPakaiMentah>(
      `SELECT ${CAP} TRIM(k.noSuratSKDP) AS noSurat, k.noSEP AS sep, k.noKartu AS noKartu,
         DATE_FORMAT(k.tglSEP, '%Y-%m-%d') AS tglSep, TIME_FORMAT(k.tglSEP, '%H:%i') AS jamSep,
         k.jenisPelayanan AS jenisPelayanan, k.poliTujuan AS poliSep, k.user AS pembuatSep,
         pj.ID AS pjId, pj.NOPEN AS nopen, pp.NORM AS norm, ${MS}.getNamaLengkap(pp.NORM) AS nama,
         COALESCE(
           CASE WHEN k.jenisPelayanan = 1 THEN
             (SELECT k3.RUANGAN FROM ${PD}.kunjungan k3 JOIN ${MS}.ruangan r3 ON r3.ID = k3.RUANGAN AND r3.JENIS_KUNJUNGAN = 3
              WHERE k3.NOPEN = pj.NOPEN AND k3.STATUS IN (1, 2) ORDER BY k3.MASUK LIMIT 1)
           END,
           tp.RUANGAN
         ) AS ruanganId
       FROM ${BP}.kunjungan k FORCE INDEX (noSuratSKDP)
       LEFT JOIN ${PD}.penjamin pj ON pj.NOMOR = k.noSEP AND pj.JENIS = 2
       LEFT JOIN ${PD}.pendaftaran pp ON pp.NOMOR = pj.NOPEN
       LEFT JOIN ${PD}.tujuan_pasien tp ON tp.NOPEN = pj.NOPEN
       WHERE k.noSuratSKDP IN (${ph}) AND k.batalSEP = 0`,
      chunk,
    ),
  );
  return satuPerSep(rows).map((r) => ({
    noSurat: String(r.noSurat).trim(),
    sep: String(r.sep).trim(),
    noKartu: String(r.noKartu).trim(),
    tglSep: r.tglSep,
    jamSep: r.jamSep,
    jenisPelayanan: num(r.jenisPelayanan),
    poliSep: teks(r.poliSep),
    pembuatSep: teks(r.pembuatSep),
    nopen: teks(r.nopen),
    norm: r.norm == null ? null : String(r.norm),
    nama: teks(r.nama),
    ruanganId: teks(r.ruanganId),
  }));
}

/**
 * SEP (tidak batal) bersurat dengan TANGGAL SEP di [from, toEksklusif) — basis rekap
 * audit BPJS. Ringan (tanpa join); rincian diambil lewat `querySepPerSurat`.
 */
export async function querySepRentang(from: string, toEksklusif: string): Promise<{ sep: string; noSurat: string }[]> {
  const rows = await query<{ sep: string; noSurat: string }>(
    `SELECT ${CAP} k.noSEP AS sep, TRIM(k.noSuratSKDP) AS noSurat FROM ${BP}.kunjungan k FORCE INDEX (tglSEP)
     WHERE k.tglSEP >= ? AND k.tglSEP < ? AND k.batalSEP = 0 AND k.noSuratSKDP <> ''`,
    [from, toEksklusif],
  );
  return rows.map((r) => ({ sep: String(r.sep).trim(), noSurat: String(r.noSurat).trim() }));
}

export type CacheSuratSepRow = {
  noSurat: string;
  jenis: number | null;
  jnsPelayanan: string | null;
  tglRencana: string | null;
  tglTerbit: string | null;
  sepAsal: string | null;
  poliTujuan: string | null;
  kodeDokter: string | null;
  namaDokter: string | null;
  noKartu: string | null;
  nama: string | null;
};

type CacheSuratSepMentah = Omit<CacheSuratSepRow, "jenis"> & { jenis: Num };

const KOLOM_CACHE = `m.noSuratKontrol AS noSurat, m.jnsKontrol AS jenis, m.jnsPelayanan AS jnsPelayanan,
  DATE_FORMAT(m.tglRencanaKontrol, '%Y-%m-%d') AS tglRencana, DATE_FORMAT(m.tglTerbitKontrol, '%Y-%m-%d') AS tglTerbit,
  m.noSepAsalKontrol AS sepAsal, m.poliTujuan AS poliTujuan, m.kodeDokter AS kodeDokter, m.namaDokter AS namaDokter,
  m.noKartu AS noKartu, m.nama AS nama`;

const petakanCache = (r: CacheSuratSepMentah): CacheSuratSepRow => ({
  noSurat: String(r.noSurat).trim(),
  jenis: num(r.jenis),
  jnsPelayanan: teks(r.jnsPelayanan),
  tglRencana: tgl(r.tglRencana),
  tglTerbit: tgl(r.tglTerbit),
  sepAsal: teks(r.sepAsal),
  poliTujuan: teks(r.poliTujuan),
  kodeDokter: teks(r.kodeDokter),
  namaDokter: teks(r.namaDokter),
  noKartu: teks(r.noKartu),
  nama: teks(r.nama),
});

/**
 * CADANGAN bila webservice BPJS gagal: cache SIMGOS `bpjs.monitoring_rencana_kontrol`
 * (salinan respons VClaim) dengan tanggal rencana di [from, toEksklusif). Hanya
 * berisi surat yang pernah diambil webservice.
 */
export async function queryCacheSuratPerRencana(from: string, toEksklusif: string): Promise<CacheSuratSepRow[]> {
  const rows = await query<CacheSuratSepMentah>(
    `SELECT ${CAP} ${KOLOM_CACHE} FROM ${BP}.monitoring_rencana_kontrol m
     WHERE m.tglRencanaKontrol >= ? AND m.tglRencanaKontrol < ? AND m.jnsKontrol IN ('1', '2')`,
    [from, toEksklusif],
  );
  return rows.map(petakanCache);
}

/** Cache yang sama per nomor surat (melengkapi tanggal entri yang kosong di respons live). */
export function queryCacheSuratPerNomor(nos: readonly string[]): Promise<CacheSuratSepRow[]> {
  return perPotongan(nos, (chunk, ph) =>
    query<CacheSuratSepMentah>(`SELECT ${CAP} ${KOLOM_CACHE} FROM ${BP}.monitoring_rencana_kontrol m WHERE m.noSuratKontrol IN (${ph})`, chunk),
  ).then((rows) => rows.map(petakanCache));
}

export type LokalSepRow = { noSurat: string; jenis: number | null; nomor: string | null; pembuat: string | null; aktif: boolean };

/** Catatan penerbitan lokal SIMGOS (`bpjs.rencana_kontrol`): penerbit & status hapus. */
export function queryLokalPerNomor(nos: readonly string[]): Promise<LokalSepRow[]> {
  return perPotongan(nos, (chunk, ph) =>
    query<{ noSurat: string; jenis: Num; nomor: string | null; pembuat: string | null; status: Num }>(
      `SELECT ${CAP} rk.noSurat AS noSurat, rk.jnsKontrol AS jenis, rk.nomor AS nomor, rk.user AS pembuat, rk.status AS status
       FROM ${BP}.rencana_kontrol rk WHERE rk.noSurat IN (${ph})`,
      chunk,
    ),
  ).then((rows) =>
    rows.map((r) => ({ noSurat: String(r.noSurat).trim(), jenis: num(r.jenis), nomor: teks(r.nomor), pembuat: teks(r.pembuat), aktif: Number(r.status ?? 0) === 1 })),
  );
}

export type SepAsalRow = { noKartu: string; sep: string; jenisPelayanan: number | null; tglSep: string | null; tglPulang: string | null };

/**
 * SEP asal Surat Kontrol (`bpjs.kunjungan`, PRIMARY noKartu+noSEP). Pasangan
 * dicocokkan ulang di pemanggil (noKartu & noSEP dari daftar terpisah).
 */
export async function querySepAsal(pasangan: readonly { noKartu: string; sep: string }[]): Promise<SepAsalRow[]> {
  const out: SepAsalRow[] = [];
  const unik = [...new Map(pasangan.filter((p) => p.noKartu && p.sep).map((p) => [`${p.noKartu}|${p.sep}`, p])).values()];
  for (let i = 0; i < unik.length; i += CHUNK) {
    const chunk = unik.slice(i, i + CHUNK);
    const kartu = [...new Set(chunk.map((p) => p.noKartu))];
    const seps = [...new Set(chunk.map((p) => p.sep))];
    const rows = await query<{ noKartu: string; sep: string; jenisPelayanan: Num; tglSep: string | null; tglPulang: string | null }>(
      `SELECT ${CAP} a.noKartu AS noKartu, a.noSEP AS sep, a.jenisPelayanan AS jenisPelayanan,
         DATE_FORMAT(a.tglSEP, '%Y-%m-%d') AS tglSep, DATE_FORMAT(a.tglPlg, '%Y-%m-%d') AS tglPulang
       FROM ${BP}.kunjungan a
       WHERE a.noKartu IN (${kartu.map(() => "?").join(",")}) AND a.noSEP IN (${seps.map(() => "?").join(",")})`,
      [...kartu, ...seps],
    );
    for (const r of rows) {
      out.push({ noKartu: String(r.noKartu).trim(), sep: String(r.sep).trim(), jenisPelayanan: num(r.jenisPelayanan), tglSep: tgl(r.tglSep), tglPulang: tgl(r.tglPulang) });
    }
  }
  return out;
}

export type PasienSepRow = { sep: string; nopen: string | null; norm: string | null; nama: string | null };

/** Pasien per SEP (untuk surat yang belum dipakai: lewat SEP asalnya). Penjamin BPJS ID terbesar. */
export async function queryPasienPerSep(seps: readonly string[]): Promise<PasienSepRow[]> {
  const rows = await perPotongan(seps, (chunk, ph) =>
    query<{ sep: string; pjId: Num; nopen: string | null; norm: Num; nama: string | null }>(
      `SELECT ${CAP} pj.NOMOR AS sep, pj.ID AS pjId, pj.NOPEN AS nopen, pp.NORM AS norm, ${MS}.getNamaLengkap(pp.NORM) AS nama
       FROM ${PD}.penjamin pj JOIN ${PD}.pendaftaran pp ON pp.NOMOR = pj.NOPEN
       WHERE pj.NOMOR IN (${ph}) AND pj.JENIS = 2`,
      chunk,
    ),
  );
  return satuPerSep(rows).map((r) => ({ sep: String(r.sep).trim(), nopen: teks(r.nopen), norm: r.norm == null ? null : String(r.norm), nama: teks(r.nama) }));
}

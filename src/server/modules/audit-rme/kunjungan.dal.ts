import "server-only";
import { getSimgos } from "@/server/db/simgos.client";
import { SIMGOS_DB } from "@/server/db/simgos-databases";
import { addDaysIso } from "./audit.constants";
import { LOOKBACK_RI_HARI, type KategoriKey } from "./kunjungan.constants";

/**
 * DAL Fase 2 — data AKTUAL pengimputan RME per kunjungan. **READ-ONLY** (HIGH
 * ALERT: hanya SELECT). Konvensi layering: hanya `*.dal.ts` yang mengimpor
 * `getSimgos`.
 *
 * Strategi (PRD Fase 2 §5): kunjungan-first & halaman-terbatas → kategori
 * dihitung dengan `KUNJUNGAN IN (<nomor halaman>)` (index), sehingga biaya
 * terbatas ukuran halaman, bukan besar tabel. Kolom teks klinis tidak pernah
 * diambil di sini.
 */

const MR = SIMGOS_DB.MEDICALRECORD;
const LY = SIMGOS_DB.LAYANAN;
const PD = SIMGOS_DB.PENDAFTARAN;
const MS = SIMGOS_DB.MASTER;
const CAP = "/*+ MAX_EXECUTION_TIME(8000) */";

/* ------------------------------------------------ allow-list sumber kategori */

export type KategoriSource = {
  kategori: KategoriKey;
  /** Tabel ter-kualifikasi (dari konstanta — tak pernah dari input pengguna). */
  tabel: string;
  /** Kolom kunci ke kunjungan: `KUNJUNGAN` (= kunjungan.NOMOR) atau `NOPEN` (episode). */
  kunci: "KUNJUNGAN" | "NOPEN";
  /** Syarat tambahan statis (bukan input pengguna). */
  extra?: string;
  /** `aplikasi.objek.ID` untuk menelusuri log perubahan/pembatalan (REF = ID record). */
  objek: string;
};

/** Sumber data aktual per kategori (TERKUNCI — PRD Fase 2 §2.2 & §10). */
export const KATEGORI_SOURCES: readonly KategoriSource[] = [
  { kategori: "ASESMEN", tabel: `${MR}.anamnesis`, kunci: "KUNJUNGAN", objek: "21001" },
  { kategori: "ASESMEN", tabel: `${MR}.keluhan_utama`, kunci: "KUNJUNGAN", objek: "21009" },
  { kategori: "ASESMEN", tabel: `${MR}.pemeriksaan_fisik`, kunci: "KUNJUNGAN", objek: "21014" },
  { kategori: "CPPT", tabel: `${MR}.cppt`, kunci: "KUNJUNGAN", objek: "21002" },
  { kategori: "TTV", tabel: `${MR}.tanda_vital`, kunci: "KUNJUNGAN", objek: "21032" },
  // Diagnosis klinis manual saja (INA_GROUPER=0) — baris injeksi grouper bukan input klinis.
  { kategori: "DIAGNOSIS", tabel: `${MR}.diagnosa`, kunci: "NOPEN", extra: "INA_GROUPER = 0", objek: "21003" },
  { kategori: "TINDAKAN", tabel: `${LY}.tindakan_medis`, kunci: "KUNJUNGAN", objek: "18020" },
];

/* ------------------------------------------------------------ filter kunjungan */

export type KunjunganFilter = {
  from: string;
  to: string;
  jenis?: number;
  ruangan?: string;
  aktif?: boolean;
  batal?: boolean;
  q?: string;
};

const FROM_KUNJUNGAN = `${PD}.kunjungan k
  JOIN ${MS}.ruangan r ON r.ID = k.RUANGAN
  JOIN ${PD}.pendaftaran pp ON pp.NOMOR = k.NOPEN
  JOIN ${MS}.pasien ps ON ps.NORM = pp.NORM`;

const escapeLike = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);

/**
 * WHERE kunjungan "dalam rentang": MASUK di rentang, ATAU Rawat Inap yang masuk
 * sebelumnya namun masih dirawat saat rentang dimulai. Batas bawah `MASUK >=
 * awal − LOOKBACK` menjaga pemakaian index `MASUK`.
 */
function kunjunganWhere(f: KunjunganFilter, opts: { withLokasi: boolean }): { sql: string; params: unknown[] } {
  const start = `${f.from} 00:00:00`;
  const end = `${f.to} 23:59:59`;
  const cond: string[] = [
    "k.MASUK >= ?",
    "k.MASUK <= ?",
    "(k.MASUK >= ? OR (r.JENIS_KUNJUNGAN = 3 AND (k.KELUAR IS NULL OR k.KELUAR >= ?)))",
  ];
  const params: unknown[] = [`${addDaysIso(f.from, -LOOKBACK_RI_HARI)} 00:00:00`, end, start, start];

  if (!f.batal) cond.push("k.STATUS <> 0", "pp.STATUS <> 0");
  if (f.aktif) cond.push("k.STATUS = 1");
  if (opts.withLokasi && f.jenis != null) {
    cond.push("r.JENIS_KUNJUNGAN = ?");
    params.push(f.jenis);
  }
  if (opts.withLokasi && f.ruangan) {
    cond.push("k.RUANGAN LIKE ?");
    params.push(`${f.ruangan}%`);
  }
  if (f.q) {
    if (/^\d+$/.test(f.q)) {
      cond.push("pp.NORM = ?");
      params.push(Number(f.q));
    } else {
      cond.push("ps.NAMA LIKE ?");
      params.push(`%${escapeLike(f.q)}%`);
    }
  }
  return { sql: cond.join(" AND "), params };
}

export type KunjunganRow = {
  nomor: string;
  nopen: string;
  norm: string;
  nama: string | null;
  jenisKelamin: number | null;
  umur: number | null;
  ruanganId: string;
  jenis: number | null;
  masuk: string;
  keluar: string | null;
  status: number;
  statusDaftar: number;
};

/** Satu halaman kunjungan — terbaru dulu (MASUK desc, NOMOR desc). */
export async function queryKunjunganPage(f: KunjunganFilter, offset: number, limit: number): Promise<KunjunganRow[]> {
  const w = kunjunganWhere(f, { withLokasi: true });
  const sql = `SELECT ${CAP} k.NOMOR AS nomor, k.NOPEN AS nopen, pp.NORM AS norm, ps.NAMA AS nama,
      ps.JENIS_KELAMIN AS jenisKelamin, TIMESTAMPDIFF(YEAR, ps.TANGGAL_LAHIR, k.MASUK) AS umur,
      k.RUANGAN AS ruanganId, r.JENIS_KUNJUNGAN AS jenis,
      DATE_FORMAT(k.MASUK, '%Y-%m-%dT%H:%i:%s') AS masuk,
      DATE_FORMAT(k.KELUAR, '%Y-%m-%dT%H:%i:%s') AS keluar,
      k.STATUS AS status, pp.STATUS AS statusDaftar
    FROM ${FROM_KUNJUNGAN}
    WHERE ${w.sql}
    ORDER BY k.MASUK DESC, k.NOMOR DESC
    LIMIT ${Math.trunc(limit)} OFFSET ${Math.trunc(offset)}`;
  const rows = await getSimgos().$queryRawUnsafe<
    {
      nomor: string; nopen: string; norm: number | bigint; nama: string | null; jenisKelamin: number | null;
      umur: number | bigint | null; ruanganId: string; jenis: number | null; masuk: string; keluar: string | null;
      status: number; statusDaftar: number;
    }[]
  >(sql, ...w.params);
  return rows.map((r) => ({
    nomor: String(r.nomor),
    nopen: String(r.nopen),
    norm: String(r.norm),
    nama: r.nama?.trim() || null,
    jenisKelamin: r.jenisKelamin == null ? null : Number(r.jenisKelamin),
    umur: r.umur == null ? null : Number(r.umur),
    ruanganId: String(r.ruanganId),
    jenis: r.jenis == null ? null : Number(r.jenis),
    masuk: r.masuk,
    keluar: r.keluar ?? null,
    status: Number(r.status),
    statusDaftar: Number(r.statusDaftar),
  }));
}

export type KunjunganSummaryRow = { total: number; aktif: number; batal: number };

/** Total kunjungan cocok filter (+ yang sedang dilayani & batal) — untuk paginasi. */
export async function queryKunjunganSummary(f: KunjunganFilter): Promise<KunjunganSummaryRow> {
  const w = kunjunganWhere(f, { withLokasi: true });
  const sql = `SELECT ${CAP} COUNT(*) AS total, COALESCE(SUM(k.STATUS = 1), 0) AS aktif,
      COALESCE(SUM(k.STATUS = 0 OR pp.STATUS = 0), 0) AS batal
    FROM ${FROM_KUNJUNGAN}
    WHERE ${w.sql}`;
  const rows = await getSimgos().$queryRawUnsafe<
    { total: number | bigint; aktif: number | bigint | string; batal: number | bigint | string }[]
  >(sql, ...w.params);
  const r = rows[0];
  return { total: Number(r?.total ?? 0), aktif: Number(r?.aktif ?? 0), batal: Number(r?.batal ?? 0) };
}

/** Jumlah kunjungan per ruangan (tanpa filter jenis/ruangan) — untuk rail pohon ruangan. */
export async function queryKunjunganPerRuangan(
  f: KunjunganFilter,
): Promise<{ ruanganId: string; total: number; aktif: number }[]> {
  const w = kunjunganWhere(f, { withLokasi: false });
  const sql = `SELECT ${CAP} k.RUANGAN AS ruanganId, COUNT(*) AS total, COALESCE(SUM(k.STATUS = 1), 0) AS aktif
    FROM ${FROM_KUNJUNGAN}
    WHERE ${w.sql}
    GROUP BY k.RUANGAN`;
  const rows = await getSimgos().$queryRawUnsafe<
    { ruanganId: string; total: number | bigint; aktif: number | bigint | string }[]
  >(sql, ...w.params);
  return rows.map((r) => ({ ruanganId: String(r.ruanganId), total: Number(r.total), aktif: Number(r.aktif) }));
}

/* ----------------------------------------------------------- master ruangan */

export type RuanganRow = {
  id: string;
  nama: string;
  jenis: number | null;
  grupId: string | null;
  grupNama: string | null;
  aktif: boolean;
};

/** Semua ruang leaf (JENIS=5, 9 digit) + bangsal induknya (7 digit). Kecil & jarang berubah → di-cache. */
export async function queryRuanganMaster(): Promise<RuanganRow[]> {
  const sql = `SELECT r.ID AS id, r.DESKRIPSI AS nama, r.JENIS_KUNJUNGAN AS jenis, r.STATUS AS status,
      g.ID AS grupId, g.DESKRIPSI AS grupNama
    FROM ${MS}.ruangan r
    LEFT JOIN ${MS}.ruangan g ON g.ID = LEFT(r.ID, 7)
    WHERE r.JENIS = 5 AND CHAR_LENGTH(r.ID) = 9`;
  const rows = await getSimgos().$queryRawUnsafe<
    { id: string; nama: string | null; jenis: number | null; status: number; grupId: string | null; grupNama: string | null }[]
  >(sql);
  return rows.map((r) => ({
    id: String(r.id),
    nama: r.nama?.trim() || String(r.id),
    jenis: r.jenis == null ? null : Number(r.jenis),
    grupId: r.grupId ?? null,
    grupNama: r.grupNama?.trim() || null,
    aktif: Number(r.status) === 1,
  }));
}

/* -------------------------------------------------- hitung kategori per halaman */

export type KategoriCountRow = {
  kategori: KategoriKey;
  /** Nilai kunci: NOMOR kunjungan, atau NOPEN untuk kategori per-episode. */
  ref: string;
  oleh: string | null;
  aktif: number;
  batal: number;
};

/**
 * Jumlah input aktual per (kunjungan|episode) × penginput, untuk SATU halaman.
 * Satu round-trip `UNION ALL`; tiap bagian memakai index kolom kunci
 * (`KUNJUNGAN`/`NOPEN`). STATUS 0 = batal/dihapus, selain itu aktif.
 */
export async function queryKategoriCounts(nomors: string[], nopens: string[]): Promise<KategoriCountRow[]> {
  if (nomors.length === 0) return [];
  const parts: string[] = [];
  const params: unknown[] = [];
  for (const s of KATEGORI_SOURCES) {
    const keys = s.kunci === "KUNJUNGAN" ? nomors : nopens;
    if (keys.length === 0) continue;
    const ph = keys.map(() => "?").join(",");
    parts.push(`SELECT '${s.kategori}' AS kategori, ${s.kunci} AS ref, OLEH AS oleh,
        SUM(STATUS <> 0) AS aktif, SUM(STATUS = 0) AS batal
      FROM ${s.tabel}
      WHERE ${s.kunci} IN (${ph})${s.extra ? ` AND ${s.extra}` : ""}
      GROUP BY ${s.kunci}, OLEH`);
    params.push(...keys);
  }
  const sql = `SELECT ${CAP} * FROM (${parts.join("\nUNION ALL\n")}) x`;
  const rows = await getSimgos().$queryRawUnsafe<
    { kategori: KategoriKey; ref: string; oleh: number | bigint | null; aktif: number | bigint | string; batal: number | bigint | string }[]
  >(sql, ...params);
  return rows.map((r) => ({
    kategori: r.kategori,
    ref: String(r.ref),
    oleh: r.oleh == null || Number(r.oleh) === 0 ? null : String(r.oleh),
    aktif: Number(r.aktif),
    batal: Number(r.batal),
  }));
}

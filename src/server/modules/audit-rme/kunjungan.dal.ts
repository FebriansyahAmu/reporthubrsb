import "server-only";
import { getSimgos } from "@/server/db/simgos.client";
import { SIMGOS_DB } from "@/server/db/simgos-databases";
import { addDaysIso } from "./audit.constants";
import {
  LOOKBACK_RI_HARI,
  SUMBER,
  SUMBER_KEYS,
  type KategoriKey,
  type SumberKey,
} from "./kunjungan.constants";

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

/**
 * SQL spesifik tiap sumber (TERKUNCI — PRD Fase 2 §2.2 & §10). Alias tabel
 * utama selalu `t`. Semua nama tabel/kolom/ekspresi statis dari sini — tak
 * pernah dari input pengguna; nilai selalu di-bind `?`.
 */
type SumberSql = {
  tabel: string;
  /** Kolom kunci ke kunjungan: `KUNJUNGAN` (= kunjungan.NOMOR) atau `NOPEN` (episode). */
  kunci: "KUNJUNGAN" | "NOPEN";
  /** Waktu klinis (dipakai matriks shift). */
  waktu: string;
  /** Waktu simpan bila berbeda dari waktu klinis (TTV → dasar keterlambatan input). */
  waktuInput?: string;
  /** Ringkasan ringan per baris (tanpa kolom teks klinis berat). */
  peran?: string;
  teks?: string;
  angka?: readonly string[];
  join?: string;
  /** Kolom isi klinis yang boleh dibaca di detail per record. */
  isi: readonly string[];
  isiExtra?: string;
};

const JOIN_TINDAKAN = `LEFT JOIN ${MS}.tindakan mt ON mt.ID = t.TINDAKAN`;

export const SUMBER_SQL: Record<SumberKey, SumberSql> = {
  anamnesis: {
    tabel: `${MR}.anamnesis`, kunci: "KUNJUNGAN", waktu: "t.TANGGAL",
    isi: ["KELUHAN_UTAMA", "RPS", "RPP", "RPT", "RPK", "RL", "RIWAYAT_ALERGI", "REAKSI_ALERGI", "DESKRIPSI"],
  },
  keluhan_utama: { tabel: `${MR}.keluhan_utama`, kunci: "KUNJUNGAN", waktu: "t.TANGGAL", isi: ["DESKRIPSI"] },
  pemeriksaan_fisik: { tabel: `${MR}.pemeriksaan_fisik`, kunci: "KUNJUNGAN", waktu: "t.TANGGAL", isi: ["DESKRIPSI"] },
  cppt: {
    tabel: `${MR}.cppt`, kunci: "KUNJUNGAN", waktu: "t.TANGGAL", peran: "t.JENIS",
    isi: ["SUBYEKTIF", "OBYEKTIF", "ASSESMENT", "PLANNING", "INSTRUKSI"],
  },
  tanda_vital: {
    tabel: `${MR}.tanda_vital`, kunci: "KUNJUNGAN", waktu: "t.WAKTU_PEMERIKSAAN", waktuInput: "t.TANGGAL",
    angka: ["t.SISTOLIK", "t.DISTOLIK", "t.FREKUENSI_NADI", "t.FREKUENSI_NAFAS", "t.SUHU", "t.SATURASI_O2"],
    isi: ["KEADAAN_UMUM", "KESADARAN", "SISTOLIK", "DISTOLIK", "FREKUENSI_NADI", "FREKUENSI_NAFAS", "SUHU", "SATURASI_O2", "GCS", "EWSS"],
  },
  // SEMUA baris diagnosa dihitung. Catatan: INA_GROUPER=1 BUKAN injeksi otomatis —
  // 70% diagnosis diinput dokter dengan INA_GROUPER=1 (verifikasi 26 Sep 2026);
  // memfilter INA_GROUPER=0 akan salah menandai dokter "tidak mengisi diagnosis".
  diagnosa: {
    tabel: `${MR}.diagnosa`, kunci: "NOPEN", waktu: "t.TANGGAL",
    teks: "CONCAT_WS(' — ', NULLIF(TRIM(t.KODE), ''), NULLIF(TRIM(t.DIAGNOSA), ''))", angka: ["t.UTAMA"],
    isi: ["KODE", "DIAGNOSA", "UTAMA", "CATATAN"],
  },
  tindakan_medis: {
    tabel: `${LY}.tindakan_medis`, kunci: "KUNJUNGAN", waktu: "t.TANGGAL",
    teks: "mt.NAMA", angka: ["mt.JENIS", "t.VERIFIKASI"], join: JOIN_TINDAKAN,
    isi: ["VERIFIKASI"], isiExtra: "mt.NAMA AS NAMA_TINDAKAN",
  },
};

const ANGKA_MAKS = 6;

/* ------------------------------------------------------------ filter kunjungan */

export type KunjunganFilter = {
  from: string;
  to: string;
  jenis?: number;
  /** Daftar jenis (kelompok) — dipakai hanya bila `jenis` kosong. */
  jenisIn?: readonly number[];
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
  } else if (opts.withLokasi && f.jenisIn?.length) {
    cond.push(`r.JENIS_KUNJUNGAN IN (${f.jenisIn.map(() => "?").join(",")})`);
    params.push(...f.jenisIn);
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
  /** Tanggal pendaftaran episode — batas bawah aman log record episode ini. */
  tglDaftar: string | null;
};

const SELECT_KUNJUNGAN = `k.NOMOR AS nomor, k.NOPEN AS nopen, pp.NORM AS norm, ps.NAMA AS nama,
      ps.JENIS_KELAMIN AS jenisKelamin, TIMESTAMPDIFF(YEAR, ps.TANGGAL_LAHIR, k.MASUK) AS umur,
      k.RUANGAN AS ruanganId, r.JENIS_KUNJUNGAN AS jenis,
      DATE_FORMAT(k.MASUK, '%Y-%m-%dT%H:%i:%s') AS masuk,
      DATE_FORMAT(k.KELUAR, '%Y-%m-%dT%H:%i:%s') AS keluar,
      k.STATUS AS status, pp.STATUS AS statusDaftar, DATE_FORMAT(pp.TANGGAL, '%Y-%m-%d') AS tglDaftar`;

type KunjunganRaw = {
  nomor: string; nopen: string; norm: number | bigint; nama: string | null; jenisKelamin: number | null;
  umur: number | bigint | null; ruanganId: string; jenis: number | null; masuk: string; keluar: string | null;
  status: number; statusDaftar: number; tglDaftar: string | null;
};

const toKunjunganRow = (r: KunjunganRaw): KunjunganRow => ({
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
  tglDaftar: r.tglDaftar ?? null,
});

/** Satu halaman kunjungan — terbaru dulu (MASUK desc, NOMOR desc). */
export async function queryKunjunganPage(f: KunjunganFilter, offset: number, limit: number): Promise<KunjunganRow[]> {
  const w = kunjunganWhere(f, { withLokasi: true });
  const sql = `SELECT ${CAP} ${SELECT_KUNJUNGAN}
    FROM ${FROM_KUNJUNGAN}
    WHERE ${w.sql}
    ORDER BY k.MASUK DESC, k.NOMOR DESC
    LIMIT ${Math.trunc(limit)} OFFSET ${Math.trunc(offset)}`;
  const rows = await getSimgos().$queryRawUnsafe<KunjunganRaw[]>(sql, ...w.params);
  return rows.map(toKunjunganRow);
}

/** Satu kunjungan by NOMOR (PK) — termasuk yang batal. */
export async function queryKunjunganByNomor(nomor: string): Promise<KunjunganRow | null> {
  const sql = `SELECT ${SELECT_KUNJUNGAN} FROM ${FROM_KUNJUNGAN} WHERE k.NOMOR = ? LIMIT 1`;
  const rows = await getSimgos().$queryRawUnsafe<KunjunganRaw[]>(sql, nomor);
  return rows[0] ? toKunjunganRow(rows[0]) : null;
}

/** Banyak kunjungan by NOMOR (PK) — termasuk yang batal; urutan tidak dijamin. */
export async function queryKunjunganByNomors(nomors: string[]): Promise<KunjunganRow[]> {
  if (nomors.length === 0) return [];
  const sql = `SELECT ${CAP} ${SELECT_KUNJUNGAN} FROM ${FROM_KUNJUNGAN}
    WHERE k.NOMOR IN (${nomors.map(() => "?").join(",")})`;
  const rows = await getSimgos().$queryRawUnsafe<KunjunganRaw[]>(sql, ...nomors);
  return rows.map(toKunjunganRow);
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

/** Master tindakan (± 340 baris, jarang berubah) — dasar klasifikasi item tarif, di-cache resolver. */
export async function queryTindakanMaster(): Promise<{ id: number; nama: string }[]> {
  const rows = await getSimgos().$queryRawUnsafe<{ id: number; nama: string | null }[]>(
    `SELECT ID AS id, NAMA AS nama FROM ${MS}.tindakan`,
  );
  return rows.map((r) => ({ id: Number(r.id), nama: r.nama?.trim() ?? "" }));
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
  for (const key of SUMBER_KEYS) {
    const s = SUMBER_SQL[key];
    const keys = s.kunci === "KUNJUNGAN" ? nomors : nopens;
    if (keys.length === 0) continue;
    const ph = keys.map(() => "?").join(",");
    parts.push(`SELECT '${SUMBER[key].kategori}' AS kategori, ${s.kunci} AS ref, OLEH AS oleh,
        SUM(STATUS <> 0) AS aktif, SUM(STATUS = 0) AS batal
      FROM ${s.tabel}
      WHERE ${s.kunci} IN (${ph})
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

/* -------------------------------------------- record aktual satu kunjungan (K2) */

/** Batas baris per sumber untuk satu kunjungan (RI terpadat 30 hari: 120 tindakan). */
const RECORD_CAP = 1000;

export type RecordRow = {
  sumber: SumberKey;
  id: string;
  /** Waktu klinis `YYYY-MM-DDTHH:mm:ss` (jam dinding WITA). */
  waktu: string | null;
  waktuInput: string | null;
  oleh: string | null;
  status: number;
  peran: number | null;
  teks: string | null;
  angka: (number | null)[];
};

/**
 * Semua record aktual satu kunjungan (7 sumber, satu round-trip `UNION ALL`).
 * Kunci `KUNJUNGAN = ?` / `NOPEN = (subquery PK)` ter-index — tidak menunggu
 * query kunjungan sehingga bisa dijalankan paralel. Hanya kolom ringan; isi
 * klinis diambil terpisah per record (`queryRecordContent`).
 */
export async function queryKunjunganRecords(nomor: string): Promise<RecordRow[]> {
  const nopenDari = `(SELECT kx.NOPEN FROM ${PD}.kunjungan kx WHERE kx.NOMOR = ?)`;
  const fmt = (expr: string) => `DATE_FORMAT(${expr}, '%Y-%m-%dT%H:%i:%s')`;
  const parts: string[] = [];
  const params: unknown[] = [];
  for (const key of SUMBER_KEYS) {
    const s = SUMBER_SQL[key];
    const angka = Array.from({ length: ANGKA_MAKS }, (_, i) => `${s.angka?.[i] ?? "NULL"} AS n${i}`).join(", ");
    parts.push(`(SELECT '${key}' AS sumber, CAST(t.ID AS CHAR) AS id, ${fmt(s.waktu)} AS waktu,
        ${s.waktuInput ? fmt(s.waktuInput) : "NULL"} AS waktuInput, t.OLEH AS oleh, t.STATUS AS status,
        ${s.peran ?? "NULL"} AS peran, ${s.teks ?? "NULL"} AS teks, ${angka}
      FROM ${s.tabel} t ${s.join ?? ""}
      WHERE t.${s.kunci} = ${s.kunci === "KUNJUNGAN" ? "?" : nopenDari}
      ORDER BY t.ID
      LIMIT ${RECORD_CAP})`);
    params.push(nomor);
  }
  const sql = `SELECT ${CAP} * FROM (${parts.join("\nUNION ALL\n")}) x`;
  const rows = await getSimgos().$queryRawUnsafe<Record<string, unknown>[]>(sql, ...params);
  const num = (v: unknown) => (v == null ? null : Number(v));
  return rows.map((r) => ({
    sumber: r.sumber as SumberKey,
    id: String(r.id),
    waktu: (r.waktu as string | null) ?? null,
    waktuInput: (r.waktuInput as string | null) ?? null,
    oleh: r.oleh == null || Number(r.oleh) === 0 ? null : String(r.oleh),
    status: Number(r.status),
    peran: num(r.peran),
    teks: typeof r.teks === "string" ? r.teks.trim() || null : null,
    angka: Array.from({ length: ANGKA_MAKS }, (_, i) => num(r[`n${i}`])),
  }));
}

/* --------------------------------------------------------- log per record (K2) */

const L = SIMGOS_DB.LOGS;
/** Batas baris log per kunjungan (RI terpadat 30 hari: 32 baris). */
export const LOG_CAP = 2000;

export type RefGroup = { objek: string; refs: string[] };

/**
 * Jendela `TANGGAL` log. `logs.pengguna_akses_log` dipartisi RANGE COLUMNS
 * (TANGGAL) per bulan (140 partisi) — index `(OBJEK, REF)` bersifat lokal per
 * partisi, jadi tanpa batas TANGGAL setiap lookup menyisir semua partisi.
 * Batas bawah aman = tanggal pendaftaran episode (tak ada log sebelumnya:
 * 0/5000 cppt, 0/5000 tindakan, 0/1191 diagnosa — diverifikasi 27 Sep 2026).
 */
export type LogJendela = { sejak: string; sampai: string };

export type RecordLogRow = { id: string; ts: string; aksi: "C" | "U"; pengguna: string; objek: string; ref: string };

/**
 * Log CRUD untuk sekumpulan record (per objek: `OBJEK = ? AND REF IN (...)` →
 * index `(OBJEK, REF)`, partisi dipangkas via jendela TANGGAL). Tanpa kolom
 * SEBELUM/SESUDAH. Terbaru dulu.
 */
export async function queryRecordLogs(groups: RefGroup[], jendela: LogJendela): Promise<RecordLogRow[]> {
  const g = groups.filter((x) => x.refs.length > 0);
  if (g.length === 0) return [];
  const parts: string[] = [];
  const params: unknown[] = [];
  for (const x of g) {
    parts.push(`(SELECT ID AS id, DATE_FORMAT(TANGGAL, '%Y-%m-%dT%H:%i:%s') AS ts, AKSI AS aksi,
        PENGGUNA AS pengguna, OBJEK AS objek, REF AS ref
      FROM ${L}.pengguna_akses_log
      WHERE OBJEK = ? AND REF IN (${x.refs.map(() => "?").join(",")}) AND TANGGAL >= ? AND TANGGAL < ?)`);
    params.push(x.objek, ...x.refs, jendela.sejak, jendela.sampai);
  }
  const sql = `SELECT ${CAP} * FROM (${parts.join("\nUNION ALL\n")}) x ORDER BY id DESC LIMIT ${LOG_CAP + 1}`;
  const rows = await getSimgos().$queryRawUnsafe<
    { id: string; ts: string; aksi: "C" | "U"; pengguna: number | bigint; objek: string; ref: string }[]
  >(sql, ...params);
  return rows.map((r) => ({
    id: String(r.id),
    ts: r.ts,
    aksi: r.aksi,
    pengguna: String(r.pengguna),
    objek: String(r.objek),
    ref: String(r.ref),
  }));
}

export type SnapshotRow = { id: string; ts: string; pengguna: string; objek: string; ref: string; sesudah: string | null };

/**
 * Snapshot SESUDAH hanya untuk record BATAL yang sedang ditampilkan (sedikit
 * baris) — dasar melacak siapa & kapan menyetel STATUS → 0. Prefilter
 * `LIKE '%STATUS%'` membuang update yang tidak menyentuh status.
 */
export async function queryPembatalanSnapshots(groups: RefGroup[], jendela: LogJendela): Promise<SnapshotRow[]> {
  const g = groups.filter((x) => x.refs.length > 0);
  if (g.length === 0) return [];
  const parts: string[] = [];
  const params: unknown[] = [];
  for (const x of g) {
    parts.push(`(SELECT ID AS id, DATE_FORMAT(TANGGAL, '%Y-%m-%dT%H:%i:%s') AS ts, PENGGUNA AS pengguna,
        OBJEK AS objek, REF AS ref, SESUDAH AS sesudah
      FROM ${L}.pengguna_akses_log
      WHERE OBJEK = ? AND REF IN (${x.refs.map(() => "?").join(",")}) AND TANGGAL >= ? AND TANGGAL < ?
        AND AKSI = 'U' AND SESUDAH LIKE '%STATUS%')`);
    params.push(x.objek, ...x.refs, jendela.sejak, jendela.sampai);
  }
  const sql = `SELECT ${CAP} * FROM (${parts.join("\nUNION ALL\n")}) x ORDER BY id DESC`;
  const rows = await getSimgos().$queryRawUnsafe<
    { id: string; ts: string; pengguna: number | bigint; objek: string; ref: string; sesudah: string | null }[]
  >(sql, ...params);
  return rows.map((r) => ({
    id: String(r.id),
    ts: r.ts,
    pengguna: String(r.pengguna),
    objek: String(r.objek),
    ref: String(r.ref),
    sesudah: r.sesudah ?? null,
  }));
}

/* ------------------------------------------------ isi klinis satu record (K2) */

export type RecordContentRow = {
  id: string;
  kunci: string;
  /** Tanggal pendaftaran episode record (batas bawah jendela log). */
  tglDaftar: string | null;
  waktu: string | null;
  oleh: string | null;
  status: number;
  isi: Record<string, unknown>;
};

/**
 * Isi klinis SATU record (PK) — hanya kolom allow-list `SUMBER_SQL[sumber].isi`.
 * Satu-satunya query yang membaca teks klinis; dipanggil on-demand per record.
 */
export async function queryRecordContent(sumber: SumberKey, id: string): Promise<RecordContentRow | null> {
  const s = SUMBER_SQL[sumber];
  const cols = [...s.isi.map((c) => `t.${c} AS \`${c}\``), ...(s.isiExtra ? [s.isiExtra] : [])].join(", ");
  const nopen = s.kunci === "NOPEN" ? "t.NOPEN" : `(SELECT kx.NOPEN FROM ${PD}.kunjungan kx WHERE kx.NOMOR = t.KUNJUNGAN)`;
  const sql = `SELECT CAST(t.ID AS CHAR) AS id, t.${s.kunci} AS kunci,
      (SELECT DATE_FORMAT(px.TANGGAL, '%Y-%m-%d') FROM ${PD}.pendaftaran px WHERE px.NOMOR = ${nopen}) AS tglDaftar,
      DATE_FORMAT(${s.waktu}, '%Y-%m-%dT%H:%i:%s') AS waktu, t.OLEH AS oleh, t.STATUS AS status, ${cols}
    FROM ${s.tabel} t ${s.join ?? ""}
    WHERE t.ID = ?
    LIMIT 1`;
  const rows = await getSimgos().$queryRawUnsafe<Record<string, unknown>[]>(sql, id);
  const r = rows[0];
  if (!r) return null;
  const { id: rid, kunci, tglDaftar, waktu, oleh, status, ...isi } = r;
  return {
    id: String(rid),
    kunci: String(kunci),
    tglDaftar: (tglDaftar as string | null) ?? null,
    waktu: (waktu as string | null) ?? null,
    oleh: oleh == null || Number(oleh) === 0 ? null : String(oleh),
    status: Number(status),
    isi,
  };
}

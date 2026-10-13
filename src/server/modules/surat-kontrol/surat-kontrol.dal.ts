import "server-only";
import { getSimgos } from "@/server/db/simgos.client";
import { SIMGOS_DB } from "@/server/db/simgos-databases";

/**
 * DAL Audit Surat Kontrol — **READ-ONLY** SIMGOS (HIGH ALERT: hanya SELECT).
 * Konvensi layering: hanya `*.dal.ts` yang mengimpor `getSimgos`.
 *
 * Indeks yang dipakai (diverifikasi 12 Okt 2026): jadwal_kontrol.NOMOR_REFERENSI
 * & .TANGGAL, kunjungan.NOMOR (PK), rencana_kontrol.noSurat (PK).
 * perencanaan_rawat_inap.NOMOR_REFERENSI TAK berindeks — tabel kecil (± 3,7 rb
 * baris, 5 ms). Daftar `IN (…)` dipotong per 500 dan dijalankan BERURUTAN (satu
 * koneksi). Setiap query diberi MAX_EXECUTION_TIME; nilai selalu di-bind `?`.
 */

const MR = SIMGOS_DB.MEDICALRECORD;
const PD = SIMGOS_DB.PENDAFTARAN;
const MS = SIMGOS_DB.MASTER;
const BP = SIMGOS_DB.BPJS;
const CAP = "/*+ MAX_EXECUTION_TIME(10000) */";
const CHUNK = 500;

type Num = number | bigint | string | null;
const num = (v: Num): number | null => (v == null ? null : Number(v));

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

export type JadwalRow = {
  sumber: "JADWAL_KONTROL" | "SPRI";
  id: number;
  nomor: string | null;
  referensi: string | null;
  kunjungan: string | null;
  tanggal: string;
  jam: string | null;
  dokterId: number | null;
  ruanganId: string | null;
  status: number;
  sudahDigunakan: boolean;
  dibuat: string | null;
  olehId: string | null;
};

type JadwalMentah = {
  id: Num;
  nomor: string | null;
  referensi: string | null;
  kunjungan: string | null;
  tanggal: string;
  jam: string | null;
  dokterId: Num;
  ruanganId: string | null;
  status: Num;
  sudahDigunakan: Num;
  dibuat: string | null;
  olehId: Num;
};

const petakan = (sumber: JadwalRow["sumber"]) => (r: JadwalMentah): JadwalRow => ({
  sumber,
  id: Number(r.id),
  nomor: r.nomor?.trim() || null,
  referensi: r.referensi?.trim() || null,
  kunjungan: r.kunjungan?.trim() || null,
  tanggal: r.tanggal,
  jam: r.jam,
  dokterId: num(r.dokterId),
  ruanganId: r.ruanganId?.trim() || null,
  status: Number(r.status ?? 0),
  sudahDigunakan: Number(r.sudahDigunakan ?? 0) === 1,
  dibuat: r.dibuat,
  olehId: r.olehId == null ? null : String(r.olehId),
});

const KOLOM_JADWAL = `jk.ID AS id, jk.NOMOR AS nomor, jk.NOMOR_REFERENSI AS referensi, jk.KUNJUNGAN AS kunjungan,
  DATE_FORMAT(jk.TANGGAL, '%Y-%m-%d') AS tanggal, TIME_FORMAT(jk.JAM, '%H:%i') AS jam,
  jk.DOKTER AS dokterId, jk.RUANGAN AS ruanganId, jk.STATUS AS status, jk.SUDAH_DIGUNAKAN AS sudahDigunakan,
  DATE_FORMAT(jk.DIBUAT_TANGGAL, '%Y-%m-%dT%H:%i:%s') AS dibuat, jk.OLEH AS olehId`;

/** jadwal_kontrol yang merujuk nomor surat BPJS tertentu (semua status). */
export function queryJadwalPerReferensi(refs: readonly string[]): Promise<JadwalRow[]> {
  return perPotongan(refs, (chunk, ph) =>
    query<JadwalMentah>(`SELECT ${CAP} ${KOLOM_JADWAL} FROM ${MR}.jadwal_kontrol jk WHERE jk.NOMOR_REFERENSI IN (${ph})`, chunk),
  ).then((rows) => rows.map(petakan("JADWAL_KONTROL")));
}

/** jadwal_kontrol dengan tanggal jadwal di [from, to] (semua status). */
export async function queryJadwalRentang(from: string, to: string): Promise<JadwalRow[]> {
  const rows = await query<JadwalMentah>(
    `SELECT ${CAP} ${KOLOM_JADWAL} FROM ${MR}.jadwal_kontrol jk WHERE jk.TANGGAL BETWEEN ? AND ?`,
    [from, to],
  );
  return rows.map(petakan("JADWAL_KONTROL"));
}

/** SPRI SIMRS (perencanaan_rawat_inap) yang merujuk nomor surat BPJS (semua status). Tanpa jam/ruangan. */
export function querySpriPerReferensi(refs: readonly string[]): Promise<JadwalRow[]> {
  return perPotongan(refs, (chunk, ph) =>
    query<JadwalMentah>(
      `SELECT ${CAP} p.ID AS id, p.NOMOR AS nomor, p.NOMOR_REFERENSI AS referensi, p.KUNJUNGAN AS kunjungan,
         DATE_FORMAT(p.TANGGAL, '%Y-%m-%d') AS tanggal, NULL AS jam, p.DOKTER AS dokterId, NULL AS ruanganId,
         p.STATUS AS status, p.SUDAH_DIGUNAKAN AS sudahDigunakan,
         DATE_FORMAT(p.DIBUAT_TANGGAL, '%Y-%m-%dT%H:%i:%s') AS dibuat, p.OLEH AS olehId
       FROM ${MR}.perencanaan_rawat_inap p WHERE p.NOMOR_REFERENSI IN (${ph})`,
      chunk,
    ),
  ).then((rows) => rows.map(petakan("SPRI")));
}

export type KunjunganInfoRow = {
  nomor: string;
  nopen: string | null;
  norm: string | null;
  nama: string | null;
  ruanganId: string | null;
  jenis: number | null;
  /** pendaftaran.penjamin.JENIS terbaru episode (2 = BPJS). */
  penjamin: number | null;
};

/** Kunjungan asal jadwal → pasien (nama lengkap), ruangan asal, penjamin episode. */
export async function queryKunjunganInfo(nomors: readonly string[]): Promise<KunjunganInfoRow[]> {
  const rows = await perPotongan(nomors, (chunk, ph) =>
    query<{ nomor: string; nopen: string | null; norm: Num; nama: string | null; ruanganId: string | null; jenis: Num; penjamin: Num }>(
      `SELECT ${CAP} k.NOMOR AS nomor, k.NOPEN AS nopen, pp.NORM AS norm, ${MS}.getNamaLengkap(pp.NORM) AS nama,
         k.RUANGAN AS ruanganId, r.JENIS_KUNJUNGAN AS jenis,
         (SELECT pj.JENIS FROM ${PD}.penjamin pj WHERE pj.NOPEN = k.NOPEN ORDER BY pj.ID DESC LIMIT 1) AS penjamin
       FROM ${PD}.kunjungan k
       LEFT JOIN ${PD}.pendaftaran pp ON pp.NOMOR = k.NOPEN
       LEFT JOIN ${MS}.ruangan r ON r.ID = k.RUANGAN
       WHERE k.NOMOR IN (${ph})`,
      chunk,
    ),
  );
  return rows.map((r) => ({
    nomor: String(r.nomor),
    nopen: r.nopen ?? null,
    norm: r.norm == null ? null : String(r.norm),
    nama: r.nama?.trim() || null,
    ruanganId: r.ruanganId ?? null,
    jenis: num(r.jenis),
    penjamin: num(r.penjamin),
  }));
}

export type RencanaLokalRow = {
  noSurat: string;
  jenis: number;
  nomor: string | null;
  tglRencana: string;
  kodeDokter: string | null;
  poli: string | null;
  petugas: string | null;
  status: number;
};

const KOLOM_LOKAL = `rk.noSurat, rk.jnsKontrol AS jenis, rk.nomor, DATE_FORMAT(rk.tglRencanaKontrol, '%Y-%m-%d') AS tglRencana,
  rk.kodeDokter, rk.poliKontrol AS poli, rk.user AS petugas, rk.status`;
type LokalMentah = Omit<RencanaLokalRow, "jenis" | "status"> & { jenis: Num; status: Num };
const petakanLokal = (r: LokalMentah): RencanaLokalRow => ({
  noSurat: r.noSurat.trim(),
  jenis: Number(r.jenis),
  nomor: r.nomor?.trim() || null,
  tglRencana: r.tglRencana,
  kodeDokter: r.kodeDokter?.trim() || null,
  poli: r.poli?.trim() || null,
  petugas: r.petugas?.trim() || null,
  status: Number(r.status ?? 0),
});

/** Catatan penerbitan lokal (bpjs.rencana_kontrol) per nomor surat (PK). */
export function queryRencanaLokal(nos: readonly string[]): Promise<RencanaLokalRow[]> {
  return perPotongan(nos, (chunk, ph) =>
    query<LokalMentah>(`SELECT ${CAP} ${KOLOM_LOKAL} FROM ${BP}.rencana_kontrol rk WHERE rk.noSurat IN (${ph})`, chunk),
  ).then((rows) => rows.map(petakanLokal));
}

export type RencanaLokalLengkapRow = RencanaLokalRow & { nama: string | null; noKartu: string | null; poliNama: string | null };

/**
 * CADANGAN saat webservice BPJS gagal: surat aktif di catatan lokal dengan tanggal
 * rencana di [from, to] + nama peserta (SPRI: nomor = noKartu; Surat Kontrol:
 * nomor = noSEP → bpjs.kunjungan → peserta). Tabel kecil (± 7 rb baris).
 */
export async function queryRencanaLokalRentang(from: string, to: string): Promise<RencanaLokalLengkapRow[]> {
  const rows = await query<LokalMentah & { nama: string | null; noKartu: string | null; poliNama: string | null }>(
    `SELECT ${CAP} ${KOLOM_LOKAL},
       COALESCE(p1.nama, p2.nama) AS nama, COALESCE(p1.noKartu, bk.noKartu) AS noKartu, po.nama AS poliNama
     FROM ${BP}.rencana_kontrol rk
     LEFT JOIN ${BP}.peserta p1 ON rk.jnsKontrol = 1 AND p1.noKartu = rk.nomor
     LEFT JOIN ${BP}.kunjungan bk ON rk.jnsKontrol = 2 AND bk.noSEP = rk.nomor
     LEFT JOIN ${BP}.peserta p2 ON p2.noKartu = bk.noKartu
     LEFT JOIN ${BP}.poli po ON po.kode = rk.poliKontrol
     WHERE rk.tglRencanaKontrol BETWEEN ? AND ? AND rk.status = 1`,
    [from, to],
  );
  return rows.map((r) => ({ ...petakanLokal(r), nama: r.nama?.trim() || null, noKartu: r.noKartu?.trim() || null, poliNama: r.poliNama?.trim() || null }));
}

/** Master dokter SIMRS → nama lengkap pegawai (kecil, ± 30 baris). */
export async function queryDokterMaster(): Promise<{ id: number; nama: string | null }[]> {
  const rows = await query<{ id: Num; nama: string | null }>(
    `SELECT ${CAP} d.ID AS id, ${MS}.getNamaLengkapPegawai(d.NIP) AS nama FROM ${MS}.dokter d`,
  );
  return rows.map((r) => ({ id: Number(r.id), nama: r.nama?.trim() || null }));
}

/** Pemetaan ruangan SIMRS → kode poli BPJS (master.penjamin_ruangan, penjamin 2 = BPJS, aktif). */
export async function queryPoliBpjsPerRuangan(): Promise<{ ruangan: string; poli: string }[]> {
  const rows = await query<{ ruangan: string; poli: string }>(
    `SELECT ${CAP} RUANGAN_RS AS ruangan, RUANGAN_PENJAMIN AS poli FROM ${MS}.penjamin_ruangan WHERE PENJAMIN = 2 AND STATUS = 1`,
  );
  return rows.map((r) => ({ ruangan: String(r.ruangan).trim(), poli: String(r.poli).trim() }));
}

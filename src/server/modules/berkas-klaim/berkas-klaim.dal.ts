import "server-only";
import { getSimgos } from "@/server/db/simgos.client";
import { SIMGOS_DB } from "@/server/db/simgos-databases";

/** Header pasien + jumlah keberadaan tiap dokumen klaim untuk satu NOPEN. */
export type BerkasDetailRow = {
  NOPEN: string;
  NORM: string | number;
  NAMA: string;
  JENIS_KELAMIN: number | string;
  TANGGAL_LAHIR: Date | string | null;
  TRIAGE_N: number | string | null;
  RESUME_N: number | string | null;
  SPRI_N: number | string | null;
  CPPT_N: number | string | null;
  DIAGNOSA_N: number | string | null;
};

/**
 * Header episode + agregat keberadaan dokumen klaim (READ-ONLY, lintas-DB).
 * Dokumen dideteksi via kunci masing-masing:
 *   triase/resume → `medicalrecord.*` per NOPEN (STATUS=1)
 *   SPRI          → `medicalrecord.perencanaan_rawat_inap.PENDAFTARAN_RI_NOMOR`
 *   CPPT          → `medicalrecord.cppt.KUNJUNGAN` (join ke leg kunjungan NOPEN)
 *   diagnosa      → penanda kelengkapan rekam medis
 * SEP & Bukti Pelayanan TIDAK dideteksi di sini (belum ada pemetaan andal).
 */
export async function queryBerkasDetail(nopen: string): Promise<BerkasDetailRow | null> {
  const sql = `
    SELECT pp.NOMOR AS NOPEN,
           ps.NORM, ps.NAMA, ps.JENIS_KELAMIN, ps.TANGGAL_LAHIR,
           (SELECT COUNT(*) FROM ${SIMGOS_DB.MEDICALRECORD}.triage t
              WHERE t.NOPEN = pp.NOMOR AND t.STATUS = 1) AS TRIAGE_N,
           (SELECT COUNT(*) FROM ${SIMGOS_DB.MEDICALRECORD}.resume rs
              WHERE rs.NOPEN = pp.NOMOR AND rs.STATUS = 1) AS RESUME_N,
           (SELECT COUNT(*) FROM ${SIMGOS_DB.MEDICALRECORD}.perencanaan_rawat_inap s
              WHERE s.PENDAFTARAN_RI_NOMOR = pp.NOMOR) AS SPRI_N,
           (SELECT COUNT(*) FROM ${SIMGOS_DB.MEDICALRECORD}.cppt c
              JOIN ${SIMGOS_DB.PENDAFTARAN}.kunjungan kk ON kk.NOMOR = c.KUNJUNGAN
              WHERE kk.NOPEN = pp.NOMOR AND c.STATUS = 1) AS CPPT_N,
           (SELECT COUNT(*) FROM ${SIMGOS_DB.MEDICALRECORD}.diagnosa d
              WHERE d.NOPEN = pp.NOMOR AND d.STATUS = 1) AS DIAGNOSA_N
    FROM ${SIMGOS_DB.PENDAFTARAN}.pendaftaran pp
    JOIN ${SIMGOS_DB.MASTER}.pasien ps ON ps.NORM = pp.NORM
    WHERE pp.NOMOR = ? AND pp.STATUS = 1
    LIMIT 1`;

  const rows = await getSimgos().$queryRawUnsafe<BerkasDetailRow[]>(sql, nopen);
  return rows[0] ?? null;
}

/** Baris nomor SEP. */
type SepRow = { noSEP: string | null };

/**
 * Nomor SEP BPJS untuk satu episode (NOPEN), READ-ONLY.
 *
 * SIMGOS tidak menyimpan tautan langsung NOPEN→SEP (kolom `bpjs.kunjungan.noTrans`
 * kosong total). Sumber SEP yang otoritatif adalah **`bpjs.kunjungan`**, ber-kunci
 * (`noKartu`, `noSEP`). Sesuai arahan: ambil `noSEP` dari `bpjs.kunjungan` memakai
 * dua parameter — **noKartu** pasien + **tglSEP** ≈ tanggal episode.
 *
 * Rantai NOPEN → noKartu (semua READ-ONLY, lintas-DB):
 *   pendaftaran.pendaftaran.NORM
 *   → master.kartu_identitas_pasien.NOMOR (JENIS=1 = NIK)
 *   → bpjs.peserta.nik → bpjs.peserta.noKartu
 * Lalu `bpjs.kunjungan` disaring pada `tglSEP` di sekitar tanggal daftar episode.
 *
 * **Filter jenis pelayanan (mencegah SEP RI menempel ke episode non-RI):** SEP
 * BPJS `jenisPelayanan` 1=Rawat Inap, 2=Rawat Jalan. Kategori episode dilihat dari
 * ada-tidaknya leg Rawat Inap (`master.ruangan.JENIS_KUNJUNGAN=3`) pada NOPEN:
 *   ada leg RI → hanya terima SEP jP=1; selain itu → hanya terima SEP jP=2.
 * Terbukti (30h): coverage RI utuh (174/174), dan 175 salah-tempel SEP RI di
 * episode non-RI terbuang. Bila tetap >1, diambil tglSEP terdekat.
 * Mengembalikan `null` bila tak ada (pasien umum / SEP belum terbit / NIK kosong).
 */
export async function querySepByNopen(nopen: string): Promise<string | null> {
  const sql = `
    SELECT bk.noSEP AS noSEP
    FROM ${SIMGOS_DB.PENDAFTARAN}.pendaftaran pp
    JOIN ${SIMGOS_DB.MASTER}.kartu_identitas_pasien ki
      ON ki.NORM = pp.NORM AND ki.JENIS = 1
    JOIN ${SIMGOS_DB.BPJS}.peserta pes ON pes.nik = ki.NOMOR
    JOIN ${SIMGOS_DB.BPJS}.kunjungan bk
      ON bk.noKartu = pes.noKartu AND bk.status = 1
    WHERE pp.NOMOR = ?
      AND bk.tglSEP IS NOT NULL
      AND DATE(bk.tglSEP) BETWEEN DATE_SUB(DATE(pp.TANGGAL), INTERVAL 1 DAY)
                              AND DATE_ADD(DATE(pp.TANGGAL), INTERVAL 3 DAY)
      AND bk.jenisPelayanan = (
            CASE WHEN EXISTS (
              SELECT 1 FROM ${SIMGOS_DB.PENDAFTARAN}.kunjungan k
              JOIN ${SIMGOS_DB.MASTER}.ruangan r ON r.ID = k.RUANGAN
              WHERE k.NOPEN = pp.NOMOR AND k.STATUS <> 0 AND r.JENIS_KUNJUNGAN = 3
            ) THEN 1 ELSE 2 END)
    ORDER BY ABS(DATEDIFF(bk.tglSEP, pp.TANGGAL)) ASC, bk.tglSEP DESC
    LIMIT 1`;

  const rows = await getSimgos().$queryRawUnsafe<SepRow[]>(sql, nopen);
  const sep = rows[0]?.noSEP?.trim();
  return sep ? sep : null;
}

/** Baris nomor kunjungan. */
type KunjunganRow = { KUNJUNGAN: string | null };

/**
 * KUNJUNGAN (leg) yang memuat CPPT untuk satu NOPEN — dipakai sebagai parameter
 * cetak "Catatan Medik" (payload butuh `PKUNJUNGAN`, bukan hanya `PNOPEN`).
 * READ-ONLY. CPPT (`medicalrecord.cppt`) ber-kunci **KUNJUNGAN** (bukan NOPEN),
 * jadi dipilih leg klinis utama (Rawat Inap > IGD > Rawat Jalan) yang PUNYA CPPT,
 * dengan jumlah catatan terbanyak. Mengembalikan `null` bila tak ada leg ber-CPPT.
 */
export async function queryCpptKunjunganByNopen(nopen: string): Promise<string | null> {
  const sql = `
    SELECT k.NOMOR AS KUNJUNGAN
    FROM ${SIMGOS_DB.PENDAFTARAN}.kunjungan k
    JOIN ${SIMGOS_DB.MASTER}.ruangan r ON r.ID = k.RUANGAN
    WHERE k.NOPEN = ? AND k.STATUS <> 0
      AND EXISTS (
        SELECT 1 FROM ${SIMGOS_DB.MEDICALRECORD}.cppt c
        WHERE c.KUNJUNGAN = k.NOMOR AND c.STATUS = 1)
    ORDER BY (r.JENIS_KUNJUNGAN = 3) DESC,
             (r.JENIS_KUNJUNGAN = 2) DESC,
             (r.JENIS_KUNJUNGAN = 1) DESC,
             (SELECT COUNT(*) FROM ${SIMGOS_DB.MEDICALRECORD}.cppt c
              WHERE c.KUNJUNGAN = k.NOMOR AND c.STATUS = 1) DESC,
             k.MASUK ASC
    LIMIT 1`;

  const rows = await getSimgos().$queryRawUnsafe<KunjunganRow[]>(sql, nopen);
  const k = rows[0]?.KUNJUNGAN?.trim();
  return k ? k : null;
}

/** Baris tindakan medis (untuk prefill Bukti Pelayanan). */
export type TindakanRow = {
  TANGGAL: Date | string | null;
  NAMA: string | null;
  RUANG: string | null;
};

/**
 * Tindakan medis pada satu episode (NOPEN), ditarik dari `layanan.tindakan_medis`
 * (join ke leg kunjungan & `master.tindakan` untuk nama). READ-ONLY — hanya untuk
 * prefill; hasil isian disimpan di DB reporthub, bukan di sini.
 */
export async function queryTindakanByNopen(nopen: string): Promise<TindakanRow[]> {
  const sql = `
    SELECT tm.TANGGAL,
           mt.NAMA      AS NAMA,
           r.DESKRIPSI  AS RUANG
    FROM ${SIMGOS_DB.LAYANAN}.tindakan_medis tm
    JOIN ${SIMGOS_DB.PENDAFTARAN}.kunjungan k ON k.NOMOR = tm.KUNJUNGAN
    LEFT JOIN ${SIMGOS_DB.MASTER}.ruangan r   ON r.ID = k.RUANGAN
    LEFT JOIN ${SIMGOS_DB.MASTER}.tindakan mt ON mt.ID = tm.TINDAKAN
    WHERE k.NOPEN = ? AND tm.STATUS = 1
    ORDER BY tm.TANGGAL ASC
    LIMIT 200`;

  return getSimgos().$queryRawUnsafe<TindakanRow[]>(sql, nopen);
}

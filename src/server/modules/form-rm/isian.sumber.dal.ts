import "server-only";
import { getSimgos } from "@/server/db/simgos.client";
import { SIMGOS_DB } from "@/server/db/simgos-databases";

/**
 * QUERY SUMBER ISI OTOMATIS Form RM (PRD §8.3) — SIMGOS READ-ONLY: hanya SELECT
 * berparameter, berkunci kolom terindeks (NORM / NOPEN / KUNJUNGAN), dibatasi
 * `MAX_EXECUTION_TIME`. Satu sumber = satu query; hasil boleh null/kosong.
 * Waktu dikembalikan sebagai string jam dinding (bebas pergeseran zona adapter).
 */

const CAP = "/*+ MAX_EXECUTION_TIME(3000) */";
const P = SIMGOS_DB.PENDAFTARAN;
const M = SIMGOS_DB.MASTER;
const MR = SIMGOS_DB.MEDICALRECORD;

type Id = number | string | null;

/** Susun nama lengkap pegawai + gelar (alias `pg`). */
const PEGAWAI_NAMA = `TRIM(CONCAT_WS(' ', NULLIF(pg.GELAR_DEPAN, ''), pg.NAMA, NULLIF(pg.GELAR_BELAKANG, '')))`;

/* ------------------------------------------------------------------ sosial */

/** Data sosial pasien (`master.pasien` + referensi). ID referensi ikut dikembalikan untuk pemetaan pasti. */
export type SosialRow = {
  JENIS_KELAMIN: Id;
  ALAMAT: string | null;
  RT: string | null;
  RW: string | null;
  AGAMA: Id;
  PENDIDIKAN: Id;
  PENDIDIKAN_DESK: string | null;
  PEKERJAAN: Id;
  PERKAWINAN: Id;
  GOL_DARAH: string | null;
  NEGARA: string | null;
  /** Bahasa pasien (referensi JENIS 177) sebagai "id=deskripsi|…" — mis. "1=Tidak Ada|71=Indonesian". */
  BAHASA: string | null;
  /** Nomor seluler / WA pertama (`master.kontak_pasien` JENIS 3 / 9). */
  TELP: string | null;
};

export async function querySosial(norm: string): Promise<SosialRow | null> {
  const sql = `
    SELECT ${CAP} ps.JENIS_KELAMIN, ps.ALAMAT, ps.RT, ps.RW, ps.AGAMA, ps.PENDIDIKAN,
      (SELECT r.DESKRIPSI FROM ${M}.referensi r WHERE r.JENIS = 3 AND r.ID = ps.PENDIDIKAN LIMIT 1) AS PENDIDIKAN_DESK,
      ps.PEKERJAAN, ps.STATUS_PERKAWINAN AS PERKAWINAN,
      (SELECT r.DESKRIPSI FROM ${M}.referensi r WHERE r.JENIS = 6 AND r.ID = ps.GOLONGAN_DARAH LIMIT 1) AS GOL_DARAH,
      (SELECT n.DESKRIPSI FROM ${M}.negara n WHERE n.ID = ps.KEWARGANEGARAAN LIMIT 1) AS NEGARA,
      (SELECT GROUP_CONCAT(CONCAT(r.ID, '=', r.DESKRIPSI) ORDER BY r.ID SEPARATOR '|') FROM ${M}.referensi r
         WHERE r.JENIS = 177 AND FIND_IN_SET(r.ID, REPLACE(ps.BAHASA, ' ', ''))) AS BAHASA,
      (SELECT kp.NOMOR FROM ${M}.kontak_pasien kp WHERE kp.NORM = ps.NORM AND kp.JENIS IN (3, 9)
         ORDER BY kp.JENIS, kp.NOMOR LIMIT 1) AS TELP
    FROM ${M}.pasien ps
    WHERE ps.NORM = ?
    LIMIT 1`;
  const rows = await getSimgos().$queryRawUnsafe<SosialRow[]>(sql, Number(norm));
  return rows[0] ?? null;
}

/* ---------------------------------------------------------------- keluarga */

/** Anggota keluarga pasien (`master.keluarga_pasien`); SHDK = referensi JENIS 7. */
export type KeluargaRow = {
  SHDK: Id;
  JENIS_KELAMIN: Id;
  NAMA: string | null;
  ALAMAT: string | null;
  PEKERJAAN: string | null;
  /** Nomor seluler / WA keluarga dengan SHDK sama (`master.kontak_keluarga_pasien`). */
  TELP: string | null;
};

export async function queryKeluarga(norm: string): Promise<KeluargaRow[]> {
  const sql = `
    SELECT ${CAP} kp.SHDK, kp.JENIS_KELAMIN, kp.NAMA, kp.ALAMAT,
      (SELECT r.DESKRIPSI FROM ${M}.referensi r WHERE r.JENIS = 4 AND r.ID = kp.PEKERJAAN LIMIT 1) AS PEKERJAAN,
      (SELECT kk.NOMOR FROM ${M}.kontak_keluarga_pasien kk WHERE kk.NORM = kp.NORM AND kk.SHDK = kp.SHDK AND kk.JENIS IN (3, 9)
         ORDER BY kk.JENIS, kk.NOMOR LIMIT 1) AS TELP
    FROM ${M}.keluarga_pasien kp
    WHERE kp.NORM = ?
    ORDER BY kp.SHDK, kp.JENIS_KELAMIN, kp.NOMOR, kp.ID
    LIMIT 20`;
  return getSimgos().$queryRawUnsafe<KeluargaRow[]>(sql, Number(norm));
}

/* ----------------------------------------------------------------- episode */

/** Ringkasan episode (pendaftaran + leg kunjungan). Leg rawat inap diprioritaskan. */
export type EpisodeRow = {
  /** "YYYY-MM-DDTHH:mm" jam dinding. */
  MASUK: string | null;
  KELUAR: string | null;
  RUANG: string | null;
  DPJP: string | null;
  PENJAMIN_JENIS: Id;
  DIRAWAT_KE: Id;
  /** Kelas kamar leg rawat inap (referensi JENIS 19). */
  KELAS: Id;
  /** 1 bila episode punya leg IGD / rawat jalan (bukan rawat inap saja). */
  ADA_IGD_RJ: Id;
  /** Jenis PPK surat rujukan pendaftaran (`master.ppk.JENIS`). */
  PPK_JENIS: Id;
  /** 1 bila tanpa perujuk (PPK 0) atau perujuknya rumah sakit ini sendiri. */
  PPK_SENDIRI: Id;
  DIAGNOSA_MASUK: string | null;
};

export async function queryEpisode(nopen: string): Promise<EpisodeRow | null> {
  const legAktif = `k.NOPEN = pp.NOMOR AND k.STATUS <> 0`;
  const sql = `
    SELECT ${CAP}
      (SELECT DATE_FORMAT(k.MASUK, '%Y-%m-%dT%H:%i') FROM ${P}.kunjungan k JOIN ${M}.ruangan r ON r.ID = k.RUANGAN
         WHERE ${legAktif} ORDER BY (r.JENIS_KUNJUNGAN = 3) DESC, k.MASUK ASC LIMIT 1) AS MASUK,
      (SELECT DATE_FORMAT(MAX(k.KELUAR), '%Y-%m-%dT%H:%i') FROM ${P}.kunjungan k WHERE ${legAktif}) AS KELUAR,
      (SELECT r.DESKRIPSI FROM ${P}.kunjungan k JOIN ${M}.ruangan r ON r.ID = k.RUANGAN
         WHERE ${legAktif} ORDER BY (r.JENIS_KUNJUNGAN = 3) DESC, (r.JENIS_KUNJUNGAN = 2) DESC, k.MASUK ASC LIMIT 1) AS RUANG,
      (SELECT ${PEGAWAI_NAMA} FROM ${P}.kunjungan k JOIN ${M}.ruangan r ON r.ID = k.RUANGAN
         JOIN ${M}.dokter dk ON dk.ID = k.DPJP JOIN ${M}.pegawai pg ON pg.NIP = dk.NIP
         WHERE ${legAktif} AND k.DPJP IS NOT NULL AND k.DPJP <> 0
         ORDER BY (r.JENIS_KUNJUNGAN = 3) DESC, (r.JENIS_KUNJUNGAN = 2) DESC, k.MASUK ASC LIMIT 1) AS DPJP,
      (SELECT pj.JENIS FROM ${P}.penjamin pj WHERE pj.NOPEN = pp.NOMOR ORDER BY pj.ID DESC LIMIT 1) AS PENJAMIN_JENIS,
      (SELECT COUNT(DISTINCT pp2.NOMOR) FROM ${P}.pendaftaran pp2
         WHERE pp2.NORM = pp.NORM AND pp2.STATUS = 1 AND pp2.TANGGAL <= pp.TANGGAL
           AND EXISTS (SELECT 1 FROM ${P}.kunjungan k2 JOIN ${M}.ruangan r2 ON r2.ID = k2.RUANGAN
                        WHERE k2.NOPEN = pp2.NOMOR AND k2.STATUS <> 0 AND r2.JENIS_KUNJUNGAN = 3)) AS DIRAWAT_KE,
      (SELECT rk.KELAS FROM ${P}.kunjungan k JOIN ${M}.ruangan r ON r.ID = k.RUANGAN
         JOIN ${M}.ruang_kamar_tidur rkt ON rkt.ID = k.RUANG_KAMAR_TIDUR JOIN ${M}.ruang_kamar rk ON rk.ID = rkt.RUANG_KAMAR
         WHERE ${legAktif} AND r.JENIS_KUNJUNGAN = 3 ORDER BY k.MASUK ASC LIMIT 1) AS KELAS,
      EXISTS (SELECT 1 FROM ${P}.kunjungan k JOIN ${M}.ruangan r ON r.ID = k.RUANGAN
         WHERE ${legAktif} AND r.JENIS_KUNJUNGAN IN (1, 2)) AS ADA_IGD_RJ,
      ppk.JENIS AS PPK_JENIS,
      (sr.PPK = 0 OR sr.PPK = (SELECT i.PPK FROM ${SIMGOS_DB.APLIKASI}.instansi i LIMIT 1)) AS PPK_SENDIRI,
      (SELECT COALESCE(NULLIF(NULLIF(TRIM(dm.DIAGNOSA), ''), '0'), NULLIF(TRIM(dm.ICD), ''))
         FROM ${M}.diagnosa_masuk dm WHERE dm.ID = pp.DIAGNOSA_MASUK LIMIT 1) AS DIAGNOSA_MASUK
    FROM ${P}.pendaftaran pp
    LEFT JOIN ${P}.surat_rujukan_pasien sr ON sr.ID = pp.RUJUKAN
    LEFT JOIN ${M}.ppk ppk ON ppk.ID = sr.PPK
    WHERE pp.NOMOR = ? AND pp.STATUS = 1
    LIMIT 1`;
  const rows = await getSimgos().$queryRawUnsafe<EpisodeRow[]>(sql, nopen);
  return rows[0] ?? null;
}

/* ------------------------------------------------------------------ pulang */

/** Cara (referensi 45) & keadaan (referensi 46) keluar episode (`layanan.pasien_pulang`). */
export type PulangRow = { CARA: Id; KEADAAN: Id };

export async function queryPulang(nopen: string): Promise<PulangRow | null> {
  const sql = `
    SELECT ${CAP} p.CARA, p.KEADAAN
    FROM ${SIMGOS_DB.LAYANAN}.pasien_pulang p
    WHERE p.NOPEN = ? AND p.STATUS <> 0
    ORDER BY p.TANGGAL DESC, p.ID DESC
    LIMIT 1`;
  const rows = await getSimgos().$queryRawUnsafe<PulangRow[]>(sql, nopen);
  return rows[0] ?? null;
}

/* ----------------------------------------------------------------- rujukan */

/** Rujukan keluar terbaru episode (`pendaftaran.rujukan_keluar`; tujuan = `master.ppk`, poli = referensi JENIS 70). */
export type RujukanRow = {
  /** "YYYY-MM-DD" tanggal surat rujukan dibuat. */
  TANGGAL: string | null;
  /** "YYYY-MM-DD" rencana kunjungan di faskes tujuan. */
  RENCANA: string | null;
  TUJUAN: string | null;
  POLI: string | null;
  KETERANGAN: string | null;
  /** Dokter perujuk; bila kosong, DPJP kunjungan (leg) tempat rujukan dibuat. */
  DOKTER: string | null;
};

export async function queryRujukan(nopen: string): Promise<RujukanRow | null> {
  const sql = `
    SELECT ${CAP} DATE_FORMAT(rk.TANGGAL, '%Y-%m-%d') AS TANGGAL,
      DATE_FORMAT(rk.RENCANA_KUNJUNGAN_TANGGAL, '%Y-%m-%d') AS RENCANA,
      (SELECT p.NAMA FROM ${M}.ppk p WHERE p.ID = rk.TUJUAN LIMIT 1) AS TUJUAN,
      (SELECT r.DESKRIPSI FROM ${M}.referensi r WHERE r.JENIS = 70 AND r.ID = rk.TUJUAN_RUANGAN LIMIT 1) AS POLI,
      rk.KETERANGAN,
      (SELECT ${PEGAWAI_NAMA} FROM ${M}.dokter dk JOIN ${M}.pegawai pg ON pg.NIP = dk.NIP
         WHERE dk.ID = COALESCE(NULLIF(rk.DOKTER, 0), k.DPJP) LIMIT 1) AS DOKTER
    FROM ${P}.rujukan_keluar rk
    LEFT JOIN ${P}.kunjungan k ON k.NOMOR = rk.KUNJUNGAN
    WHERE rk.NOPEN = ? AND rk.STATUS <> 0
    ORDER BY rk.TANGGAL DESC, rk.NOMOR DESC
    LIMIT 1`;
  const rows = await getSimgos().$queryRawUnsafe<RujukanRow[]>(sql, nopen);
  return rows[0] ?? null;
}

/* ----------------------------------------------------------------- edukasi */

/** Asesmen edukasi pasien & keluarga terbaru episode (`medicalrecord.edukasi_pasien_keluarga`). Bendera 0/1. */
export type EdukasiRow = {
  KESEDIAAN: Id;
  HAMBATAN: Id;
  HAMBATAN_PENDENGARAN: Id;
  HAMBATAN_PENGLIHATAN: Id;
  HAMBATAN_KOGNITIF: Id;
  HAMBATAN_FISIK: Id;
  HAMBATAN_BUDAYA: Id;
  HAMBATAN_EMOSI: Id;
  HAMBATAN_BAHASA: Id;
  HAMBATAN_LAINNYA: string | null;
  PENERJEMAH: Id;
  EDUKASI_DIAGNOSA: Id;
  EDUKASI_PENYAKIT: Id;
  EDUKASI_REHAB_MEDIK: Id;
  EDUKASI_HKP: Id;
  EDUKASI_OBAT: Id;
  EDUKASI_NYERI: Id;
  EDUKASI_NUTRISI: Id;
  EDUKASI_PENGGUNAAN_ALAT: Id;
  EDUKASI_PROSEDURE_PENUNJANG: Id;
  EDUKASI_PEMBERIAN_INFORMED_CONSENT: Id;
  EDUKASI_CUCI_TANGAN: Id;
};

export async function queryEdukasi(nopen: string): Promise<EdukasiRow | null> {
  const sql = `
    SELECT ${CAP} e.KESEDIAAN, e.HAMBATAN, e.HAMBATAN_PENDENGARAN, e.HAMBATAN_PENGLIHATAN, e.HAMBATAN_KOGNITIF,
      e.HAMBATAN_FISIK, e.HAMBATAN_BUDAYA, e.HAMBATAN_EMOSI, e.HAMBATAN_BAHASA, e.HAMBATAN_LAINNYA, e.PENERJEMAH,
      e.EDUKASI_DIAGNOSA, e.EDUKASI_PENYAKIT, e.EDUKASI_REHAB_MEDIK, e.EDUKASI_HKP, e.EDUKASI_OBAT, e.EDUKASI_NYERI,
      e.EDUKASI_NUTRISI, e.EDUKASI_PENGGUNAAN_ALAT, e.EDUKASI_PROSEDURE_PENUNJANG,
      e.EDUKASI_PEMBERIAN_INFORMED_CONSENT, e.EDUKASI_CUCI_TANGAN
    FROM ${MR}.edukasi_pasien_keluarga e
    JOIN ${P}.kunjungan k ON k.NOMOR = e.KUNJUNGAN
    WHERE k.NOPEN = ? AND e.STATUS <> 0
    ORDER BY e.TANGGAL DESC, e.ID DESC
    LIMIT 1`;
  const rows = await getSimgos().$queryRawUnsafe<EdukasiRow[]>(sql, nopen);
  return rows[0] ?? null;
}

/* ------------------------------------------------------------------ morse */

/** Pengkajian risiko jatuh Morse PERTAMA episode (kode referensi JENIS 186–191; 0 = tak diisi). */
export type MorseRow = {
  /** "YYYY-MM-DDTHH:mm" jam dinding. */
  WAKTU: string | null;
  RIWAYAT_JATUH: Id;
  DIAGNOSIS: Id;
  ALAT_BANTU: Id;
  HEPARIN: Id;
  GAYA_BERJALAN: Id;
  KESADARAN: Id;
  /** Nama pengguna SIMGOS penginput (hanya kolom NAMA). */
  PETUGAS: string | null;
};

export async function queryMorse(nopen: string): Promise<MorseRow | null> {
  const sql = `
    SELECT ${CAP} DATE_FORMAT(m.TANGGAL, '%Y-%m-%dT%H:%i') AS WAKTU,
      m.RIWAYAT_JATUH, m.DIAGNOSIS, m.ALAT_BANTU, m.HEPARIN, m.GAYA_BERJALAN, m.KESADARAN,
      (SELECT u.NAMA FROM ${SIMGOS_DB.APLIKASI}.pengguna u WHERE u.ID = m.OLEH LIMIT 1) AS PETUGAS
    FROM ${MR}.penilaian_skala_morse m
    JOIN ${P}.kunjungan k ON k.NOMOR = m.KUNJUNGAN
    WHERE k.NOPEN = ? AND m.STATUS <> 0
    ORDER BY m.TANGGAL ASC, m.ID ASC
    LIMIT 1`;
  const rows = await getSimgos().$queryRawUnsafe<MorseRow[]>(sql, nopen);
  return rows[0] ?? null;
}

/* -------------------------------------------------------- episode IGD asal */

/** Episode IGD asal pasien rawat inap: lewat SPRI, atau (cadangan) pendaftaran IGD ≤ 24 jam sebelumnya. */
export type IgdAsalRow = { NOPEN_SPRI: string | null; NOPEN_WAKTU: string | null };

/**
 * Hanya untuk episode RAWAT INAP tanpa leg IGD (SIMGOS membuat NOPEN baru saat
 * pasien IGD dirawat inap). Utama: SPRI (`perencanaan_rawat_inap`) yang
 * dipakai pendaftaran RI ini → kunjungan IGD pembuatnya. Cadangan (pola fungsi
 * SIMGOS `getNopenIRD`): pendaftaran IGD pasien yang sama ≤ 24 jam sebelumnya.
 */
export async function queryIgdAsal(nopen: string): Promise<IgdAsalRow | null> {
  const sql = `
    SELECT ${CAP}
      (SELECT k.NOPEN FROM ${MR}.perencanaan_rawat_inap s
         JOIN ${P}.kunjungan k ON k.NOMOR = s.KUNJUNGAN
         JOIN ${M}.ruangan r ON r.ID = k.RUANGAN
         JOIN ${P}.pendaftaran p2 ON p2.NOMOR = k.NOPEN
         WHERE s.PENDAFTARAN_RI_NOMOR = pp.NOMOR AND s.STATUS <> 0 AND k.STATUS <> 0
           AND r.JENIS_KUNJUNGAN = 2 AND p2.STATUS = 1 AND p2.NORM = pp.NORM
         ORDER BY s.ID DESC LIMIT 1) AS NOPEN_SPRI,
      (SELECT p2.NOMOR FROM ${P}.pendaftaran p2
         WHERE p2.NORM = pp.NORM AND p2.STATUS = 1 AND p2.NOMOR <> pp.NOMOR
           AND p2.TANGGAL < pp.TANGGAL AND p2.TANGGAL >= pp.TANGGAL - INTERVAL 24 HOUR
           AND EXISTS (SELECT 1 FROM ${P}.kunjungan k2 JOIN ${M}.ruangan r2 ON r2.ID = k2.RUANGAN
                        WHERE k2.NOPEN = p2.NOMOR AND k2.STATUS <> 0 AND r2.JENIS_KUNJUNGAN = 2)
         ORDER BY p2.TANGGAL DESC LIMIT 1) AS NOPEN_WAKTU
    FROM ${P}.pendaftaran pp
    WHERE pp.NOMOR = ? AND pp.STATUS = 1
      AND EXISTS (SELECT 1 FROM ${P}.kunjungan k JOIN ${M}.ruangan r ON r.ID = k.RUANGAN
                   WHERE k.NOPEN = pp.NOMOR AND k.STATUS <> 0 AND r.JENIS_KUNJUNGAN = 3)
      AND NOT EXISTS (SELECT 1 FROM ${P}.kunjungan k JOIN ${M}.ruangan r ON r.ID = k.RUANGAN
                       WHERE k.NOPEN = pp.NOMOR AND k.STATUS <> 0 AND r.JENIS_KUNJUNGAN = 2)
    LIMIT 1`;
  const rows = await getSimgos().$queryRawUnsafe<IgdAsalRow[]>(sql, nopen);
  return rows[0] ?? null;
}

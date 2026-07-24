/**
 * Daftar database SIMGOS yang kita AKSES (semua READ-ONLY — HIGH ALERT).
 *
 * SIMGOS memisah domain ke banyak database dalam satu server MySQL. Kita
 * memakai SATU koneksi read-only (anchor di salah satu DB) dan query lintas-DB
 * dengan nama ter-kualifikasi `db.tabel` / `db.sp()`. Konstanta di sini menjadi
 * satu-satunya sumber nama database agar tidak ada typo tersebar di banyak DAL.
 *
 * ⚠️ Semua DB di sini HANYA dibaca. User MySQL wajib punya `GRANT SELECT, EXECUTE`
 *    di setiap database ini — tanpa DDL/DML apa pun.
 */
export const SIMGOS_DB = {
  /** Rekam medis: anamnesis, diagnosis, resume (SP CetakMR2), dll. */
  MEDICALRECORD: "medicalrecord",
  /** Pendaftaran & kunjungan pasien (sering jadi anchor koneksi). */
  PENDAFTARAN: "pendaftaran",
  /** Layanan/tindakan medis. */
  LAYANAN: "layanan",
  /** Data/agregat report bawaan SIMGOS. */
  REPORT: "report",
} as const;

export type SimgosDb = (typeof SIMGOS_DB)[keyof typeof SIMGOS_DB];

/**
 * Susun nama objek ter-kualifikasi database untuk dipakai di raw SQL / CALL,
 * mis. `qualify(SIMGOS_DB.MEDICALRECORD, "CetakMR2")` → "medicalrecord.CetakMR2".
 * Nama SELALU berasal dari konstanta/registry (bukan input user).
 */
export function qualify(db: SimgosDb, object: string): string {
  return `${db}.${object}`;
}

/**
 * Sumber diagnosa untuk laporan morbiditas (RL 4.1, RL 5.1, …), dipilih PER
 * KUNJUNGAN (NOPEN):
 *
 *  - diagnosa **klinis** (`medicalrecord.diagnosa.INA_GROUPER = 0`) bila
 *    kunjungan punya minimal satu baris klinis yang berkode;
 *  - selain itu diagnosa **grouper INA-CBG** (`INA_GROUPER = 1`).
 *
 * Latar (dianalisis 12 Nov 2026, read-only): sampai April 2026 setiap kunjungan
 * punya baris klinis, sehingga SP SIMGOS & port lama cukup membaca
 * `INA_GROUPER = 0`. Sejak 10 Mei 2026 mayoritas kunjungan hanya punya baris
 * grouper (Okt 2026: 222 dari 279 kunjungan RJ/IGD) → laporan kurang hitung.
 * Kunjungan yang punya keduanya hampir selalu berkode sama (1018/1028), jadi
 * memilih satu sumber per kunjungan tidak menggandakan kasus.
 *
 * Hanya nama tabel/alias tetap dari kode yang di-inline (divalidasi) — tanpa
 * input pengguna → aman injeksi.
 */

const IDENT = /^[A-Za-z_][A-Za-z0-9_]*$/;

function ident(nama: string, peran: string): string {
  if (!IDENT.test(nama)) throw new Error(`diagnosa-sumber: ${peran} tidak sah`);
  return nama;
}

/**
 * Kondisi SQL "baris diagnosa `alias` berasal dari sumber terpilih kunjungannya".
 * Dipakai di klausa JOIN/WHERE bersama `alias.STATUS = 1`.
 *
 * @param alias  alias tabel `medicalrecord.diagnosa` di query pemanggil (mis. `"md"`)
 * @param medDb  nama database medicalrecord (`SIMGOS_DB.MEDICALRECORD`)
 */
export function diagnosaSumberSql(alias: string, medDb: string): string {
  const a = ident(alias, "alias");
  const db = ident(medDb, "database");
  return `(${a}.INA_GROUPER = 0 OR (${a}.INA_GROUPER = 1 AND NOT EXISTS (
            SELECT 1 FROM ${db}.diagnosa dk
            WHERE dk.NOPEN = ${a}.NOPEN AND dk.\`STATUS\` = 1 AND dk.INA_GROUPER = 0
              AND dk.KODE IS NOT NULL AND dk.KODE <> '')))`;
}

/** Catatan sumber diagnosa untuk Excel & PDF. */
export const DIAGNOSA_SUMBER_CATATAN =
  "Diagnosa = diagnosa klinis; bila kunjungan tidak punya diagnosa klinis, dipakai diagnosa grouper INA-CBG";

const angka = new Intl.NumberFormat("id-ID");

/** Catatan sumber + porsi grouper, mis. "… INA-CBG (12 dari 340 kasus)". */
export function catatanSumberDiagnosa(dariGrouper: number, total: number, satuan: string): string {
  if (total <= 0) return DIAGNOSA_SUMBER_CATATAN;
  return `${DIAGNOSA_SUMBER_CATATAN} (${angka.format(dariGrouper)} dari ${angka.format(total)} ${satuan})`;
}

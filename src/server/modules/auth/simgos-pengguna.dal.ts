import "server-only";
import { getSimgos } from "@/server/db/simgos.client";
import { SIMGOS_DB } from "@/server/db/simgos-databases";

/**
 * Akses READ-ONLY ke `aplikasi.pengguna` (server SIMGOS) untuk login via akun
 * SIMGOS. PASSWORD tersimpan sebagai bcrypt (`$2y$…`) → cocok diverifikasi
 * `bcryptjs.compare`. `LOGIN` tidak dijamin unik (indeks non-unik) → verifikasi
 * mencocokkan ke SEMUA baris aktif untuk satu LOGIN. HIGH ALERT: hanya SELECT.
 */

/** Baris pengguna SIMGOS (kolom yang kita butuh). */
export type SimgosPenggunaRow = {
  ID: number | string;
  LOGIN: string;
  PASSWORD: string;
  NAMA: string;
  NIP: string | null;
  NIK: string | null;
};

/** Baris pengguna SIMGOS AKTIF untuk satu LOGIN (bisa >1). READ-ONLY. */
export async function querySimgosPenggunaByLogin(login: string): Promise<SimgosPenggunaRow[]> {
  const sql = `
    SELECT ID, LOGIN, PASSWORD, NAMA, NIP, NIK
    FROM ${SIMGOS_DB.APLIKASI}.pengguna
    WHERE LOGIN = ? AND STATUS = 1`;
  return getSimgos().$queryRawUnsafe<SimgosPenggunaRow[]>(sql, login);
}

/** Hasil pencarian akun SIMGOS (untuk combobox penetapan pengguna). */
export type SimgosPenggunaHit = { login: string; nama: string; nip: string; nik: string };

/**
 * Cari akun SIMGOS AKTIF (min 2 huruf) berdasarkan LOGIN / NAMA / NIP untuk
 * combobox provisioning. Dedup per LOGIN. READ-ONLY.
 */
export async function searchSimgosPengguna(term: string): Promise<SimgosPenggunaHit[]> {
  const q = (term ?? "").trim();
  if (q.length < 2) return [];
  const like = `%${q}%`;
  const sql = `
    SELECT MIN(ID) AS ID, LOGIN, MAX(NAMA) AS NAMA, MAX(NIP) AS NIP, MAX(NIK) AS NIK
    FROM ${SIMGOS_DB.APLIKASI}.pengguna
    WHERE STATUS = 1 AND (LOGIN LIKE ? OR NAMA LIKE ? OR NIP LIKE ?)
    GROUP BY LOGIN
    ORDER BY NAMA ASC
    LIMIT 20`;
  const rows = await getSimgos().$queryRawUnsafe<SimgosPenggunaRow[]>(sql, like, like, like);
  return rows
    .map((r) => ({
      login: r.LOGIN?.trim() ?? "",
      nama: r.NAMA?.trim() ?? "",
      nip: r.NIP?.trim() ?? "",
      nik: r.NIK?.trim() ?? "",
    }))
    .filter((r) => r.login);
}

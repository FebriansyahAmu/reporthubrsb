import "server-only";
import mariadb from "mariadb";
import { env, requireSimgosUrl } from "@/server/lib/env";
import { SIMGOS_SP, type SpKey } from "./sp-registry";

/**
 * Eksekusi stored procedure SIMGOS **READ-ONLY** via driver `mariadb` langsung —
 * BUKAN lewat Prisma. Alasan: adapter `@prisma/adapter-mariadb` tidak menangani
 * `CALL` yang menghasilkan >1 result set (SP selalu mengembalikan result set
 * SELECT + paket OK), sehingga `$queryRawUnsafe` memetakan bentuk `[[rows], okPacket]`
 * secara keliru → semua kolom hilang. Driver mariadb mengembalikan hasilnya benar,
 * jadi CALL dijalankan lewat pool tersendiri (kredensial SIMGOS yang sama).
 *
 * READ-ONLY (HIGH ALERT): hanya SP di whitelist `SIMGOS_SP` yang boleh dipanggil,
 * nama SP TIDAK PERNAH dari input user, dan semua NILAI parameter di-bind lewat `?`.
 */

/** Tipe kolom tanggal/waktu MariaDB → kembalikan STRING mentah server (tanpa
 *  interpretasi timezone) agar tidak ada pergeseran hari; `parseIdDate` menangani
 *  format `dd-mm-yyyy` maupun `yyyy-mm-dd`. */
const DATE_TYPES = new Set(["DATE", "DATETIME", "TIMESTAMP", "NEWDATE", "TIME", "YEAR"]);
const typeCast = (col: { type: string; string(): string | null }, next: () => unknown) =>
  DATE_TYPES.has(col.type) ? col.string() : next();

type SpPool = ReturnType<typeof mariadb.createPool>;

const globalForSp = globalThis as unknown as { simgosSpPool?: SpPool };

function getSpPool(): SpPool {
  if (globalForSp.simgosSpPool) return globalForSp.simgosSpPool;
  const u = new URL(requireSimgosUrl());
  const pool = mariadb.createPool({
    host: u.hostname,
    port: u.port ? Number(u.port) : 3306,
    user: decodeURIComponent(u.username),
    password: decodeURIComponent(u.password),
    database: env.SIMGOS_DEFAULT_DB || u.pathname.replace(/^\//, "") || undefined,
    connectionLimit: 3,
    connectTimeout: 8000,
    bigIntAsNumber: true,
    typeCast: typeCast as never,
  });
  globalForSp.simgosSpPool = pool;
  return pool;
}

/** True bila objek adalah paket status (OK packet) MariaDB, bukan baris data. */
function isOkPacket(v: unknown): boolean {
  return (
    typeof v === "object" &&
    v !== null &&
    !Array.isArray(v) &&
    "affectedRows" in v &&
    "warningStatus" in v
  );
}

/**
 * Ambil result set pertama dari hasil CALL. Driver mengembalikan `[[rows], okPacket]`
 * untuk SP satu-SELECT; kadang bentuk datar `[...rows, okPacket]`. Tangani keduanya.
 */
function firstResultSet<T>(res: unknown): T[] {
  if (!Array.isArray(res)) return [];
  if (res.length > 0 && Array.isArray(res[0])) return res[0] as T[];
  return (res as unknown[]).filter((r) => !isOkPacket(r)) as T[];
}

/**
 * Panggil stored procedure SIMGOS read-only dengan parameter ter-bind.
 *
 * @param key    kunci SP di SIMGOS_SP
 * @param params argumen sesuai urutan SIMGOS_SP[key].params
 * @returns baris result set pertama, sudah bertipe T
 */
export async function callProcedure<T = Record<string, unknown>>(
  key: SpKey,
  ...params: unknown[]
): Promise<T[]> {
  const sp = SIMGOS_SP[key];
  if (params.length !== sp.params.length) {
    throw new Error(
      `SP ${key} butuh ${sp.params.length} parameter (${sp.params.join(", ")}), diberi ${params.length}.`,
    );
  }
  const placeholders = sp.params.map(() => "?").join(", ");
  const sql = `CALL ${sp.name}(${placeholders})`;

  const conn = await getSpPool().getConnection();
  try {
    const res = await conn.query(sql, params);
    return firstResultSet<T>(res);
  } finally {
    conn.release();
  }
}

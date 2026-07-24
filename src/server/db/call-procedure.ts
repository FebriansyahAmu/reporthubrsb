import "server-only";
import { getSimgos } from "./simgos.client";
import { SIMGOS_SP, type SpKey } from "./sp-registry";

/**
 * Panggil stored procedure SIMGOS read-only dengan parameter ter-bind.
 *
 * Nama SP diambil dari registry (bukan input user) → aman disusun ke string CALL.
 * NILAI parameter selalu di-bind lewat `?`. Prisma mengambil result set pertama.
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
  return getSimgos().$queryRawUnsafe<T[]>(sql, ...params);
}

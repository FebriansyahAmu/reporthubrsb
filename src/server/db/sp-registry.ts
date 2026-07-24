import { SIMGOS_DB, qualify } from "./simgos-databases";

/**
 * Registry stored procedure SIMGOS yang DIIZINKAN dipanggil.
 *
 * Hanya nama di sini yang boleh dieksekusi — nama SP TIDAK PERNAH berasal dari
 * input user. Semua NILAI parameter tetap di-bind lewat `?` (lihat call-procedure.ts),
 * tidak pernah string-concat → aman dari SQL injection.
 *
 * `resultSets: 1` menandai SP dengan satu result set (yang diambil Prisma). Bila
 * suatu SP mengembalikan banyak result set, dokumentasikan & sesuaikan pemanggilan.
 */
export const SIMGOS_SP = {
  /** Resume medis lengkap per pendaftaran. Param: NOPEN (nomor pendaftaran). */
  CETAK_MR2: {
    name: qualify(SIMGOS_DB.MEDICALRECORD, "CetakMR2"),
    params: ["nopen"],
    resultSets: 1,
  },
} as const satisfies Record<
  string,
  { name: string; params: readonly string[]; resultSets: number }
>;

export type SpKey = keyof typeof SIMGOS_SP;

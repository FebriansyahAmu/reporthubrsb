import "server-only";
import { getSimgos } from "@/server/db/simgos.client";
import { SIMGOS_DB } from "@/server/db/simgos-databases";
import type { KandidatAkar } from "./rantai.inti";

/**
 * Kandidat episode IGD asal (akar) episode rawat inap — SIMGOS READ-ONLY,
 * SELECT berparameter. Sumber tunggal aturan asal IGD (dipakai juga isi otomatis
 * `queryIgdAsal`).
 *
 * Hanya episode RI TANPA leg IGD (SIMGOS memberi NOPEN baru saat pasien IGD
 * dirawat inap). Utama: SPRI (`perencanaan_rawat_inap`) yang dipakai pendaftaran
 * RI ini → kunjungan IGD pembuatnya. Cadangan (pola fungsi SIMGOS `getNopenIRD`):
 * pendaftaran IGD pasien yang sama ≤ 24 jam sebelumnya. Keduanya mensyaratkan
 * NORM SAMA dan pendaftaran aktif — pasien lain tak pernah jadi kandidat.
 */

const CAP = "/*+ MAX_EXECUTION_TIME(5000) */";
const P = SIMGOS_DB.PENDAFTARAN;
const M = SIMGOS_DB.MASTER;
const MR = SIMGOS_DB.MEDICALRECORD;
const POTONGAN = 200;

type BarisKandidat = { NOPEN: string; NORM: string | number | bigint; NOPEN_SPRI: string | null; NOPEN_WAKTU: string | null };

export type KandidatEpisode = { norm: string; kandidat: KandidatAkar };

const nopenAtauNull = (v: string | null) => (v == null ? null : String(v).trim() || null);

/**
 * Kandidat akar per NOPEN. NOPEN yang bukan episode RI-tanpa-IGD (atau tak
 * aktif) tidak ada di peta.
 */
export async function queryKandidatAkar(nopens: readonly string[]): Promise<Map<string, KandidatEpisode>> {
  const unik = [...new Set(nopens)];
  const peta = new Map<string, KandidatEpisode>();
  for (let i = 0; i < unik.length; i += POTONGAN) {
    const potong = unik.slice(i, i + POTONGAN);
    const sql = `
      SELECT ${CAP} pp.NOMOR AS NOPEN, pp.NORM,
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
      WHERE pp.NOMOR IN (${potong.map(() => "?").join(", ")}) AND pp.STATUS = 1
        AND EXISTS (SELECT 1 FROM ${P}.kunjungan k JOIN ${M}.ruangan r ON r.ID = k.RUANGAN
                     WHERE k.NOPEN = pp.NOMOR AND k.STATUS <> 0 AND r.JENIS_KUNJUNGAN = 3)
        AND NOT EXISTS (SELECT 1 FROM ${P}.kunjungan k JOIN ${M}.ruangan r ON r.ID = k.RUANGAN
                         WHERE k.NOPEN = pp.NOMOR AND k.STATUS <> 0 AND r.JENIS_KUNJUNGAN = 2)`;
    const rows = await getSimgos().$queryRawUnsafe<BarisKandidat[]>(sql, ...potong);
    for (const r of rows) {
      peta.set(String(r.NOPEN).trim(), {
        norm: String(r.NORM),
        kandidat: { spri: nopenAtauNull(r.NOPEN_SPRI), waktu: nopenAtauNull(r.NOPEN_WAKTU) },
      });
    }
  }
  return peta;
}

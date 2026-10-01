import "server-only";
import { SIMGOS_DB } from "@/server/db/simgos-databases";
import { CAP, FMT, num, query, type Num } from "./verifikasi.dal";

/**
 * DAL Paket Klaim — **READ-ONLY** SIMGOS (HIGH ALERT: hanya SELECT). Sumber
 * parameter komponen report engine untuk SATU episode, dalam SATU query:
 *  - leg ber-CPPT episode ini + leg IGD asal (via SPRI, NOPEN berbeda). Report
 *    CPPT SIMGOS mencetak PER LEG (diuji 1 Okt 2026: leg A 1 hal + leg B 4 hal),
 *    jadi tiap leg menjadi komponen sendiri agar paket tidak diam-diam kurang;
 *  - SPRI terbaru yang menunjuk episode ini (PKUNJUNGAN = leg asal);
 *  - jumlah resume medis (report Resume Medis tetap keluar walau resume kosong).
 * Semua kolom filter terindeks (NOPEN / KUNJUNGAN / PENDAFTARAN_RI_NOMOR).
 */

const PD = SIMGOS_DB.PENDAFTARAN;
const MR = SIMGOS_DB.MEDICALRECORD;
const MS = SIMGOS_DB.MASTER;

export type LegCppt = {
  nopen: string;
  kunjungan: string;
  ruang: string | null;
  /** `master.ruangan.JENIS_KUNJUNGAN` (1 RJ · 2 IGD · 3 RI). */
  jk: number;
  masuk: string | null;
  /** Jumlah catatan CPPT aktif di leg ini. */
  n: number;
  /** Leg IGD asal (NOPEN lain, ditautkan SPRI). */
  asal: boolean;
};

export type FaktaSumberPaket = {
  cppt: LegCppt[];
  spri: { kunjungan: string; nomor: string | null } | null;
  resume: number;
};

type Raw = {
  jenis: string;
  nopen: string | null;
  kunjungan: string | null;
  ruang: string | null;
  jk: Num;
  waktu: string | null;
  ref: string | null;
  n: Num;
};

export async function querySumberPaket(nopen: string): Promise<FaktaSumberPaket> {
  const rows = await query<Raw>(
    `SELECT ${CAP} 'cppt' AS jenis, k.NOPEN AS nopen, k.NOMOR AS kunjungan, r.DESKRIPSI AS ruang,
        r.JENIS_KUNJUNGAN AS jk, DATE_FORMAT(k.MASUK, ${FMT}) AS waktu, NULL AS ref, COUNT(*) AS n
      FROM ${PD}.kunjungan k
      JOIN ${MS}.ruangan r ON r.ID = k.RUANGAN
      JOIN ${MR}.cppt c ON c.KUNJUNGAN = k.NOMOR AND c.STATUS = 1
      WHERE k.NOPEN = ? AND k.STATUS <> 0
      GROUP BY k.NOPEN, k.NOMOR, r.DESKRIPSI, r.JENIS_KUNJUNGAN, k.MASUK
    UNION ALL
    SELECT 'cppt-asal', k.NOPEN, k.NOMOR, r.DESKRIPSI, r.JENIS_KUNJUNGAN, DATE_FORMAT(k.MASUK, ${FMT}), NULL, COUNT(*)
      FROM ${MR}.perencanaan_rawat_inap s
      JOIN ${PD}.kunjungan k ON k.NOMOR = s.KUNJUNGAN AND k.STATUS <> 0 AND k.NOPEN <> s.PENDAFTARAN_RI_NOMOR
      JOIN ${MS}.ruangan r ON r.ID = k.RUANGAN
      JOIN ${MR}.cppt c ON c.KUNJUNGAN = k.NOMOR AND c.STATUS = 1
      WHERE s.PENDAFTARAN_RI_NOMOR = ? AND s.STATUS = 1
      GROUP BY k.NOPEN, k.NOMOR, r.DESKRIPSI, r.JENIS_KUNJUNGAN, k.MASUK
    UNION ALL
    (SELECT 'spri', NULL, s.KUNJUNGAN, NULL, NULL, DATE_FORMAT(s.DIBUAT_TANGGAL, ${FMT}), s.NOMOR_REFERENSI, 1
      FROM ${MR}.perencanaan_rawat_inap s
      WHERE s.PENDAFTARAN_RI_NOMOR = ? AND s.STATUS = 1 AND s.KUNJUNGAN IS NOT NULL AND s.KUNJUNGAN <> ''
      ORDER BY s.DIBUAT_TANGGAL DESC LIMIT 1)
    UNION ALL
    SELECT 'resume', NULL, NULL, NULL, NULL, NULL, NULL, COUNT(*)
      FROM ${MR}.resume WHERE NOPEN = ? AND STATUS = 1`,
    [nopen, nopen, nopen, nopen],
  );

  const cppt: LegCppt[] = [];
  let spri: FaktaSumberPaket["spri"] = null;
  let resume = 0;
  for (const r of rows) {
    if (r.jenis === "cppt" || r.jenis === "cppt-asal") {
      if (!r.kunjungan || !r.nopen) continue;
      cppt.push({
        nopen: String(r.nopen),
        kunjungan: String(r.kunjungan).trim(),
        ruang: r.ruang?.trim() || null,
        jk: num(r.jk),
        masuk: r.waktu,
        n: num(r.n),
        asal: r.jenis === "cppt-asal",
      });
    } else if (r.jenis === "spri" && r.kunjungan) {
      spri = { kunjungan: String(r.kunjungan).trim(), nomor: r.ref?.trim() || null };
    } else if (r.jenis === "resume") {
      resume = num(r.n);
    }
  }
  // Kronologis: leg IGD asal lebih dulu, lalu leg episode ini menurut waktu masuk.
  cppt.sort((a, b) => Number(b.asal) - Number(a.asal) || (a.masuk ?? "").localeCompare(b.masuk ?? "") || a.kunjungan.localeCompare(b.kunjungan));
  return { cppt, spri, resume };
}

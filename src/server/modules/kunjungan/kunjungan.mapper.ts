import { hitungUmur } from "@/lib/format";
import {
  JENIS_KUNJUNGAN_KATEGORI,
  type KunjunganResumeItem,
} from "./kunjungan.types";
import type { KunjunganRow } from "./kunjungan.dal";

/**
 * Ubah nilai datetime dari driver → ISO **lokal tanpa Z**, mis.
 * "2026-07-21T11:10:54", mempertahankan jam dinding RS apa adanya.
 *
 * MySQL DATETIME tak ber-timezone; adapter Prisma mengembalikannya sebagai Date
 * dengan digit jam-dinding ditaruh di field **UTC** (mis. 11:10:54 → Date UTC
 * 11:10:54Z). Karena itu kita baca komponen **getUTC\*** agar tidak bergeser
 * mengikuti timezone server (mis. WITA +8 yang tadinya membuat 11:00 → 19:00).
 */
function toWallClockIso(v: Date | string | null): string | null {
  if (v == null) return null;
  const d = v instanceof Date ? v : new Date(v);
  if (Number.isNaN(d.getTime())) return null;
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())}T${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:${p(d.getUTCSeconds())}`;
}

export function mapKunjungan(row: KunjunganRow): KunjunganResumeItem {
  const lahir = row.TANGGAL_LAHIR
    ? row.TANGGAL_LAHIR instanceof Date
      ? row.TANGGAL_LAHIR
      : new Date(row.TANGGAL_LAHIR)
    : null;
  const jk = Number(row.JENIS_KELAMIN);

  return {
    id: String(row.NOPEN),
    norm: String(row.NORM),
    nama: row.NAMA ?? "—",
    jenisKelamin: jk === 1 ? "Laki-Laki" : jk === 2 ? "Perempuan" : "—",
    umur: hitungUmur(lahir && !Number.isNaN(lahir.getTime()) ? lahir : null),
    kategori: JENIS_KUNJUNGAN_KATEGORI[Number(row.JENIS_KUNJUNGAN)] ?? "Rawat Jalan Klinik",
    ruang: row.RUANG,
    // DPJP & diagnosa awal berupa kode (butuh join referensi) — ditunda.
    dpjp: null,
    diagnosa: null,
    tglMasuk: toWallClockIso(row.MASUK) ?? new Date().toISOString(),
    tglKeluar: toWallClockIso(row.KELUAR),
  };
}

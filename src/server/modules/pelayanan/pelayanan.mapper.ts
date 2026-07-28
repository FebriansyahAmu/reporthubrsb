import { hitungUmur } from "@/lib/format";
import {
  JENIS_KUNJUNGAN_KATEGORI,
} from "@/server/modules/kunjungan/kunjungan.types";
import type { KunjunganPelayananItem } from "./pelayanan.types";
import type { KunjunganPelayananRow } from "./pelayanan.dal";

const pad = (n: number) => String(n).padStart(2, "0");

/** DATETIME adapter → ISO lokal tanpa Z (jam-dinding), baca getUTC*. */
function toWallClockIso(v: Date | string | null): string | null {
  if (v == null) return null;
  const d = v instanceof Date ? v : new Date(v);
  if (Number.isNaN(d.getTime())) return null;
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`;
}

export function mapKunjunganPelayanan(row: KunjunganPelayananRow): KunjunganPelayananItem {
  const lahir = row.TANGGAL_LAHIR
    ? row.TANGGAL_LAHIR instanceof Date
      ? row.TANGGAL_LAHIR
      : new Date(row.TANGGAL_LAHIR)
    : null;
  const jk = Number(row.JENIS_KELAMIN);
  const keluar = toWallClockIso(row.KELUAR);
  const lama = Number(row.LAMA_MENIT);

  return {
    nomor: String(row.NOMOR),
    nopen: String(row.NOPEN),
    norm: String(row.NORM),
    nama: row.NAMA?.trim() || "—",
    jenisKelamin: jk === 1 ? "Laki-Laki" : jk === 2 ? "Perempuan" : "—",
    umur: hitungUmur(lahir && !Number.isNaN(lahir.getTime()) ? lahir : null),
    kategori: JENIS_KUNJUNGAN_KATEGORI[Number(row.JENIS_KUNJUNGAN)] ?? "Rawat Jalan Klinik",
    ruang: row.RUANG,
    ruanganId: String(row.RUANGAN_ID),
    masuk: toWallClockIso(row.MASUK) ?? new Date().toISOString(),
    keluar,
    lamaMenit: Number.isFinite(lama) ? Math.max(0, lama) : 0,
    final: keluar != null,
  };
}

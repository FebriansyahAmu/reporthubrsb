import "server-only";
import { getAppDb } from "@/server/db/app.client";
import type { Kategori, StatusHari, Target } from "./bckh.constants";
import type { HariDto, HariRingkas } from "./bckh.types";

/** Kolom DATE ↔ `YYYY-MM-DD` di UTC (tanpa pergeseran zona waktu server). */
export const keDate = (ymd: string) => new Date(`${ymd}T00:00:00Z`);
export const dariDate = (d: Date) => d.toISOString().slice(0, 10);

const KEGIATAN_URUT = { orderBy: [{ urutan: "asc" as const }, { createdAt: "asc" as const }] };

type BarisHari = {
  tanggal: Date;
  status: string;
  keterangan: string;
  createdAt: Date;
  updatedAt: Date;
  kegiatan: { id: string; uraian: string; kategori: string; target: string }[];
};

export const keHariDto = (h: BarisHari): HariDto => ({
  tanggal: dariDate(h.tanggal),
  status: h.status as StatusHari,
  keterangan: h.keterangan,
  kegiatan: h.kegiatan.map((k) => ({ id: k.id, uraian: k.uraian, kategori: k.kategori as Kategori, target: k.target as Target })),
  dibuat: h.createdAt.toISOString(),
  versi: h.updatedAt.toISOString(),
});

const PILIH_HARI = {
  id: true,
  tanggal: true,
  status: true,
  keterangan: true,
  createdAt: true,
  updatedAt: true,
  kegiatan: { select: { id: true, uraian: true, kategori: true, target: true }, ...KEGIATAN_URUT },
} as const;

/** Satu catatan (atau null). */
export async function bacaHari(userId: string, tanggal: string) {
  return getAppDb().bckhHari.findUnique({
    where: { userId_tanggal: { userId, tanggal: keDate(tanggal) } },
    select: PILIH_HARI,
  });
}

/** Catatan + kegiatan dalam rentang (urut tanggal). */
export async function daftarHari(userId: string, dari: string, sampai: string): Promise<HariDto[]> {
  const rows = await getAppDb().bckhHari.findMany({
    where: { userId, tanggal: { gte: keDate(dari), lte: keDate(sampai) } },
    select: PILIH_HARI,
    orderBy: { tanggal: "asc" },
  });
  return rows.map(keHariDto);
}

/** Bahan aturan murni (laporan/dasbor/profil) dalam rentang. */
export async function hariRingkas(userId: string, dari: string, sampai: string): Promise<HariRingkas[]> {
  return (await daftarHari(userId, dari, sampai)).map((h) => ({
    tanggal: h.tanggal,
    status: h.status,
    keterangan: h.keterangan,
    kegiatan: h.kegiatan.map(({ uraian, kategori, target }) => ({ uraian, kategori, target })),
    dibuat: h.dibuat,
  }));
}

/** Semua tanggal bercatatan seorang pengguna (ringan: satu kolom) — streak & tahun tersedia. */
export async function semuaTanggal(userId: string): Promise<string[]> {
  const rows = await getAppDb().bckhHari.findMany({ where: { userId }, select: { tanggal: true }, orderBy: { tanggal: "asc" } });
  return rows.map((r) => dariDate(r.tanggal));
}

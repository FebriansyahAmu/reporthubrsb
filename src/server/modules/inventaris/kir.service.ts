import "server-only";
import { getAppDb } from "@/server/db/app.client";
import { NotFoundError } from "@/server/lib/errors";
import { isStatusAset, type StatusAset } from "./barang.schema";

/**
 * KIR — Kartu Inventaris Ruangan. Menyusun daftar aset per ruangan + info
 * penanggung jawab (dari inv_ruangan) untuk pratinjau & cetak PDF resmi.
 */

export type KirRuangan = {
  id: string;
  kodePrefix: string;
  nama: string;
  pjNama: string | null;
  pjNip: string | null;
  aktif: boolean;
};

export type KirRuanganSummary = KirRuangan & { jumlah: number; totalNilai: number };

export type KirBarang = {
  kodeBarang: string;
  register: number | null;
  nama: string;
  merk: string | null;
  nomorSeri: string | null;
  tahunPerolehan: number | null;
  kondisi: string | null;
  satuan: string | null;
  statusAset: StatusAset;
  harga: number | null;
  keterangan: string | null;
};

export type KirData = { ruangan: KirRuangan; barang: KirBarang[]; totalNilai: number };

/** Daftar ruangan + jumlah aset & total nilai (untuk pemilih KIR). */
export async function listRuanganForKir(): Promise<KirRuanganSummary[]> {
  const db = getAppDb();
  const [ruangan, grouped] = await Promise.all([
    db.invRuangan.findMany({
      orderBy: [{ aktif: "desc" }, { urutan: "asc" }, { kodePrefix: "asc" }],
      select: { id: true, kodePrefix: true, nama: true, pjNama: true, pjNip: true, aktif: true },
    }),
    db.invBarang.groupBy({ by: ["ruanganId"], _count: { _all: true }, _sum: { harga: true } }),
  ]);
  const stat = new Map(grouped.map((g) => [g.ruanganId, { jumlah: g._count._all, nilai: g._sum.harga == null ? 0 : Number(g._sum.harga) }]));
  return ruangan.map((r) => ({
    ...r,
    jumlah: stat.get(r.id)?.jumlah ?? 0,
    totalNilai: stat.get(r.id)?.nilai ?? 0,
  }));
}

/** Data lengkap KIR satu ruangan (info ruangan + daftar aset urut kode). */
export async function getKirData(ruanganId: string): Promise<KirData> {
  const db = getAppDb();
  const ruangan = await db.invRuangan.findUnique({
    where: { id: ruanganId },
    select: { id: true, kodePrefix: true, nama: true, pjNama: true, pjNip: true, aktif: true },
  });
  if (!ruangan) throw new NotFoundError("Ruangan tidak ditemukan.");

  const rows = await db.invBarang.findMany({
    where: { ruanganId },
    orderBy: [{ kodeBarang: "asc" }],
    select: {
      kodeBarang: true, register: true, nama: true, merk: true, nomorSeri: true,
      tahunPerolehan: true, statusAset: true, harga: true, keterangan: true,
      kondisi: { select: { nama: true } },
      satuan: { select: { nama: true } },
    },
  });

  let totalNilai = 0;
  const barang: KirBarang[] = rows.map((b) => {
    const harga = b.harga == null ? null : Number(b.harga);
    if (harga) totalNilai += harga;
    return {
      kodeBarang: b.kodeBarang,
      register: b.register ?? null,
      nama: b.nama,
      merk: b.merk ?? null,
      nomorSeri: b.nomorSeri ?? null,
      tahunPerolehan: b.tahunPerolehan ?? null,
      kondisi: b.kondisi?.nama ?? null,
      satuan: b.satuan?.nama ?? null,
      statusAset: (isStatusAset(b.statusAset) ? b.statusAset : "AKTIF") as StatusAset,
      harga,
      keterangan: b.keterangan ?? null,
    };
  });

  return { ruangan, barang, totalNilai };
}

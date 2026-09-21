import "server-only";
import type { Prisma } from "@/generated/app/client";
import { getAppDb } from "@/server/db/app.client";
import {
  STATUS_ASET, STATUS_ASET_LABEL, STATUS_ASET_TONE, type StatusAset,
} from "./barang.schema";
import type {
  InvBarItem, InvDashboardData, InvKompo, InvYearItem,
} from "./dashboard.types";

const num = (v: bigint | number | null | undefined): number => (v == null ? 0 : Number(v));

/** Aset "berjalan" = semua unit kecuali yang sudah dihapus/dihapuskan. */
const AKTIF: Prisma.InvBarangWhereInput = { statusAset: { not: "DIHAPUS" } };

const TOP = 8;

export async function getInvDashboard(): Promise<InvDashboardData> {
  const db = getAppDb();

  const [
    totalAgg, jenisBarang, byKondisi, byStatus, byRuangan, byKategori, bySumber, byTahun,
    kondisiRef, ruanganRef, kategoriRef, sumberRef,
  ] = await Promise.all([
    db.invBarang.aggregate({ where: AKTIF, _count: { _all: true }, _sum: { harga: true } }),
    db.invItem.count({ where: { aktif: true } }),
    db.invBarang.groupBy({ by: ["kondisiId"], where: AKTIF, _count: { _all: true } }),
    db.invBarang.groupBy({ by: ["statusAset"], _count: { _all: true } }),
    db.invBarang.groupBy({ by: ["ruanganId"], where: AKTIF, _count: { _all: true }, _sum: { harga: true } }),
    db.invBarang.groupBy({ by: ["kategoriId"], where: AKTIF, _count: { _all: true }, _sum: { harga: true } }),
    db.invBarang.groupBy({ by: ["sumberAnggaranId"], where: AKTIF, _count: { _all: true }, _sum: { harga: true } }),
    db.invBarang.groupBy({ by: ["tahunPerolehan"], where: AKTIF, _count: { _all: true }, _sum: { harga: true } }),
    db.invKondisi.findMany({ select: { id: true, nama: true, tone: true, urutan: true } }),
    db.invRuangan.findMany({ select: { id: true, kodePrefix: true, nama: true } }),
    db.invKategori.findMany({ select: { id: true, nama: true } }),
    db.invSumberAnggaran.findMany({ select: { id: true, singkatan: true, nama: true } }),
  ]);

  const kondisiMap = new Map(kondisiRef.map((k) => [k.id, k]));
  const ruanganMap = new Map(ruanganRef.map((r) => [r.id, r]));
  const kategoriMap = new Map(kategoriRef.map((k) => [k.id, k]));
  const sumberMap = new Map(sumberRef.map((s) => [s.id, s]));

  // Komposisi kondisi (donut, warna status via tone; urut sesuai urutan kondisi).
  const kondisi: InvKompo[] = byKondisi
    .map((g) => {
      const k = g.kondisiId ? kondisiMap.get(g.kondisiId) : null;
      return {
        label: k?.nama ?? "Belum ada kondisi",
        value: g._count._all,
        tone: k?.tone ?? "neutral",
        urutan: k?.urutan ?? 999,
      };
    })
    .sort((a, b) => a.urutan - b.urutan || b.value - a.value)
    .map(({ label, value, tone }) => ({ label, value, tone }));

  // Status aset (semua unit).
  const statusCount = new Map(byStatus.map((g) => [g.statusAset, g._count._all]));
  const statusAset: InvKompo[] = (STATUS_ASET as readonly StatusAset[])
    .map((s) => ({ label: STATUS_ASET_LABEL[s], value: statusCount.get(s) ?? 0, tone: STATUS_ASET_TONE[s] }))
    .filter((s) => s.value > 0);

  // Perlu perhatian = kondisi bertone warning/danger.
  const perluPerhatian = kondisi.filter((k) => k.tone === "warning" || k.tone === "danger").reduce((a, k) => a + k.value, 0);

  const perRuangan: InvBarItem[] = byRuangan
    .map((g) => {
      const r = ruanganMap.get(g.ruanganId);
      return { label: r ? r.kodePrefix : "—", jumlah: g._count._all, nilai: num(g._sum.harga) };
    })
    .sort((a, b) => b.jumlah - a.jumlah)
    .slice(0, TOP);

  const perKategori: InvBarItem[] = byKategori
    .map((g) => ({
      label: g.kategoriId ? kategoriMap.get(g.kategoriId)?.nama ?? "—" : "Tanpa Kategori",
      jumlah: g._count._all,
      nilai: num(g._sum.harga),
    }))
    .sort((a, b) => b.jumlah - a.jumlah)
    .slice(0, TOP);

  const perSumber: InvBarItem[] = bySumber
    .map((g) => ({
      label: g.sumberAnggaranId ? sumberMap.get(g.sumberAnggaranId)?.singkatan ?? "—" : "Tanpa Sumber",
      jumlah: g._count._all,
      nilai: num(g._sum.harga),
    }))
    .sort((a, b) => b.jumlah - a.jumlah)
    .slice(0, TOP);

  const trenTahun: InvYearItem[] = byTahun
    .filter((g) => g.tahunPerolehan != null)
    .map((g) => ({ tahun: g.tahunPerolehan as number, jumlah: g._count._all, nilai: num(g._sum.harga) }))
    .sort((a, b) => a.tahun - b.tahun);

  return {
    totals: {
      totalUnit: totalAgg._count._all,
      totalNilai: num(totalAgg._sum.harga),
      jenisBarang,
      ruanganTerisi: byRuangan.length,
      perluPerhatian,
    },
    kondisi,
    statusAset,
    perRuangan,
    perKategori,
    perSumber,
    trenTahun,
    updatedAt: new Date().toISOString(),
  };
}

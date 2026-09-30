/**
 * Tipe Laporan Pendapatan per Unit — AMAN untuk client (hanya tipe).
 */
import type { CakupanKey, KomponenKey, LayananKey, StatusTagihanKey } from "./pendapatan.constants";

/** Nilai rupiah per komponen jasa + `total` (= kolom TARIF SP). */
export type NilaiPendapatan = Record<KomponenKey, number> & { total: number };

export type RuanganRef = { id: string; nama: string };

export type UnitPendapatan = RuanganRef & {
  layanan: LayananKey;
  aktif: boolean;
  /** Jumlah tagihan (berbeda) yang punya pendapatan di unit ini. */
  tagihan: number;
  nilai: NilaiPendapatan;
  /** Total per status tagihan — hanya status yang dipilih filter. */
  perStatus: Partial<Record<StatusTagihanKey, number>>;
  /** Porsi terhadap total pendapatan cakupan (0–1). */
  porsi: number;
};

export type RingkasStatus = { tagihan: number; total: number; dipilih: boolean };

/** Ringkasan satu layanan (filter status & cara bayar berlaku; filter unit tidak). */
export type RingkasLayanan = { key: LayananKey; label: string; tagihan: number; total: number };

export type OpsiCaraBayar = { id: number; label: string };

export type PendapatanUnitResult = {
  periode: { from: string; to: string };
  /** Cakupan laporan: satu layanan atau semua. */
  layanan: { key: CakupanKey; label: string };
  filter: {
    status: StatusTagihanKey[];
    caraBayar: OpsiCaraBayar | null;
    ruangan: RuanganRef | null;
  };
  /** Unit cakupan (aktif, atau nonaktif yang punya pendapatan), urut layanan lalu kode ruangan. */
  units: UnitPendapatan[];
  /** Total atas filter; `tagihan` = tagihan berbeda (satu tagihan bisa lintas unit). */
  total: NilaiPendapatan & { tagihan: number };
  /** Ringkasan SEMUA status (tak terpengaruh filter status) — transparansi cakupan. */
  perStatus: Record<StatusTagihanKey, RingkasStatus>;
  /** Ringkasan setiap layanan (urutan katalog) — jumlahnya = Semua Layanan. */
  perLayanan: RingkasLayanan[];
  cakupan: {
    termasuk: (RuanganRef & { layanan: LayananKey })[];
    /** Unit berjenis kunjungan layanan ini yang dialihkan ke layanan lain (mis. KLINIK MCU). */
    dialihkan: (RuanganRef & { ke: LayananKey; alasan: string })[];
  };
  /** Catatan kelengkapan data (mis. ada penjualan bebas apotek yang tak tercakup). */
  peringatan: string[];
  opsi: { caraBayar: OpsiCaraBayar[]; unit: RuanganRef[] };
  meta: { dihitungPada: string; durasiMs: number; dariCache: boolean };
};

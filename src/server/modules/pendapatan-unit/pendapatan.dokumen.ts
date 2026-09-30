import "server-only";
import { stampWita } from "@/server/lib/excel";
import { infoCakupan, LABEL_NILAI, LAYANAN, STATUS_TAGIHAN } from "./pendapatan.constants";
import type { PendapatanUnitResult, UnitPendapatan } from "./pendapatan.types";

/**
 * Model dokumen ekspor BERSAMA (Excel & PDF): judul, baris meta, dan definisi
 * kolom satu sumber — kedua format selalu konsisten.
 */

export const judulDokumen = (r: PendapatanUnitResult) => `Laporan Pendapatan per Unit — ${r.layanan.label}`;
export const SUBJUDUL = "UPTD RSUD Bolaang Mongondow Timur · Sumber: SIMGOS (read-only)";

const semuaLayanan = (r: PendapatanUnitResult) => r.layanan.key === "semua";

export type TipeKolom = "teks" | "angka" | "uang" | "persen";

export type KolomDokumen = {
  header: string;
  tipe: TipeKolom;
  nilai: (u: UnitPendapatan, i: number) => string | number;
  /** Nilai baris TOTAL (null = kosong). */
  total: string | number | null;
  /** Lebar kolom Excel (karakter). */
  lebar: number;
};

const tglFmt = new Intl.DateTimeFormat("id-ID", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" });
const rpFmt = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 });

/** `YYYY-MM-DD` → "29 Sep 2026" (tanpa pergeseran zona waktu server). */
export const tglId = (iso: string) => tglFmt.format(new Date(`${iso}T00:00:00Z`));
export const rupiah = (n: number) => `Rp${rpFmt.format(n)}`;
export const angkaId = (n: number) => rpFmt.format(n);

/** Judul kolom nilai tunggal (gabungan seluruh komponen jasa = total). */
export const HEADER_NILAI = `${LABEL_NILAI} (Rp)`;

/**
 * Kolom tabel per unit — ringkas: satu kolom nilai (gabungan seluruh komponen
 * jasa, = kolom TARIF SP). Kolom rincian per status hanya bila >1 status
 * dipilih dan `perStatus` aktif. Cakupan Semua Layanan menambah kolom Layanan.
 */
export function kolomDokumen(r: PendapatanUnitResult, opts: { perStatus?: boolean } = {}): KolomDokumen[] {
  const status =
    opts.perStatus !== false && r.filter.status.length > 1
      ? STATUS_TAGIHAN.filter((s) => r.filter.status.includes(s.key))
      : [];
  return [
    { header: "No", tipe: "angka", nilai: (_u, i) => i + 1, total: null, lebar: 5 },
    ...(semuaLayanan(r)
      ? [{ header: "Layanan", tipe: "teks", nilai: (u) => infoCakupan(u.layanan).kode, total: null, lebar: 10 } satisfies KolomDokumen]
      : []),
    { header: "Kode", tipe: "teks", nilai: (u) => u.id, total: null, lebar: 12 },
    { header: "Unit", tipe: "teks", nilai: (u) => (u.aktif ? u.nama : `${u.nama} (nonaktif)`), total: "TOTAL", lebar: 26 },
    { header: "Tagihan", tipe: "angka", nilai: (u) => u.tagihan, total: r.total.tagihan, lebar: 10 },
    { header: HEADER_NILAI, tipe: "uang", nilai: (u) => u.nilai.total, total: r.total.total, lebar: 22 },
    ...status.map<KolomDokumen>((s) => ({
      header: `${s.label} (Rp)`,
      tipe: "uang",
      nilai: (u) => u.perStatus[s.key] ?? 0,
      total: r.units.reduce((a, u) => a + (u.perStatus[s.key] ?? 0), 0),
      lebar: 16,
    })),
    { header: "Porsi", tipe: "persen", nilai: (u) => u.porsi, total: r.total.total > 0 ? 1 : 0, lebar: 9 },
  ];
}

/** Kalimat cakupan (layanan, jumlah unit, unit yang dialihkan). */
function kalimatCakupan(r: PendapatanUnitResult): string {
  // Jumlah unit terdaftar (termasuk nonaktif); tabel hanya memuat unit aktif / berpendapatan.
  const n = r.cakupan.termasuk.length;
  if (semuaLayanan(r)) {
    return `Cakupan: semua layanan (${n} unit terdaftar) — ${LAYANAN.map((l) => l.label).join(", ")}.`;
  }
  const dialihkan = r.cakupan.dialihkan.map((d) => `${d.nama} → ${infoCakupan(d.ke).label}`).join(", ");
  return `Cakupan: unit ${r.layanan.label} (${n} unit terdaftar)${dialihkan ? `. Dialihkan ke layanan lain: ${dialihkan}` : ""}.`;
}

/** Baris meta dokumen: periode, filter, cakupan, rekap status/layanan, peringatan, jejak pembuat. */
export function metaDokumen(r: PendapatanUnitResult, opts: { oleh: string; waktu: Date }): string[] {
  const statusLabel = STATUS_TAGIHAN.filter((s) => r.filter.status.includes(s.key)).map((s) => s.label);
  const rekap = STATUS_TAGIHAN.map(
    (s) => `${s.label}${r.perStatus[s.key].dipilih ? "" : " [tidak dihitung]"}: ${angkaId(r.perStatus[s.key].tagihan)} tagihan · ${rupiah(r.perStatus[s.key].total)}`,
  ).join("  |  ");
  return [
    `Periode tanggal tagihan: ${tglId(r.periode.from)} s.d. ${tglId(r.periode.to)}`,
    `Status tagihan: ${statusLabel.join(", ")}  ·  Cara bayar: ${r.filter.caraBayar?.label ?? "Semua"}  ·  Unit: ${r.filter.ruangan?.nama ?? (semuaLayanan(r) ? "Semua unit" : `Semua unit ${r.layanan.label}`)}`,
    kalimatCakupan(r),
    `Rekap status tagihan — ${rekap}`,
    ...(semuaLayanan(r) && !r.filter.ruangan
      ? [`Rekap per layanan — ${r.perLayanan.map((l) => `${l.label}: ${rupiah(l.total)}`).join("  |  ")}`]
      : []),
    ...r.peringatan.map((p) => `PERHATIAN: ${p}`),
    `Port SP laporan.LaporanPendapatanPerUnit (SP asli hanya tagihan terbayar/final). Dibuat oleh ${opts.oleh}, ${stampWita(opts.waktu)}.`,
  ];
}

/** Nama berkas aman (kode layanan dari katalog + tanggal ter-validasi + format). */
export function namaBerkas(r: PendapatanUnitResult, format: "xlsx" | "pdf"): string {
  return `Pendapatan-Unit-${infoCakupan(r.layanan.key).kode}_${r.periode.from}_sd_${r.periode.to}.${format}`;
}

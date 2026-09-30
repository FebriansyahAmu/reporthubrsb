/**
 * Konstanta Laporan Pendapatan per Unit — AMAN untuk client (tanpa I/O). Port
 * dari SP `laporan.LaporanPendapatanPerUnit` dengan cakupan status tagihan
 * diperluas (SP hanya tagihan yang sudah dibayar/final) & pilihan layanan
 * (setara parameter `LAPORAN` = jenis kunjungan pada SP).
 */

/* ---------------------------------------------------- komponen pendapatan */

/** Komponen jasa sesuai kolom SP (urutan = urutan kolom laporan). */
export const KOMPONEN = [
  { key: "administrasi", label: "Administrasi" },
  { key: "sarana", label: "Sarana" },
  { key: "bhp", label: "BHP" },
  { key: "akomodasi", label: "Akomodasi" },
  { key: "dokterOperator", label: "Dokter Operator" },
  { key: "dokterAnastesi", label: "Dokter Anastesi" },
  { key: "dokterLainnya", label: "Dokter Lainnya" },
  { key: "penataAnastesi", label: "Penata Anastesi" },
  { key: "paramedis", label: "Paramedis" },
  { key: "nonMedis", label: "Non Medis" },
] as const;

export type KomponenKey = (typeof KOMPONEN)[number]["key"];

/**
 * Tampilan ringkas: SATU kolom nilai = jumlah seluruh komponen = kolom TARIF SP
 * (diverifikasi identik per unit, 30 Sep 2026). Rincian komponen tetap ada di
 * data API (`nilai.*`) untuk verifikasi kesetiaan SP, tetapi tidak ditampilkan.
 */
export const LABEL_NILAI = "Akomodasi & Tindakan Pelayanan";

/* ---------------------------------------------------------- status tagihan */

/**
 * `pembayaran.tagihan.STATUS` (diverifikasi dari trigger SIMGOS & fungsi
 * `pembayaran.isFinalTagihan`): 0 = batal, 1 = belum final, 2 = final
 * (diset trigger saat pembayaran JENIS 1/4/8 berstatus 2).
 */
export const STATUS_TAGIHAN = [
  { key: "final", kode: 2, label: "Final", deskripsi: "Tagihan sudah difinalkan kasir" },
  { key: "belum", kode: 1, label: "Belum Final", deskripsi: "Tagihan aktif, belum difinalkan" },
  { key: "batal", kode: 0, label: "Batal", deskripsi: "Tagihan dibatalkan" },
] as const;

export type StatusTagihanKey = (typeof STATUS_TAGIHAN)[number]["key"];

export const STATUS_KEYS = STATUS_TAGIHAN.map((s) => s.key) as [StatusTagihanKey, ...StatusTagihanKey[]];

/** Default: semua tagihan yang masih berlaku (tagihan batal hanya bila dipilih). */
export const STATUS_DEFAULT: readonly StatusTagihanKey[] = ["final", "belum"];

const STATUS_BY_KODE = new Map<number, StatusTagihanKey>(STATUS_TAGIHAN.map((s) => [s.kode, s.key]));

/** Kode `tagihan.STATUS` → kunci status; null bila kode di luar katalog. */
export function statusDariKode(kode: number): StatusTagihanKey | null {
  return STATUS_BY_KODE.get(kode) ?? null;
}

/* ------------------------------------------------------------------ layanan */

/**
 * Layanan = pengelompokan unit (`master.ruangan` leaf JENIS 5) menurut
 * `JENIS_KUNJUNGAN` (referensi JENIS 15) — sama dengan parameter `LAPORAN` SP.
 * Setiap unit masuk TEPAT SATU layanan (sisa → "Lainnya"), sehingga jumlah semua
 * layanan = "Semua Layanan" (tak ada rupiah yang hilang/ganda).
 */
export const LAYANAN = [
  { key: "rj", label: "Rawat Jalan", singkat: "Rawat Jalan", kode: "RJ", jenisKunjungan: [1], deskripsi: "Poliklinik, tanpa MCU & Radiologi" },
  { key: "igd", label: "Gawat Darurat", singkat: "IGD", kode: "IGD", jenisKunjungan: [2], deskripsi: "Instalasi Gawat Darurat" },
  { key: "ri", label: "Rawat Inap", singkat: "Rawat Inap", kode: "RI", jenisKunjungan: [3], deskripsi: "Ruang perawatan, termasuk ICU/ICCU/NICU" },
  { key: "lab", label: "Laboratorium", singkat: "Laboratorium", kode: "LAB", jenisKunjungan: [4, 13], deskripsi: "Laboratorium & patologi anatomi" },
  { key: "rad", label: "Radiologi", singkat: "Radiologi", kode: "RAD", jenisKunjungan: [5], deskripsi: "Unit & klinik radiologi" },
  { key: "farmasi", label: "Farmasi", singkat: "Farmasi", kode: "FARMASI", jenisKunjungan: [11], deskripsi: "Depo farmasi (obat & BMHP)" },
  { key: "lainnya", label: "Lainnya", singkat: "Lainnya", kode: "LAINNYA", jenisKunjungan: [], deskripsi: "MCU, kamar operasi & unit lain" },
] as const;

export type LayananKey = (typeof LAYANAN)[number]["key"];

/** Pilihan cakupan laporan: satu layanan, atau semua layanan sekaligus. */
export const SEMUA_LAYANAN = { key: "semua", label: "Semua Layanan", singkat: "Semua", kode: "SEMUA" } as const;

export type CakupanKey = LayananKey | typeof SEMUA_LAYANAN.key;

export const CAKUPAN_KEYS: readonly [CakupanKey, ...CakupanKey[]] = [
  LAYANAN[0].key,
  ...LAYANAN.slice(1).map((l) => l.key),
  SEMUA_LAYANAN.key,
];

export const CAKUPAN_DEFAULT: CakupanKey = "rj";

const LAYANAN_BY_KEY = new Map<CakupanKey, { key: CakupanKey; label: string; singkat: string; kode: string }>([
  ...LAYANAN.map((l) => [l.key, l] as const),
  [SEMUA_LAYANAN.key, SEMUA_LAYANAN],
]);

export function infoCakupan(key: CakupanKey) {
  return LAYANAN_BY_KEY.get(key)!;
}

/** Jenis kunjungan "Bukan Ruangan Kunjungan / Pelayanan" (18) & tanpa jenis (0): gudang, depo lama, dll. */
const JK_BUKAN_PELAYANAN = new Set([0, 18]);

/**
 * Unit yang layanannya TIDAK sesuai jenis kunjungannya → dialihkan lewat nama
 * (urutan = prioritas). Mis. KLINIK RADIOLOGI (jenis kunjungan RJ) → Radiologi,
 * KLINIK MCU (RJ) → Lainnya.
 */
export const ALIH_NAMA: readonly { pola: RegExp; ke: LayananKey; alasan: string }[] = [
  { pola: /\bMCU\b|MEDICAL CHECK/i, ke: "lainnya", alasan: "MCU" },
  { pola: /RADIOLOG/i, ke: "rad", alasan: "Radiologi" },
  { pola: /LABORATOR/i, ke: "lab", alasan: "Laboratorium" },
  { pola: /FARMASI|APOTE?K|DEPO/i, ke: "farmasi", alasan: "Farmasi" },
  { pola: /RAWAT INAP/i, ke: "ri", alasan: "Rawat Inap" },
];

function layananDariJenisKunjungan(jk: number): LayananKey {
  return LAYANAN.find((l) => (l.jenisKunjungan as readonly number[]).includes(jk))?.key ?? "lainnya";
}

export type KlasifikasiUnit = {
  layanan: LayananKey;
  /** Layanan menurut jenis kunjungan saja (sebelum pengalihan nama). */
  asal: LayananKey;
  /** Alasan pengalihan nama; null = sesuai jenis kunjungan. */
  alasan: string | null;
  /** Unit pelayanan (bukan gudang/non-kunjungan) — hanya unit pelayanan yang ditampilkan meski tanpa pendapatan. */
  pelayanan: boolean;
};

/** Klasifikasi satu unit ke layanan: pengalihan nama dulu, lalu jenis kunjungan. */
export function klasifikasiUnit(nama: string, jenisKunjungan: number): KlasifikasiUnit {
  const asal = layananDariJenisKunjungan(jenisKunjungan);
  const alih = ALIH_NAMA.find((a) => a.pola.test(nama));
  const layanan = alih?.ke ?? asal;
  return {
    layanan,
    asal,
    alasan: alih && alih.ke !== asal ? alih.alasan : null,
    pelayanan: !JK_BUKAN_PELAYANAN.has(jenisKunjungan),
  };
}

/* ------------------------------------------------------------------- batas */

export const BATAS = {
  /** Rentang tanggal tagihan maksimum (semua unit 1 tahun ≈ 2,3 dtk; 1 bulan ≈ 0,3 dtk — 30 Sep 2026). */
  RENTANG_MAKS_HARI: 366,
  /**
   * Umur cache hasil SIMGOS per rentang — SATU komputasi semua unit melayani
   * semua layanan, filter & ekspor (ganti tab tak query ulang).
   */
  CACHE_TTL_MS: 60_000,
  /** Entri cache maksimum (1 tahun semua unit ≈ 10 rb baris grain). */
  CACHE_MAKS: 8,
  /** Umur cache master ruangan & cara bayar (disegarkan lebih awal bila muncul unit baru). */
  MASTER_TTL_MS: 5 * 60_000,
  /** Maks komputasi SIMGOS bersamaan untuk laporan ini. */
  KOMPUTASI_PARALEL: 2,
} as const;

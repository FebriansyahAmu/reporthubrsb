/**
 * Riwayat Pengisian Form RM — aturan filter murni (klien & server): rentang
 * tanggal WITA, dasar tanggal, status, dan tipe DTO daftar. Tanpa registri form
 * agar ringan di klien.
 */
import { selisihHari, tambahHari } from "@/server/modules/rl32/rl32.periode";
import { MIN_CARI, tafsirCari } from "./cari";
import type { StatusIsian } from "./isian.status";
import type { KodeForm } from "./registry";

export { selisihHari, tambahHari };

export const DASAR_TANGGAL = ["diperbarui", "dibuat", "difinalkan"] as const;
export type DasarTanggal = (typeof DASAR_TANGGAL)[number];
export const LABEL_DASAR: Record<DasarTanggal, string> = {
  diperbarui: "Terakhir diperbarui",
  dibuat: "Tanggal dibuat",
  difinalkan: "Tanggal difinalkan",
};

export const STATUS_RIWAYAT = ["semua", "DRAF", "FINAL", "BATAL"] as const;
export type StatusRiwayat = (typeof STATUS_RIWAYAT)[number];

export const PER_HALAMAN_RIWAYAT = 20;
/** Rentang terlebar satu permintaan (hari kalender, inklusif). */
export const MAKS_RENTANG_RIWAYAT = 366;
export const PESAN_CARI_RIWAYAT = `Cari dengan No.RM / NOPEN (angka) atau nama pasien (huruf), minimal ${MIN_CARI} karakter`;

const RE_TANGGAL = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Tanggal kalender sah `YYYY-MM-DD` (menolak 2026-02-30). */
export function tanggalSah(ymd: string): boolean {
  const m = RE_TANGGAL.exec(ymd);
  if (!m) return false;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  return d.getUTCFullYear() === +m[1] && d.getUTCMonth() === +m[2] - 1 && d.getUTCDate() === +m[3];
}

/**
 * Batas waktu (instan UTC) rentang tanggal WITA inklusif: 00.00 WITA tanggal
 * awal s.d. sebelum 00.00 WITA sesudah tanggal akhir. Kolom DB berisi UTC.
 */
export const batasRentang = (dari: string, sampai: string): { gte: Date; lt: Date } => ({
  gte: new Date(`${dari}T00:00:00+08:00`),
  lt: new Date(`${tambahHari(sampai, 1)}T00:00:00+08:00`),
});

export const PINTASAN_RENTANG = [
  { kunci: "hari-ini", label: "Hari ini" },
  { kunci: "7-hari", label: "7 hari" },
  { kunci: "30-hari", label: "30 hari" },
  { kunci: "bulan-ini", label: "Bulan ini" },
] as const;
export type KunciPintasan = (typeof PINTASAN_RENTANG)[number]["kunci"];

export function rentangPintasan(kunci: KunciPintasan, hariIni: string): { dari: string; sampai: string } {
  switch (kunci) {
    case "hari-ini":
      return { dari: hariIni, sampai: hariIni };
    case "7-hari":
      return { dari: tambahHari(hariIni, -6), sampai: hariIni };
    case "30-hari":
      return { dari: tambahHari(hariIni, -29), sampai: hariIni };
    case "bulan-ini":
      return { dari: `${hariIni.slice(0, 7)}-01`, sampai: hariIni };
  }
}

/** Pintasan yang persis sama dengan rentang ini (untuk menandai tombol aktif). */
export const pintasanAktif = (dari: string, sampai: string, hariIni: string): KunciPintasan | null =>
  PINTASAN_RENTANG.find((p) => {
    const r = rentangPintasan(p.kunci, hariIni);
    return r.dari === dari && r.sampai === sampai;
  })?.kunci ?? null;

/** Filter halaman Riwayat (status URL & state klien). `form` "" = semua formulir. */
export type FilterRiwayat = {
  dari: string;
  sampai: string;
  dasar: DasarTanggal;
  status: StatusRiwayat;
  form: string;
  q: string;
  saya: boolean;
  halaman: number;
};

export const filterAwalRiwayat = (hariIni: string): FilterRiwayat => ({
  ...rentangPintasan("7-hari", hariIni),
  dasar: "diperbarui",
  status: "semua",
  form: "",
  q: "",
  saya: false,
  halaman: 1,
});

type ParamMentah = URLSearchParams | Record<string, string | string[] | undefined>;
const ambil = (sp: ParamMentah, k: string): string | undefined => {
  const v = sp instanceof URLSearchParams ? sp.get(k) ?? undefined : sp[k];
  return Array.isArray(v) ? v[0] : v;
};

/**
 * Filter dari parameter URL — longgar (nilai tak dikenal → bawaan) karena hanya
 * menjadi state awal halaman; API tetap memvalidasi ketat. `kodeBoleh` =
 * formulir yang boleh dilihat (kode lain diabaikan).
 */
export function uraiFilterRiwayat(sp: ParamMentah, hariIni: string, kodeBoleh: readonly string[]): FilterRiwayat {
  const awal = filterAwalRiwayat(hariIni);
  const dari = ambil(sp, "dari") ?? "";
  const sampai = ambil(sp, "sampai") ?? "";
  const rentangOk =
    tanggalSah(dari) && tanggalSah(sampai) && dari <= sampai && selisihHari(dari, sampai) < MAKS_RENTANG_RIWAYAT;
  const dasar = ambil(sp, "dasar");
  const status = ambil(sp, "status");
  const form = ambil(sp, "form") ?? "";
  const q = (ambil(sp, "q") ?? "").trim().slice(0, 60);
  const halaman = Number(ambil(sp, "halaman"));
  return {
    dari: rentangOk ? dari : awal.dari,
    sampai: rentangOk ? sampai : awal.sampai,
    dasar: (DASAR_TANGGAL as readonly string[]).includes(dasar ?? "") ? (dasar as DasarTanggal) : awal.dasar,
    status: (STATUS_RIWAYAT as readonly string[]).includes(status ?? "") ? (status as StatusRiwayat) : awal.status,
    form: kodeBoleh.includes(form) ? form : "",
    q: q && tafsirCari(q) ? q : "",
    saya: ambil(sp, "saya") === "1",
    halaman: Number.isInteger(halaman) && halaman >= 1 && halaman <= 10_000 ? halaman : 1,
  };
}

/**
 * Query string filter. `lengkap` (permintaan API) selalu memuat rentang;
 * tanpa `lengkap` (URL halaman) nilai bawaan dihilangkan agar URL ringkas.
 */
export function queryRiwayat(f: FilterRiwayat, hariIni: string, lengkap: boolean): string {
  const awal = filterAwalRiwayat(hariIni);
  const p = new URLSearchParams();
  if (lengkap || f.dari !== awal.dari || f.sampai !== awal.sampai) {
    p.set("dari", f.dari);
    p.set("sampai", f.sampai);
  }
  if (f.dasar !== awal.dasar) p.set("dasar", f.dasar);
  if (f.status !== awal.status) p.set("status", f.status);
  if (f.form) p.set("form", f.form);
  if (f.q && tafsirCari(f.q)) p.set("q", f.q.trim());
  if (f.saya) p.set("saya", "1");
  if (f.halaman > 1) p.set("halaman", String(f.halaman));
  return p.toString();
}

/* -------------------------------------------------------------------- DTO */

/** Hanya nama bergelar (id akun tidak dikirim ke klien). */
export type PetugasRiwayat = { nama: string };

export type ItemRiwayat = {
  id: string;
  kode: KodeForm;
  /** Pembeda isian form berulang (mis. tindakan RM.22), null untuk form lain. */
  ringkas: string | null;
  urutan: number;
  status: StatusIsian;
  /** false = isian sebelum pasien terdaftar yang belum ditautkan ke NOPEN. */
  tertaut: boolean;
  nopen: string;
  norm: string;
  namaPasien: string;
  ruang: string | null;
  createdAt: string;
  updatedAt: string;
  difinalkanAt: string | null;
  /** Waktu menurut dasar tanggal filter (pengurut & pengelompok baris). */
  waktu: string;
  dibuatOleh: PetugasRiwayat | null;
  difinalkanOleh: PetugasRiwayat | null;
  milikSaya: boolean;
  bolehCetak: boolean;
};

export type RiwayatResult = {
  data: ItemRiwayat[];
  /** Jumlah per status untuk filter yang sama (tanpa filter status). */
  jumlah: Record<StatusRiwayat, number>;
  total: number;
  halaman: number;
  jumlahHalaman: number;
  perHalaman: number;
};

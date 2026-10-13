/**
 * Filter daftar Berkas Klaim RM — MURNI (dipakai halaman server & komponen klien).
 *
 * Filter bertahan selama petugas bolak-balik daftar ↔ detail pasien:
 * 1. URL (`?dari&sampai&jenis&ruangan&cari&hal`) = sumber kebenaran; tombol
 *    Back browser memulihkannya.
 * 2. Cookie sesi `COOKIE_FILTER_RM` (path daftar, ≤ 12 jam) = cadangan saat
 *    daftar dibuka TANPA parameter (tautan "Kembali ke daftar", menu samping),
 *    dibaca server sehingga tak ada kedip / query ganda.
 * Semua nilai divalidasi ulang; nilai rusak jatuh ke bawaan.
 */
import type { KategoriKunjungan } from "@/server/modules/kunjungan/kunjungan.types";

export type KategoriFilter = "Semua" | KategoriKunjungan;

export type FilterRm = {
  from: string;
  to: string;
  ruangan: string;
  kategori: KategoriFilter;
  q: string;
  page: number;
};

export const COOKIE_FILTER_RM = "bk_rm_filter";
export const PATH_FILTER_RM = "/berkas-klaim/rm";
export const UMUR_FILTER_RM_DETIK = 12 * 3600;
export const CARI_MAKS = 60;

/** Kode jenis di URL (pendek, tanpa spasi) ↔ kategori. */
const JENIS_KODE: Record<KategoriKunjungan, string> = { "Rawat Inap": "ri", "Rawat Jalan Klinik": "rj", IGD: "igd" };
const KODE_JENIS = Object.fromEntries(Object.entries(JENIS_KODE).map(([k, v]) => [v, k])) as Record<string, KategoriKunjungan>;
const PARAM = ["dari", "sampai", "jenis", "ruangan", "cari", "hal"] as const;

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const tanggalSah = (v: string | undefined): v is string =>
  !!v && ISO.test(v) && new Date(`${v}T00:00:00Z`).toISOString().startsWith(v);

export function tambahHari(iso: string, n: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Bawaan: 7 hari terakhir s.d. hari ini, semua jenis & ruangan. */
export function filterBawaan(hariIni: string): FilterRm {
  return { from: tambahHari(hariIni, -6), to: hariIni, ruangan: "", kategori: "Semua", q: "", page: 1 };
}

type Sumber = URLSearchParams | Record<string, string | string[] | undefined>;
const ambil = (s: Sumber, k: string): string | undefined => {
  const v = s instanceof URLSearchParams ? (s.get(k) ?? undefined) : s[k];
  return Array.isArray(v) ? v[0] : v;
};

/** Ada parameter filter di URL? (tanpa → boleh pulihkan dari cookie). */
export function adaParamFilter(s: Sumber): boolean {
  return PARAM.some((k) => ambil(s, k) !== undefined);
}

/** Urai + validasi; nilai tak sah → bawaan. Tanggal dijepit ≤ hari ini & dari ≤ sampai. */
export function uraiFilterRm(s: Sumber, hariIni: string): FilterRm {
  const b = filterBawaan(hariIni);
  let to = tanggalSah(ambil(s, "sampai")) ? ambil(s, "sampai")! : b.to;
  if (to > hariIni) to = hariIni;
  let from = tanggalSah(ambil(s, "dari")) ? ambil(s, "dari")! : b.from;
  if (from > to) from = to;
  const jenis = KODE_JENIS[ambil(s, "jenis") ?? ""];
  const ruangan = ambil(s, "ruangan") ?? "";
  const hal = Number(ambil(s, "hal"));
  return {
    from,
    to,
    ruangan: /^\d{1,20}$/.test(ruangan) ? ruangan : "",
    kategori: jenis ?? "Semua",
    q: (ambil(s, "cari") ?? "").trim().slice(0, CARI_MAKS),
    page: Number.isInteger(hal) && hal >= 1 && hal <= 10_000 ? hal : 1,
  };
}

/** Query string URL/cookie (tanggal selalu ditulis agar pemulihan tepat; sisanya bila diisi). */
export function keQueryRm(f: FilterRm): string {
  const p = new URLSearchParams({ dari: f.from, sampai: f.to });
  if (f.kategori !== "Semua") p.set("jenis", JENIS_KODE[f.kategori]);
  if (f.ruangan) p.set("ruangan", f.ruangan);
  if (f.q.trim()) p.set("cari", f.q.trim());
  if (f.page > 1) p.set("hal", String(f.page));
  return p.toString();
}

export type FilterAktif = "tanggal" | "kategori" | "ruangan" | "q";

/** Filter yang berbeda dari bawaan — untuk disorot & ditampilkan sebagai chip. */
export function filterAktif(f: FilterRm, hariIni: string): FilterAktif[] {
  const b = filterBawaan(hariIni);
  const out: FilterAktif[] = [];
  if (f.from !== b.from || f.to !== b.to) out.push("tanggal");
  if (f.kategori !== "Semua") out.push("kategori");
  if (f.ruangan) out.push("ruangan");
  if (f.q.trim()) out.push("q");
  return out;
}

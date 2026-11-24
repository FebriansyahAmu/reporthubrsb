/**
 * Penilaian & ringkasan "Terbit saat pulang" — FUNGSI MURNI, dipakai server
 * (layanan & ekspor) DAN klien (saringan instan) agar isi berkas = layar.
 */
import {
  CARA_PULANG,
  CARA_WAJIB_KONTROL,
  STATUS_DINILAI,
  STATUS_PULANG,
  STATUS_PULANG_KEYS,
  type LayananPulang,
  type StatusPulang,
} from "./surat-kontrol.pulang.constants";
import { tambahHari } from "./surat-kontrol.filter";
import type { EpisodePulang, SuratPulang } from "./surat-kontrol.pulang.types";

const HARI_MS = 86_400_000;

/** Selisih hari kalender `a − b` (keduanya `YYYY-MM-DD`). */
export function selisihHari(a: string, b: string): number {
  return Math.round((Date.parse(`${a}T00:00:00Z`) - Date.parse(`${b}T00:00:00Z`)) / HARI_MS);
}

export type EpisodeMasukan = Omit<EpisodePulang, "noSuratAcuan" | "selisihHari" | "hariSejakPulang" | "status">;

export const ALASAN_PASCA_RI = "Kontrol pasca rawat inap";

/**
 * Wajib Surat Kontrol? RI: hanya cara keluar 1 (Diizinkan pulang; tak diketahui =
 * wajib). RJ: wajib, KECUALI lanjut rawat inap, kontrol pasca rawat inap (BPJS
 * tidak menerbitkan Surat Kontrol baru dari kunjungan ini — kontrol berikutnya
 * perlu rujukan FKTP baru), atau dirujuk ke faskes lain.
 */
export function tentukanWajib(
  layanan: LayananPulang,
  f: { cara: number | null; dirujuk: boolean; lanjutRi: boolean; pascaRi: boolean },
): { wajib: boolean; alasan: string | null } {
  if (layanan === "RI") {
    const wajib = f.cara == null || f.cara === CARA_WAJIB_KONTROL;
    return { wajib, alasan: wajib ? null : (CARA_PULANG[f.cara ?? -1] ?? `Cara keluar #${f.cara}`) };
  }
  if (f.lanjutRi) return { wajib: false, alasan: "Lanjut rawat inap" };
  if (f.pascaRi) return { wajib: false, alasan: ALASAN_PASCA_RI };
  if (f.dirujuk) return { wajib: false, alasan: "Dirujuk ke faskes lain" };
  return { wajib: true, alasan: null };
}

const urutSurat = (a: SuratPulang, b: SuratPulang) =>
  Number(b.aktif) - Number(a.aktif) ||
  (a.tglTerbit ?? "9999").localeCompare(b.tglTerbit ?? "9999") ||
  a.noSurat.localeCompare(b.noSurat);

/**
 * Nilai satu episode pulang. Acuan = surat AKTIF dengan tanggal terbit paling
 * awal (episode bisa punya > 1 surat, mis. diterbitkan ulang). Surat terhapus
 * tidak dihitung "terbit".
 */
export function nilaiEpisode(e: EpisodeMasukan, hariIni: string): EpisodePulang {
  const surat = [...e.surat].sort(urutSurat);
  const aktif = surat.filter((s) => s.aktif);
  const acuan = aktif.find((s) => s.tglTerbit) ?? null;
  const selisih = acuan?.tglTerbit ? selisihHari(acuan.tglTerbit, e.tglPulang) : null;
  let status: StatusPulang;
  if (selisih !== null) status = selisih === 0 ? "TEPAT" : selisih > 0 ? "TERLAMBAT" : "LEBIH_AWAL";
  else if (aktif.length > 0) status = "TAK_TERVERIFIKASI";
  else status = e.wajib ? "BELUM_TERBIT" : "TIDAK_WAJIB";
  return {
    ...e,
    surat,
    // Jadwal tanpa surat hanya bermakna bila memang belum ada surat aktif.
    jadwalTanpaSurat: aktif.length === 0 ? e.jadwalTanpaSurat : null,
    noSuratAcuan: acuan?.noSurat ?? aktif[0]?.noSurat ?? null,
    selisihHari: selisih,
    hariSejakPulang: Math.max(0, selisihHari(hariIni, e.tglPulang)),
    status,
  };
}

export type FilterPulang = {
  layanan?: LayananPulang;
  status?: StatusPulang;
  /** Nama ruangan tampilan (`ruangan.nama`, atau "Tanpa ruangan"). */
  ruangan?: string;
  /** Satu tanggal pulang (klik grafik). */
  tanggal?: string;
  /** Cari: nama, RM, NOPEN, SEP, nomor surat, dokter, ruangan. */
  q?: string;
};

export const namaRuangan = (e: Pick<EpisodePulang, "ruangan">) => e.ruangan?.nama ?? "Tanpa ruangan";

const norm = (s: string) => s.toLocaleLowerCase("id-ID").normalize("NFKD").replace(/[̀-ͯ]/g, "");

export function cocokCariPulang(e: EpisodePulang, q: string): boolean {
  const k = norm(q.trim());
  if (!k) return true;
  const ladang = [e.pasien, e.norm, e.nopen, e.sep, e.dokter, e.ruangan?.nama, ...e.surat.map((s) => s.noSurat)];
  return ladang.some((v) => !!v && norm(v).includes(k));
}

export function saringPulang(eps: readonly EpisodePulang[], f: FilterPulang): EpisodePulang[] {
  return eps.filter(
    (e) =>
      (!f.layanan || e.layanan === f.layanan) &&
      (!f.status || e.status === f.status) &&
      (!f.ruangan || namaRuangan(e) === f.ruangan) &&
      (!f.tanggal || e.tglPulang === f.tanggal) &&
      (!f.q || cocokCariPulang(e, f.q)),
  );
}

const BOBOT = Object.fromEntries(STATUS_PULANG_KEYS.map((k, i) => [k, i])) as Record<StatusPulang, number>;

/** Urutan bawaan: status terberat dulu, lalu pulang terbaru (yang masih bisa diterbitkan hari ini paling atas). */
export function urutkanPulang(eps: EpisodePulang[]): EpisodePulang[] {
  return eps.sort(
    (a, b) =>
      BOBOT[a.status] - BOBOT[b.status] ||
      b.tglPulang.localeCompare(a.tglPulang) ||
      (b.jamPulang ?? "").localeCompare(a.jamPulang ?? "") ||
      a.key.localeCompare(b.key),
  );
}

export type RingkasPulang = {
  total: number;
  /** Episode yang masuk penyebut kepatuhan (tepat + lebih awal + terlambat + belum terbit). */
  dinilai: number;
  perStatus: Record<StatusPulang, number>;
  /** % terbit di hari pulang dari yang dinilai (0–100, 1 desimal); null bila tak ada yang dinilai. */
  kepatuhan: number | null;
  /** Belum terbit dengan tanggal pulang = hari ini (masih bisa diterbitkan tepat waktu). */
  belumHariIni: number;
  /** Tidak wajib karena kontrol pasca rawat inap (Surat Kontrol baru tak dapat terbit). */
  pascaRiTidakWajib: number;
};

export function ringkasPulang(eps: readonly EpisodePulang[], hariIni: string): RingkasPulang {
  const perStatus = Object.fromEntries(STATUS_PULANG_KEYS.map((k) => [k, 0])) as Record<StatusPulang, number>;
  let belumHariIni = 0;
  let pascaRiTidakWajib = 0;
  for (const e of eps) {
    perStatus[e.status]++;
    if (e.status === "BELUM_TERBIT" && e.tglPulang === hariIni) belumHariIni++;
    if (e.status === "TIDAK_WAJIB" && e.kontrolPascaRi) pascaRiTidakWajib++;
  }
  const dinilai = STATUS_DINILAI.reduce((n, k) => n + perStatus[k], 0);
  return {
    total: eps.length,
    dinilai,
    perStatus,
    kepatuhan: dinilai ? Math.round((perStatus.TEPAT / dinilai) * 1000) / 10 : null,
    belumHariIni,
    pascaRiTidakWajib,
  };
}

export type HariPulang = { tanggal: string } & Record<(typeof STATUS_DINILAI)[number], number>;

/** Sebaran per tanggal pulang untuk setiap hari di [from, to] (hanya status yang dinilai). */
export function ringkasPulangPerHari(eps: readonly EpisodePulang[], from: string, to: string): HariPulang[] {
  const m = new Map<string, HariPulang>();
  for (let d = from; d <= to; d = tambahHari(d, 1)) m.set(d, { tanggal: d, TEPAT: 0, LEBIH_AWAL: 0, TERLAMBAT: 0, BELUM_TERBIT: 0 });
  for (const e of eps) {
    const r = m.get(e.tglPulang);
    if (r && STATUS_PULANG[e.status].dinilai) r[e.status as (typeof STATUS_DINILAI)[number]]++;
  }
  return [...m.values()];
}

export type RuanganPulang = {
  ruangan: string;
  layanan: LayananPulang;
  total: number;
  dinilai: number;
  tepat: number;
  belum: number;
  /** Terlambat + lebih awal. */
  meleset: number;
};

/** Per ruangan pulang (RI) / poli (RJ), urut belum terbit terbanyak lalu meleset. */
export function ringkasPulangPerRuangan(eps: readonly EpisodePulang[]): RuanganPulang[] {
  const m = new Map<string, RuanganPulang>();
  for (const e of eps) {
    const nama = namaRuangan(e);
    const k = `${e.layanan}|${nama}`;
    const r = m.get(k) ?? { ruangan: nama, layanan: e.layanan, total: 0, dinilai: 0, tepat: 0, belum: 0, meleset: 0 };
    r.total++;
    if (STATUS_PULANG[e.status].dinilai) r.dinilai++;
    if (e.status === "TEPAT") r.tepat++;
    else if (e.status === "BELUM_TERBIT") r.belum++;
    else if (e.status === "TERLAMBAT" || e.status === "LEBIH_AWAL") r.meleset++;
    m.set(k, r);
  }
  return [...m.values()].sort((a, b) => b.belum - a.belum || b.meleset - a.meleset || b.total - a.total || a.ruangan.localeCompare(b.ruangan));
}

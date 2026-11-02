/**
 * Aturan murni BCKH (tanpa DB, aman untuk klien) — tanggal `YYYY-MM-DD` dihitung
 * di UTC agar tak bergeser zona waktu server; "hari ini" dan tanggal pembuatan
 * memakai WITA. Rancangan: docs/PRD_Modul_BCKH.md §6.
 */
import { tanggalHariIniWita } from "@/lib/format";
import { selisihHari, tambahHari } from "@/server/modules/rl32/rl32.periode";
import {
  BATAS_TEPAT_WAKTU_HARI,
  JENDELA_RUTIN_HARI,
  JUMLAH_RUTIN,
  KATEGORI,
  NAMA_BULAN,
  NAMA_HARI,
  STATUS_BEKERJA,
  STATUS_HARI,
  TEKS_LAPORAN_STATUS,
  type Kategori,
  type StatusHari,
  type Target,
} from "./bckh.constants";
import type { BarisLaporan, DasborResult, HariRingkas, KegiatanRutin, RincianLog, Streak } from "./bckh.types";

export { selisihHari, tambahHari };

/* ---------------------------------------------------------------- tanggal */

const RE_TANGGAL = /^(\d{4})-(\d{2})-(\d{2})$/;
const p2 = (n: number) => String(n).padStart(2, "0");

/** Tanggal kalender sah `YYYY-MM-DD` (menolak 2026-02-30). */
export function tanggalSah(ymd: string): boolean {
  const m = RE_TANGGAL.exec(ymd);
  if (!m) return false;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  return d.getUTCFullYear() === +m[1] && d.getUTCMonth() === +m[2] - 1 && d.getUTCDate() === +m[3];
}

/** 0 = Minggu … 6 = Sabtu. */
export const hariDalamMinggu = (ymd: string) => new Date(`${ymd}T00:00:00Z`).getUTCDay();

/** Hari kerja = Senin–Jumat. */
export const adalahHariKerja = (ymd: string) => {
  const h = hariDalamMinggu(ymd);
  return h >= 1 && h <= 5;
};

/** Tanggal WITA (YYYY-MM-DD) dari sebuah waktu. */
export const tanggalWita = (iso: string | Date) => tanggalHariIniWita(new Date(iso));

/** `YYYY-MM` → rentang tanggal bulan itu. */
export function rentangBulanIni(bulan: string): { dari: string; sampai: string } {
  const [y, m] = bulan.split("-").map(Number);
  const akhir = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { dari: `${y}-${p2(m)}-01`, sampai: `${y}-${p2(m)}-${p2(akhir)}` };
}

/** `YYYY-MM` berikutnya. */
export function bulanBerikut(bulan: string): string {
  const [y, m] = bulan.split("-").map(Number);
  return m === 12 ? `${y + 1}-01` : `${y}-${p2(m + 1)}`;
}

/** Batas bawah tanggal catatan: 1 Januari tahun lalu. */
export const tanggalPalingAwal = (hariIni: string) => `${Number(hariIni.slice(0, 4)) - 1}-01-01`;

/** Setiap tanggal dari `dari` s.d. `sampai` (inklusif). */
export function daftarTanggal(dari: string, sampai: string): string[] {
  const hasil: string[] = [];
  for (let t = dari; t <= sampai; t = tambahHari(t, 1)) hasil.push(t);
  return hasil;
}

/** Hari kerja dalam rentang, dipotong di hari ini (hari depan belum wajib diisi). */
export function hariKerjaDalam(dari: string, sampai: string, hariIni: string): string[] {
  const akhir = sampai < hariIni ? sampai : hariIni;
  return akhir < dari ? [] : daftarTanggal(dari, akhir).filter(adalahHariKerja);
}

/** "Senin, 03/11/2025" — format kolom HARI / TANGGAL laporan. */
export function hariTanggal(ymd: string): string {
  const [y, m, d] = ymd.split("-");
  return `${NAMA_HARI[hariDalamMinggu(ymd)]}, ${d}/${m}/${y}`;
}

/** "Senin, 3 November 2025" — format tampilan. */
export function tanggalPanjang(ymd: string): string {
  const [y, m, d] = ymd.split("-").map(Number);
  return `${NAMA_HARI[hariDalamMinggu(ymd)]}, ${d} ${NAMA_BULAN[m - 1]} ${y}`;
}

/** Hari keterlambatan pengisian (> H+BATAS) menurut tanggal WITA saat dibuat; 0 = tepat waktu. */
export function hariTerlambat(tanggal: string, dibuatIso: string): number {
  const selisih = selisihHari(tanggal, tanggalWita(dibuatIso));
  return selisih > BATAS_TEPAT_WAKTU_HARI ? selisih : 0;
}

/* ------------------------------------------------------------------- teks */

/** Buang karakter kontrol, rapatkan spasi, pangkas. */
export function bersihkanTeks(s: string): string {
  return s.replace(/[\u0000-\u001f\u007f-\u009f]/g, " ").replace(/\s+/g, " ").trim();
}

/** Kunci pembanding uraian (huruf kecil, spasi tunggal). */
export const kunciUraian = (s: string) => bersihkanTeks(s).toLocaleLowerCase("id-ID");

/* --------------------------------------------------------------- laporan */

/** TARGET satu hari: tidak bekerja → null; ada kegiatan berstatus proses → PROSES; selain itu SELESAI. */
export function targetHari(status: StatusHari, kegiatan: { target: Target }[]): Target | null {
  if (!STATUS_BEKERJA.has(status)) return null;
  return kegiatan.some((k) => k.target === "PROSES") ? "PROSES" : "SELESAI";
}

/** Baris tabel Laporan Kinerja Harian — urut tanggal, bernomor 1..n tanpa celah (PRD §6.1). */
export function barisLaporan(hari: Pick<HariRingkas, "tanggal" | "status" | "keterangan" | "kegiatan">[]): BarisLaporan[] {
  return [...hari]
    .sort((a, b) => a.tanggal.localeCompare(b.tanggal))
    .map((h, i) => {
      const teksStatus = TEKS_LAPORAN_STATUS[h.status];
      const bekerja = STATUS_BEKERJA.has(h.status);
      const catatan = bekerja
        ? [...(teksStatus ? [teksStatus] : []), ...h.kegiatan.map((k) => k.uraian)]
        : [teksStatus];
      return {
        no: i + 1,
        tanggal: h.tanggal,
        hariTanggal: hariTanggal(h.tanggal),
        catatan,
        target: targetHari(h.status, h.kegiatan),
        ket: h.keterangan || (bekerja ? "" : teksStatus),
      };
    });
}

/* ------------------------------------------------------------ grafik/profil */

/** Kuartil jumlah kegiatan hari berkegiatan → ambang tingkat 1..4 (seperti GitHub). */
export function ambangTingkat(jumlah: number[]): [number, number, number] {
  const isi = jumlah.filter((n) => n > 0).sort((a, b) => a - b);
  if (isi.length === 0) return [1, 2, 3];
  const q = (p: number) => isi[Math.min(isi.length - 1, Math.floor(p * (isi.length - 1)))];
  const a1 = q(0.25);
  const a2 = Math.max(q(0.5), a1 + 1);
  const a3 = Math.max(q(0.75), a2 + 1);
  return [a1, a2, a3];
}

/** Tingkat warna 0..4: 0 = tanpa kegiatan; ≤ ambang[0] → 1; ≤ [1] → 2; ≤ [2] → 3; lebih → 4. */
export function tingkat(n: number, ambang: readonly [number, number, number]): 0 | 1 | 2 | 3 | 4 {
  if (n <= 0) return 0;
  if (n <= ambang[0]) return 1;
  if (n <= ambang[1]) return 2;
  if (n <= ambang[2]) return 3;
  return 4;
}

/**
 * Rangkaian hari kerja terisi. Mundur dari hari ini: hari ini belum terisi tidak
 * memutus; hari kerja tanpa catatan memutus; akhir pekan tanpa catatan dilewati;
 * catatan apa pun (termasuk Off) menyambung.
 */
export function hitungStreak(tercatat: ReadonlySet<string>, hariIni: string): Streak {
  const urut = [...tercatat].filter((t) => t <= hariIni).sort();
  if (urut.length === 0) return { sekarang: 0, terpanjang: 0 };

  // Terpanjang: jelajahi dari catatan pertama s.d. hari ini.
  let terpanjang = 0;
  let jalan = 0;
  for (let t = urut[0]; t <= hariIni; t = tambahHari(t, 1)) {
    if (tercatat.has(t)) jalan++;
    else if (adalahHariKerja(t) && t !== hariIni) jalan = 0;
    terpanjang = Math.max(terpanjang, jalan);
  }

  let sekarang = 0;
  for (let t = hariIni; t >= urut[0]; t = tambahHari(t, -1)) {
    if (tercatat.has(t)) sekarang++;
    else if (adalahHariKerja(t) && t !== hariIni) break;
  }
  return { sekarang, terpanjang };
}

/** Uraian tersering dalam jendela 90 hari (kategori = yang terakhir dipakai). */
export function kegiatanRutin(
  hari: Pick<HariRingkas, "tanggal" | "kegiatan">[],
  hariIni: string,
  jumlah = JUMLAH_RUTIN,
): KegiatanRutin[] {
  const batas = tambahHari(hariIni, -JENDELA_RUTIN_HARI);
  const peta = new Map<string, KegiatanRutin & { terakhir: string }>();
  for (const h of hari) {
    if (h.tanggal < batas || h.tanggal > hariIni) continue;
    for (const k of h.kegiatan) {
      const kunci = kunciUraian(k.uraian);
      if (!kunci) continue;
      const ada = peta.get(kunci);
      if (!ada) peta.set(kunci, { uraian: k.uraian, kategori: k.kategori, n: 1, terakhir: h.tanggal });
      else {
        ada.n++;
        if (h.tanggal >= ada.terakhir) Object.assign(ada, { uraian: k.uraian, kategori: k.kategori, terakhir: h.tanggal });
      }
    }
  }
  return [...peta.values()]
    .sort((a, b) => b.n - a.n || b.terakhir.localeCompare(a.terakhir) || a.uraian.localeCompare(b.uraian))
    .slice(0, jumlah)
    .map(({ uraian, kategori, n }) => ({ uraian, kategori, n }));
}

/* -------------------------------------------------------------- log diff */

type KegiatanBanding = { id?: string | null; uraian: string; kategori: Kategori; target: Target };

/** Ringkasan perubahan satu catatan (untuk log pengisian). `lama` null = catatan baru. */
export function ringkasPerubahan(
  lama: { status: StatusHari; keterangan: string; kegiatan: (KegiatanBanding & { id: string })[] } | null,
  baru: { status: StatusHari; keterangan: string; kegiatan: KegiatanBanding[] },
): RincianLog {
  const idLama = new Map((lama?.kegiatan ?? []).map((k) => [k.id, k]));
  const ditambah = baru.kegiatan.filter((k) => !k.id || !idLama.has(k.id));
  const dipertahankan = baru.kegiatan.filter((k) => k.id && idLama.has(k.id));
  const idBaru = new Set(dipertahankan.map((k) => k.id));
  const dihapus = (lama?.kegiatan ?? []).filter((k) => !idBaru.has(k.id));
  const diubah = dipertahankan.filter((k) => {
    const l = idLama.get(k.id!)!;
    return l.uraian !== k.uraian || l.kategori !== k.kategori || l.target !== k.target;
  });
  const urutLama = (lama?.kegiatan ?? []).filter((k) => idBaru.has(k.id)).map((k) => k.id);
  const urutan = urutLama.join() !== dipertahankan.map((k) => k.id).join();

  const r: RincianLog = { kegiatan: baru.kegiatan.length };
  if (!lama || lama.status !== baru.status) r.status = { dari: lama?.status ?? null, ke: baru.status };
  if (ditambah.length) {
    r.tambah = ditambah.length;
    r.contoh = ditambah.slice(0, 3).map((k) => k.uraian.slice(0, 80));
  }
  if (diubah.length) r.ubah = diubah.length;
  if (dihapus.length) r.hapus = dihapus.length;
  if (urutan) r.urutan = true;
  if (lama && lama.keterangan !== baru.keterangan) r.keterangan = true;
  return r;
}

/** Ada perubahan nyata? (simpan tanpa perubahan tidak menulis log). */
export const adaPerubahan = (r: RincianLog) =>
  !!(r.status || r.tambah || r.ubah || r.hapus || r.urutan || r.keterangan);

/* ------------------------------------------------------------------ dasbor */

/** Metrik dasbor persentase untuk rentang (PRD §6.5). Hari di luar rentang diabaikan. */
export function hitungDasbor(hari: HariRingkas[], dari: string, sampai: string, hariIni: string): DasborResult {
  const dalam = hari.filter((h) => h.tanggal >= dari && h.tanggal <= sampai);
  const tercatat = new Set(dalam.map((h) => h.tanggal));
  const kerja = hariKerjaDalam(dari, sampai, hariIni);

  const perKategori = new Map<Kategori, number>();
  const perStatus = new Map<StatusHari, number>();
  const perUraian = new Map<string, { uraian: string; kategori: Kategori; n: number }>();
  const perBulan = new Map<string, { kegiatan: number; hari: number }>();
  const perHari = Array.from({ length: 7 }, () => ({ kegiatan: 0, hari: 0 }));
  let kegiatan = 0;
  let selesai = 0;
  let tepat = 0;

  for (const h of dalam) {
    perStatus.set(h.status, (perStatus.get(h.status) ?? 0) + 1);
    if (hariTerlambat(h.tanggal, h.dibuat) === 0) tepat++;
    const b = perBulan.get(h.tanggal.slice(0, 7)) ?? { kegiatan: 0, hari: 0 };
    b.hari++;
    b.kegiatan += h.kegiatan.length;
    perBulan.set(h.tanggal.slice(0, 7), b);
    if (STATUS_BEKERJA.has(h.status)) {
      const hm = perHari[hariDalamMinggu(h.tanggal)];
      hm.hari++;
      hm.kegiatan += h.kegiatan.length;
    }
    for (const k of h.kegiatan) {
      kegiatan++;
      if (k.target === "SELESAI") selesai++;
      perKategori.set(k.kategori, (perKategori.get(k.kategori) ?? 0) + 1);
      const kunci = kunciUraian(k.uraian);
      const u = perUraian.get(kunci);
      if (u) u.n++;
      else perUraian.set(kunci, { uraian: k.uraian, kategori: k.kategori, n: 1 });
    }
  }

  // Bulan tanpa catatan tetap tampil (sumbu kontinu).
  const bulanUrut: string[] = [];
  for (let b = dari.slice(0, 7); b <= sampai.slice(0, 7); b = bulanBerikut(b)) bulanUrut.push(b);

  return {
    periode: { dari, sampai },
    kegiatan,
    selesai,
    proses: kegiatan - selesai,
    hariTercatat: dalam.length,
    hariKerja: kerja.length,
    hariKerjaTerisi: kerja.filter((t) => tercatat.has(t)).length,
    tepatWaktu: tepat,
    perKategori: KATEGORI.filter((k) => perKategori.has(k)).map((k) => ({ kategori: k, n: perKategori.get(k)! })),
    perStatus: STATUS_HARI.filter((s) => perStatus.has(s)).map((s) => ({ status: s, n: perStatus.get(s)! })),
    teratas: [...perUraian.values()].sort((a, b) => b.n - a.n || a.uraian.localeCompare(b.uraian)).slice(0, 8),
    perBulan: bulanUrut.map((bulan) => ({ bulan, ...(perBulan.get(bulan) ?? { kegiatan: 0, hari: 0 }) })),
    perHariMinggu: perHari.map((x, hari) => ({
      hari,
      rata: x.hari ? Math.round((x.kegiatan / x.hari) * 10) / 10 : 0,
      hariBekerja: x.hari,
    })),
  };
}

/** Persen bulat; penyebut 0 → null (tampil "—"). */
export const persen = (a: number, b: number): number | null => (b > 0 ? Math.round((a / b) * 100) : null);

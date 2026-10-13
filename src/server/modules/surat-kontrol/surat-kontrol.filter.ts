/**
 * Saring & ringkas baris audit — FUNGSI MURNI, dipakai layar (klien, instan
 * tanpa memanggil BPJS ulang) DAN ekspor (server) agar isi berkas = tampilan.
 */
import {
  RENTANG_MAKS_HARI,
  STATUS_AUDIT_KEYS,
  TEMUAN_KEYS,
  type StatusAudit,
  type TemuanKey,
} from "./surat-kontrol.constants";
import type { SuratKontrolBaris } from "./surat-kontrol.types";

export type FilterTampilan = {
  status?: StatusAudit;
  temuan?: TemuanKey;
  /** Nama poli tampilan (`baris.poli`). */
  poli?: string;
  /** Satu tanggal acuan (`baris.tglAcuan`) — dari klik grafik sebaran harian. */
  tanggal?: string;
  /** Cari: nomor surat / SEP / kartu / RM / nama pasien / dokter. */
  q?: string;
};

const norm = (s: string) => s.toLocaleLowerCase("id-ID").normalize("NFKD").replace(/[̀-ͯ]/g, "");

export function cocokCari(b: SuratKontrolBaris, q: string): boolean {
  const k = norm(q.trim());
  if (!k) return true;
  const ladang = [
    b.noSurat,
    b.bpjs?.sepAsal,
    b.bpjs?.noKartu,
    b.simrs?.nomor,
    b.simrs?.kunjungan?.norm,
    b.simrs?.kunjungan?.nopen,
    b.pasien,
    b.dokter,
  ];
  return ladang.some((v) => !!v && norm(v).includes(k));
}

export function saringBaris(baris: readonly SuratKontrolBaris[], f: FilterTampilan): SuratKontrolBaris[] {
  return baris.filter(
    (b) =>
      (!f.status || b.status === f.status) &&
      (!f.temuan || b.temuan.includes(f.temuan)) &&
      (!f.poli || b.poli === f.poli) &&
      (!f.tanggal || b.tglAcuan === f.tanggal) &&
      (!f.q || cocokCari(b, f.q)),
  );
}

const BOBOT: Record<StatusAudit, number> = { MASALAH: 0, TINJAU: 1, SESUAI: 2 };

/** Urutan bawaan: status terberat dulu, lalu tanggal acuan, lalu nomor surat. */
export function urutkanBaris(baris: SuratKontrolBaris[]): SuratKontrolBaris[] {
  return baris.sort(
    (a, b) => BOBOT[a.status] - BOBOT[b.status] || a.tglAcuan.localeCompare(b.tglAcuan) || a.key.localeCompare(b.key),
  );
}

export type Ringkasan = {
  total: number;
  perStatus: Record<StatusAudit, number>;
  perTemuan: Record<TemuanKey, number>;
  /** Persentase baris berstatus SESUAI (0–100), null bila kosong. */
  kesesuaian: number | null;
};

export function ringkas(baris: readonly SuratKontrolBaris[]): Ringkasan {
  const perStatus = Object.fromEntries(STATUS_AUDIT_KEYS.map((k) => [k, 0])) as Record<StatusAudit, number>;
  const perTemuan = Object.fromEntries(TEMUAN_KEYS.map((k) => [k, 0])) as Record<TemuanKey, number>;
  for (const b of baris) {
    perStatus[b.status]++;
    for (const t of b.temuan) perTemuan[t]++;
  }
  return {
    total: baris.length,
    perStatus,
    perTemuan,
    kesesuaian: baris.length ? Math.round((perStatus.SESUAI / baris.length) * 1000) / 10 : null,
  };
}

export type PoliRingkas = { poli: string; total: number; masalah: number; tinjau: number };

/** Per poli tujuan, urut jumlah temuan (masalah + tinjau) terbanyak. */
export function ringkasPerPoli(baris: readonly SuratKontrolBaris[]): PoliRingkas[] {
  const m = new Map<string, PoliRingkas>();
  for (const b of baris) {
    const k = b.poli ?? "Tanpa poli";
    const r = m.get(k) ?? { poli: k, total: 0, masalah: 0, tinjau: 0 };
    r.total++;
    if (b.status === "MASALAH") r.masalah++;
    else if (b.status === "TINJAU") r.tinjau++;
    m.set(k, r);
  }
  return [...m.values()].sort((a, b) => b.masalah + b.tinjau - (a.masalah + a.tinjau) || b.total - a.total || a.poli.localeCompare(b.poli));
}

export type HariRingkas = { tanggal: string; masalah: number; tinjau: number; sesuai: number };

/** Sebaran per tanggal acuan untuk setiap hari di [from, to] (hari kosong = 0). */
export function ringkasPerHari(baris: readonly SuratKontrolBaris[], from: string, to: string): HariRingkas[] {
  const m = new Map<string, HariRingkas>();
  for (let d = from; d <= to; d = tambahHari(d, 1)) m.set(d, { tanggal: d, masalah: 0, tinjau: 0, sesuai: 0 });
  for (const b of baris) {
    const r = m.get(b.tglAcuan);
    if (!r) continue;
    if (b.status === "MASALAH") r.masalah++;
    else if (b.status === "TINJAU") r.tinjau++;
    else r.sesuai++;
  }
  return [...m.values()];
}

/**
 * Jaga rentang tetap sah setelah satu ujung diubah di layar: ujung lain digeser
 * agar from ≤ to, lebar ≤ RENTANG_MAKS_HARI, dan to ≤ batas tanggal depan.
 */
export function jepitRentang(from: string, to: string, diubah: "from" | "to", batasDepan: string): [string, string] {
  const lebar = RENTANG_MAKS_HARI - 1;
  if (diubah === "from") {
    let t = to;
    if (t < from) t = from;
    if (t > tambahHari(from, lebar)) t = tambahHari(from, lebar);
    if (t > batasDepan) t = batasDepan;
    return [from > t ? t : from, t];
  }
  const t = to > batasDepan ? batasDepan : to;
  let f = from;
  if (f > t) f = t;
  if (f < tambahHari(t, -lebar)) f = tambahHari(t, -lebar);
  return [f, t];
}

/** Rentang inklusif terlebar yang diterima VClaim per permintaan (lebih → HTTP 412, kode 201). */
export const POTONGAN_BPJS_HARI = 30;

/** Pecah [from, to] menjadi potongan ≤ 30 hari (inklusif), berurutan. */
export function potongRentang(from: string, to: string): [string, string][] {
  const out: [string, string][] = [];
  for (let a = from; a <= to; a = tambahHari(a, POTONGAN_BPJS_HARI)) {
    const b = tambahHari(a, POTONGAN_BPJS_HARI - 1);
    out.push([a, b < to ? b : to]);
  }
  return out;
}

export function tambahHari(iso: string, n: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

import "server-only";
import { SELANG_DETAK_MS } from "@/features/form-rm/ttd-siaga/sse";
import {
  frameIsian,
  MAKS_ALIRAN_PENGGUNA,
  MAKS_ALIRAN_TOTAL,
  MAKS_HADIR,
  potongKolom,
  UMUR_ALIRAN_MS,
  type AwalAliran,
  type OrangHadir,
  type UnitAliran,
} from "@/features/form-rm/aliran-isian";
import type { StatusIsian } from "@/features/form-rm/isian.status";
import { ServiceUnavailableError, TooManyRequestsError } from "@/server/lib/errors";

/**
 * HUB ALIRAN ISIAN form berlanjut IGD → RI (PRD Berlanjut §8.5): pola hub TTD
 * siaga — memori proses di `globalThis` (dibagi semua route handler satu
 * proses, tahan HMR dev), satu proses produksi; bila kelak multi-instance,
 * antarmuka kecil ini diganti pub/sub (Redis).
 *
 * - Event TANPA nilai kolom (`berubah` hanya path + siapa/unit/ruang/jam).
 * - Siaran hanya dipanggil SETELAH commit (pemanggil: service isian).
 * - Batas: 8 aliran per pengguna (429), 400 total (503), umur 10 menit lalu
 *   `segarkan` + tutup (sambung ulang memeriksa sesi & hak lagi), detak 20 dtk,
 *   antrean macet 64 KB → putus (penulis aliran).
 * - `hadir` disusun PER PENERIMA: tanpa dirinya sendiri, tanpa id pengguna,
 *   satu baris per (pengguna, unit).
 */

export type KoneksiIsian = {
  readonly seq: number;
  readonly isianId: string;
  readonly userId: string;
  readonly nama: string;
  /** NOPEN episode tempat isian dibuka (anggota rantai, divalidasi saat sambung). */
  readonly konteks: string;
  readonly unit: UnitAliran;
  readonly ruang: string | null;
  readonly mulai: number;
  /** Tulis frame; false = koneksi sudah mati / macet. */
  kirim: (teks: string) => boolean;
  tutup: () => void;
};

type Status = {
  isian: Map<string, Map<number, KoneksiIsian>>;
  pengguna: Map<string, number>;
  total: number;
  seq: number;
  detak: ReturnType<typeof setInterval> | null;
  umur: Map<number, ReturnType<typeof setTimeout>>;
  /** Siaran `hadir` yang dijadwalkan per isian (digabung — gelombang sambung ulang tak membanjiri). */
  hadirTunda: Map<string, ReturnType<typeof setTimeout>>;
};

/** Jeda penggabungan siaran `hadir` per isian. */
const JEDA_HADIR_MS = 300;

const g = globalThis as unknown as { __formRmIsianHub?: Status };
const st: Status = (g.__formRmIsianHub ??= {
  isian: new Map(),
  pengguna: new Map(),
  total: 0,
  seq: 0,
  detak: null,
  umur: new Map(),
  hadirTunda: new Map(),
});

const DETAK = frameIsian("detak", {});
const SEGARKAN = frameIsian("segarkan", {});

function lepasInternal(k: KoneksiIsian): boolean {
  const set = st.isian.get(k.isianId);
  if (!set?.delete(k.seq)) return false;
  if (set.size === 0) st.isian.delete(k.isianId);
  const n = (st.pengguna.get(k.userId) ?? 1) - 1;
  if (n > 0) st.pengguna.set(k.userId, n);
  else st.pengguna.delete(k.userId);
  st.total = Math.max(0, st.total - 1);
  const t = st.umur.get(k.seq);
  if (t) clearTimeout(t);
  st.umur.delete(k.seq);
  if (st.total === 0 && st.detak) {
    clearInterval(st.detak);
    st.detak = null;
  }
  return true;
}

/** Lepas + tutup aliran (frame `akhir` dikirim lebih dulu bila ada), lalu kabari yang lain. */
function putus(k: KoneksiIsian, akhir?: string): void {
  if (akhir) k.kirim(akhir);
  const dilepas = lepasInternal(k);
  k.tutup();
  if (dilepas) jadwalHadir(k.isianId);
}

function kirimKe(k: KoneksiIsian, teks: string): void {
  if (!k.kirim(teks)) putus(k);
}

function siarkan(isianId: string, teks: string): void {
  const set = st.isian.get(isianId);
  if (!set) return;
  for (const k of [...set.values()]) kirimKe(k, teks);
}

/** Orang lain yang membuka isian (urut waktu sambung), tanpa penerima sendiri. */
function daftarHadir(isianId: string, penerima: string): OrangHadir[] {
  const daftar: OrangHadir[] = [];
  const dilihat = new Set<string>();
  for (const k of st.isian.get(isianId)?.values() ?? []) {
    if (k.userId === penerima) continue;
    const kunci = `${k.userId}\u0000${k.unit}`;
    if (dilihat.has(kunci)) continue;
    dilihat.add(kunci);
    daftar.push({ nama: k.nama, unit: k.unit, ruang: k.ruang });
    if (daftar.length >= MAKS_HADIR) break;
  }
  return daftar;
}

const frameHadir = (k: KoneksiIsian) => frameIsian("hadir", { daftar: daftarHadir(k.isianId, k.userId) });

/** Siarkan `hadir` ke semua aliran isian ini — digabung per JEDA_HADIR_MS. */
function jadwalHadir(isianId: string): void {
  if (st.hadirTunda.has(isianId)) return;
  const t = setTimeout(() => {
    st.hadirTunda.delete(isianId);
    const set = st.isian.get(isianId);
    if (set) for (const k of [...set.values()]) kirimKe(k, frameHadir(k));
  }, JEDA_HADIR_MS);
  t.unref?.();
  st.hadirTunda.set(isianId, t);
}

function pastikanDetak(): void {
  if (st.detak) return;
  st.detak = setInterval(() => {
    for (const set of [...st.isian.values()]) for (const k of [...set.values()]) kirimKe(k, DETAK);
  }, SELANG_DETAK_MS);
  st.detak.unref?.();
}

export const hubIsian = {
  /** Masih ada ruang untuk aliran baru pengguna ini? Tidak → 429 / 503 (sebelum aliran dibuka). */
  periksaRuang(userId: string): void {
    if ((st.pengguna.get(userId) ?? 0) >= MAKS_ALIRAN_PENGGUNA) throw new TooManyRequestsError(30);
    if (st.total >= MAKS_ALIRAN_TOTAL) throw new ServiceUnavailableError("Server sedang penuh. Pembaruan langsung disambung ulang nanti.");
  },

  /**
   * Daftarkan aliran: kirim `awal` (rev & status terkini), jadwalkan umur
   * maksimum, lalu siarkan `hadir` ke semua yang membuka isian ini.
   * Sinkron — dipanggil dari `start` ReadableStream tepat setelah `periksaRuang`.
   */
  sambung(
    a: Omit<KoneksiIsian, "seq" | "mulai">,
    awal: AwalAliran,
  ): KoneksiIsian {
    const k: KoneksiIsian = { ...a, seq: ++st.seq, mulai: Date.now() };
    let set = st.isian.get(a.isianId);
    if (!set) st.isian.set(a.isianId, (set = new Map()));
    set.set(k.seq, k);
    st.pengguna.set(a.userId, (st.pengguna.get(a.userId) ?? 0) + 1);
    st.total++;
    const umur = setTimeout(() => putus(k, SEGARKAN), UMUR_ALIRAN_MS);
    umur.unref?.();
    st.umur.set(k.seq, umur);
    pastikanDetak();
    kirimKe(k, frameIsian("awal", awal));
    // Aliran baru langsung tahu siapa saja yang membuka; yang lain dikabari (digabung).
    kirimKe(k, frameHadir(k));
    jadwalHadir(a.isianId);
    return k;
  },

  /** Klien putus. Tak berefek bila aliran sudah dilepas. */
  lepas(k: KoneksiIsian): void {
    if (lepasInternal(k)) jadwalHadir(k.isianId);
  },

  /** Isi isian berubah (setelah commit). `kolom` = path yang berubah, TANPA nilai. */
  berubah(
    isianId: string,
    e: { rev: number; oleh: string; unit: UnitAliran; ruang: string | null; kolom: readonly string[]; waktu: Date },
  ): void {
    if (!st.isian.has(isianId)) return;
    siarkan(
      isianId,
      frameIsian("berubah", { rev: e.rev, oleh: e.oleh, unit: e.unit, ruang: e.ruang, ...potongKolom(e.kolom), waktu: e.waktu.toISOString() }),
    );
  },

  /** Status isian berubah (FINAL / DRAF / BATAL), setelah commit. */
  status(isianId: string, e: { rev: number; status: StatusIsian; oleh: string }): void {
    if (!st.isian.has(isianId)) return;
    siarkan(isianId, frameIsian("status", e));
  },

  /** Episode tak lagi anggota rantai (tautan dilepas) → aliran berkonteks itu disegarkan & ditutup. */
  putuskanKonteks(nopen: string): void {
    for (const set of [...st.isian.values()]) for (const k of [...set.values()]) if (k.konteks === nopen) putus(k, SEGARKAN);
  },

  /** Jumlah aliran (uji & pemantauan). */
  jumlah(): { total: number; isian: number } {
    return { total: st.total, isian: st.isian.size };
  },
};

/* ------------------------------------------- siaran dari service (setelah commit) */

type BarisSiar = { id: string; rev: number; status: string; updatedAt: Date };

/** Isi berubah: path kolom + siapa/unit/ruang/jam (TANPA nilai). Kosong → tidak disiarkan. */
export function siarkanBerubah(
  baris: BarisSiar,
  aktor: { nama: string },
  konteks: { unit: UnitAliran; ruang: string | null },
  perubahan: readonly { p: string }[],
): void {
  if (perubahan.length === 0) return;
  hubIsian.berubah(baris.id, {
    rev: baris.rev,
    oleh: aktor.nama,
    unit: konteks.unit,
    ruang: konteks.ruang,
    kolom: perubahan.map((x) => x.p),
    waktu: baris.updatedAt,
  });
}

/** Status berubah (FINALKAN / BUKA_KOREKSI / BATALKAN). */
export function siarkanStatus(baris: BarisSiar, aktor: { nama: string }): void {
  if (baris.status !== "DRAF" && baris.status !== "FINAL" && baris.status !== "BATAL") return;
  hubIsian.status(baris.id, { rev: baris.rev, status: baris.status, oleh: aktor.nama });
}

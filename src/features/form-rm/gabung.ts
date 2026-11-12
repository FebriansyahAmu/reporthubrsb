import { samaNilai } from "./asal";

/**
 * GABUNG PER KOLOM — isian berlanjut IGD → RI (docs/PRD_Form_RM_Berlanjut_IGD_RI.md
 * §8.3, §8.6). Murni & aman untuk klien: dipakai klien (beda dasar → lokal,
 * rebase, konflik) dan server (gabung tiga arah di dalam transaksi berkunci).
 *
 * DAUN = satuan gabung: nilai primitif, larik primitif (digabung utuh), atau
 * larik objek yang panjangnya berbeda. Objek ditelusuri per kunci; larik objek
 * berpanjang sama ditelusuri per indeks (mis. `entries.2.edukatorNama`).
 *
 * Klien & server membandingkan isian dalam BENTUK yang sama (`bentukIsian`):
 * kunci yang hilang dilengkapi dari `kosong()` dan baris tetap dilengkapi
 * `lengkapi` registri — path kolom di kedua sisi selalu sama.
 */

export const MAKS_UBAH = 500;
const MAKS_PANJANG_PATH = 160;
const MAKS_SEGMEN = 8;
const SEGMEN_NAMA = /^[A-Za-z][A-Za-z0-9]{0,40}$/;
const SEGMEN_INDEKS = /^(0|[1-9][0-9]{0,2})$/;
const TERLARANG = new Set(["__proto__", "prototype", "constructor"]);

type Objek = Record<string, unknown>;
const objekBiasa = (v: unknown): v is Objek => v !== null && typeof v === "object" && !Array.isArray(v);

/** Segmen path kolom yang aman; null = path ditolak (prototipe tak pernah bisa dicapai). */
export function segmenPath(p: unknown): string[] | null {
  if (typeof p !== "string" || p.length === 0 || p.length > MAKS_PANJANG_PATH) return null;
  const s = p.split(".");
  if (s.length > MAKS_SEGMEN || !SEGMEN_NAMA.test(s[0])) return null;
  for (const x of s) {
    if (TERLARANG.has(x) || !(SEGMEN_NAMA.test(x) || SEGMEN_INDEKS.test(x))) return null;
  }
  return s;
}

/** Kunci objek hanya segmen nama; indeks hanya untuk larik (dan harus dalam batas). */
function langkah(o: unknown, k: string): { ada: true; nilai: unknown } | { ada: false } {
  if (Array.isArray(o)) {
    if (!SEGMEN_INDEKS.test(k)) return { ada: false };
    const i = Number(k);
    return i < o.length ? { ada: true, nilai: o[i] } : { ada: false };
  }
  if (objekBiasa(o) && SEGMEN_NAMA.test(k) && Object.hasOwn(o, k)) return { ada: true, nilai: o[k] };
  return { ada: false };
}

/** Nilai di `p` + apakah path itu ada (properti milik sendiri saja). */
export function ambilDi(akar: unknown, p: string): { ada: true; nilai: unknown } | { ada: false } {
  const s = segmenPath(p);
  if (!s) return { ada: false };
  let o: unknown = akar;
  for (const k of s) {
    const r = langkah(o, k);
    if (!r.ada) return r;
    o = r.nilai;
  }
  return { ada: true, nilai: o };
}

export const nilaiDi = (akar: unknown, p: string): unknown => {
  const r = ambilDi(akar, p);
  return r.ada ? r.nilai : undefined;
};

/** Ganti nilai di path yang SUDAH ADA (mutasi). Tak pernah membuat kunci/indeks baru. */
export function pasangDi(akar: unknown, p: string, nilai: unknown): boolean {
  const s = segmenPath(p);
  if (!s) return false;
  let o: unknown = akar;
  for (const k of s.slice(0, -1)) {
    const r = langkah(o, k);
    if (!r.ada) return false;
    o = r.nilai;
  }
  const akhir = s[s.length - 1];
  if (!langkah(o, akhir).ada) return false;
  if (Array.isArray(o)) o[Number(akhir)] = nilai;
  else (o as Objek)[akhir] = nilai;
  return true;
}

/** `p` dan `q` menyentuh kolom yang sama: sama, atau salah satunya leluhur yang lain. */
export const tumpang = (p: string, q: string): boolean =>
  p === q || p.startsWith(`${q}.`) || q.startsWith(`${p}.`);

/* ------------------------------------------------------------------ bentuk */

/** Lengkapi kunci objek yang hilang dari `kosong` (rekursif; larik tidak disentuh). Salinan baru. */
export function lengkapiKunci(data: unknown, kosong: unknown): unknown {
  if (!objekBiasa(data)) return structuredClone(data);
  const hasil: Objek = {};
  for (const [k, v] of Object.entries(data)) hasil[k] = structuredClone(v);
  if (!objekBiasa(kosong)) return hasil;
  for (const [k, v] of Object.entries(kosong)) {
    hasil[k] = Object.hasOwn(hasil, k) ? lengkapiKunci(hasil[k], v) : structuredClone(v);
  }
  return hasil;
}

/** Bagian definisi form yang menentukan bentuk isian. */
export type BentukForm = { kosong(): object; lengkapi?(data: never): object };

/**
 * Bentuk baku isian untuk dibandingkan/digabung: kunci hilang dilengkapi dari
 * `kosong()`, lalu `lengkapi` registri (mis. baris tetap). Salinan baru.
 */
export function bentukIsian<T = unknown>(def: BentukForm, data: unknown): T {
  const lengkap = lengkapiKunci(data, def.kosong());
  return (def.lengkapi ? (def.lengkapi as (d: unknown) => object)(lengkap) : lengkap) as T;
}

/* ------------------------------------------------------------------- beda */

/** Path daun yang nilainya berbeda antara `a` dan `b` (urutan stabil). */
export function daunBeda(a: unknown, b: unknown): string[] {
  const hasil: string[] = [];
  const jalan = (x: unknown, y: unknown, p: string) => {
    if (objekBiasa(x) && objekBiasa(y)) {
      const kunci = [...Object.keys(x), ...Object.keys(y).filter((k) => !Object.hasOwn(x, k))];
      for (const k of kunci) {
        const q = p ? `${p}.${k}` : k;
        if (Object.hasOwn(x, k) && Object.hasOwn(y, k)) jalan(x[k], y[k], q);
        else hasil.push(q);
      }
      return;
    }
    if (
      Array.isArray(x) &&
      Array.isArray(y) &&
      x.length === y.length &&
      x.length > 0 &&
      x.every(objekBiasa) &&
      y.every(objekBiasa)
    ) {
      x.forEach((xi, i) => jalan(xi, y[i], p ? `${p}.${i}` : String(i)));
      return;
    }
    if (!samaNilai(x, y)) hasil.push(p);
  };
  jalan(a, b, "");
  return hasil;
}

/** Satu perubahan kolom yang dikirim klien: path, nilai DASAR yang dilihat klien, nilai baru. */
export type Ubah = { p: string; d: unknown; n: unknown };

/**
 * Perubahan lokal terhadap dasar (keduanya sudah `bentukIsian`). Path di
 * `abaikan` (kolom tertaut SIMRS) tidak pernah dikirim.
 */
export function susunUbah(dasar: unknown, lokal: unknown, abaikan: readonly string[] = []): Ubah[] {
  return daunBeda(dasar, lokal)
    .filter((p) => p !== "" && !abaikan.some((a) => tumpang(a, p)))
    .flatMap((p) => {
      const d = ambilDi(dasar, p);
      const n = ambilDi(lokal, p);
      return d.ada && n.ada ? [{ p, d: d.nilai, n: n.nilai }] : [];
    });
}

/* ------------------------------------------------------------ gabung server */

/** Entri log per kolom: path, nilai sebelum, sesudah; `t` = ditimpa eksplisit (TIMPA). */
export type Perubahan = { p: string; s: unknown; j: unknown; t?: true };

export type HasilGabung =
  | { jenis: "galat"; pesan: string }
  | { jenis: "konflik"; konflik: { p: string; mereka: unknown }[] }
  | { jenis: "ok"; data: unknown; diterapkan: Perubahan[] };

/**
 * Gabung tiga arah per kolom (PRD §8.3 langkah 3–4) atas `sekarang` (bentuk
 * baku, dibaca dari baris yang DIKUNCI). Per ubah, nilai sekarang `c`:
 * `c ≡ d` → pasang `n`; `c ≡ n` → tidak berubah; selain itu → konflik. Ada
 * konflik → tidak ada yang diterapkan (klien merebase sekali dengan utuh).
 * Path harus aman, ada pada bentuk isian, unik, dan tidak saling tumpang;
 * path `abaikan` (tertaut SIMRS) dilewati. Tidak memutasi `sekarang`.
 */
export function gabungkan(
  sekarang: unknown,
  ubah: readonly Ubah[],
  opsi: { abaikan?: readonly string[]; timpa?: ReadonlySet<string> } = {},
): HasilGabung {
  if (ubah.length > MAKS_UBAH) return { jenis: "galat", pesan: `Paling banyak ${MAKS_UBAH} perubahan per simpan` };
  const dilihat = new Set<string>();
  for (const u of ubah) {
    if (!segmenPath(u.p)) return { jenis: "galat", pesan: "Path kolom tidak valid" };
    const ada = ambilDi(sekarang, u.p);
    // Hanya DAUN (primitif / larik): objek selalu ditelusuri per kunci oleh klien.
    if (!ada.ada || objekBiasa(ada.nilai)) return { jenis: "galat", pesan: "Kolom tidak dikenal pada formulir ini" };
    if (dilihat.has(u.p)) return { jenis: "galat", pesan: "Kolom yang sama dikirim lebih dari sekali" };
    dilihat.add(u.p);
  }
  for (const p of dilihat) {
    for (const q of dilihat) if (q.startsWith(`${p}.`)) return { jenis: "galat", pesan: "Perubahan kolom saling tumpang" };
  }

  const abaikan = opsi.abaikan ?? [];
  const data = structuredClone(sekarang);
  const diterapkan: Perubahan[] = [];
  const konflik: { p: string; mereka: unknown }[] = [];
  for (const u of ubah) {
    if (abaikan.some((a) => tumpang(a, u.p))) continue;
    const c = nilaiDi(sekarang, u.p);
    if (samaNilai(c, u.d)) {
      if (samaNilai(c, u.n)) continue;
      pasangDi(data, u.p, structuredClone(u.n));
      diterapkan.push({ p: u.p, s: c, j: u.n, ...(opsi.timpa?.has(u.p) ? { t: true as const } : {}) });
    } else if (!samaNilai(c, u.n)) {
      konflik.push({ p: u.p, mereka: c });
    }
  }
  if (konflik.length > 0) return { jenis: "konflik", konflik };
  return { jenis: "ok", data, diterapkan };
}

/* ------------------------------------------------------------- rebase klien */

export type HasilRebase<T> = {
  /** Isi server + perubahan lokal yang belum tersimpan. */
  lokal: T;
  /**
   * Dasar baru = isi server, KECUALI kolom bentrok yang tetap memakai dasar lama
   * — simpan berikutnya mengirim dasar lama itu sehingga server menjawab konflik
   * (tidak pernah menimpa perubahan orang lain diam-diam).
   */
  dasar: T;
  /** Kolom yang diubah lokal DAN di server dengan nilai berbeda. */
  bentrok: string[];
};

/** Path terpanjang awalan `p` yang ada di semua objek (null bila tak ada). */
function naikBersama(p: string, ...objek: unknown[]): string | null {
  const s = segmenPath(p);
  if (!s) return null;
  for (let i = s.length; i > 0; i--) {
    const q = s.slice(0, i).join(".");
    if (objek.every((o) => ambilDi(o, q).ada)) return q;
  }
  return null;
}

/**
 * Pindahkan perubahan lokal (`dasar` → `lokal`) ke atas isi server terbaru
 * (PRD §8.6). Kolom yang hanya diubah lokal tetap milik lokal; yang hanya
 * diubah server ikut server; diubah keduanya dengan nilai sama → selesai;
 * berbeda → bentrok (lokal dipertahankan di layar, dasar lama dipertahankan).
 */
export function rebase<T>(dasar: T, lokal: T, server: T): HasilRebase<T> {
  const L = daunBeda(dasar, lokal).filter((p) => p !== "");
  if (L.length === 0) return { lokal: structuredClone(server), dasar: structuredClone(server), bentrok: [] };
  const S = daunBeda(dasar, server).filter((p) => p !== "");
  const R = structuredClone(server);
  const D = structuredClone(server);
  const bentrok: string[] = [];
  for (const p of L) {
    const q = S.filter((s) => tumpang(p, s));
    if (q.length === 0) {
      if (!pasangDi(R, p, structuredClone(nilaiDi(lokal, p)))) {
        // Struktur berubah di server (larik beda panjang): gabung di leluhur bersama.
        const u = naikBersama(p, R, lokal, dasar);
        if (u && !samaNilai(nilaiDi(lokal, u), nilaiDi(R, u))) {
          pasangDi(R, u, structuredClone(nilaiDi(lokal, u)));
          pasangDi(D, u, structuredClone(nilaiDi(dasar, u)));
          if (!bentrok.some((b) => tumpang(b, u))) bentrok.push(u);
        }
      }
      continue;
    }
    // Area bersama = path terpendek (leluhur semua path yang tumpang).
    let u = [p, ...q].reduce((a, b) => (b.length < a.length ? b : a));
    if (bentrok.some((b) => tumpang(b, u))) continue;
    if (!ambilDi(R, u).ada || !ambilDi(lokal, u).ada || !ambilDi(dasar, u).ada) {
      const naik = naikBersama(u, R, lokal, dasar);
      if (!naik) continue;
      u = naik;
    }
    const milikLokal = nilaiDi(lokal, u);
    if (samaNilai(milikLokal, nilaiDi(server, u))) continue; // keduanya mengubah ke nilai yang sama
    pasangDi(R, u, structuredClone(milikLokal));
    pasangDi(D, u, structuredClone(nilaiDi(dasar, u)));
    bentrok.push(u);
  }
  return { lokal: R, dasar: D, bentrok };
}

/** Salinan `akar` dengan nilai `p` diganti (path harus ada). */
export function denganNilai<T>(akar: T, p: string, nilai: unknown): T {
  const salinan = structuredClone(akar);
  pasangDi(salinan, p, structuredClone(nilai));
  return salinan;
}

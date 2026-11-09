/**
 * Kode pasang perangkat TTD siaga (docs/PRD_TTD_Perangkat_Siaga.md §7.6).
 * Murni (tanpa node:crypto) agar teruji unit dan bisa dipakai klien; sumber
 * acak & fungsi hash disuntikkan oleh server.
 *
 * - 8 karakter dari 31 simbol tanpa yang mirip (0/O, 1/I/L) ≈ 39,6 bit.
 * - Sekali pakai, 10 menit, satu kode aktif per perangkat.
 * - Disimpan sebagai hash; kode mentah hanya tampil sekali di layar pengelola.
 */

export const ALFABET_KODE = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
export const PANJANG_KODE = 8;
export const UMUR_KODE_MS = 10 * 60_000;

/** Batas bawah byte acak yang ditolak agar tak ada bias modulo (31 × 8 = 248). */
const BATAS_BYTE = Math.floor(256 / ALFABET_KODE.length) * ALFABET_KODE.length;

/** Kode baru dari sumber acak kriptografis (`acak(n)` → n byte). Rejection sampling. */
export function buatKode(acak: (n: number) => Uint8Array): string {
  let kode = "";
  while (kode.length < PANJANG_KODE) {
    for (const b of acak(PANJANG_KODE * 2)) {
      if (b >= BATAS_BYTE) continue;
      kode += ALFABET_KODE[b % ALFABET_KODE.length];
      if (kode.length === PANJANG_KODE) break;
    }
  }
  return kode;
}

/** Tampilan "XXXX-XXXX" (kode sudah ternormalkan). */
export const formatKode = (kode: string): string => `${kode.slice(0, 4)}-${kode.slice(4)}`;

/**
 * Masukan pengguna → kode ternormalkan, atau null bila mustahil sah.
 * Spasi & tanda hubung dibuang, huruf dibesarkan. Karakter di luar alfabet
 * (termasuk 0/O/1/I/L) → null, bukan ditebak — kode salah ketik ditolak utuh.
 */
export function normalkanKode(masuk: unknown): string | null {
  if (typeof masuk !== "string" || masuk.length > 32) return null;
  const k = masuk.replace(/[\s-]/g, "").toUpperCase();
  if (k.length !== PANJANG_KODE) return null;
  for (const c of k) if (!ALFABET_KODE.includes(c)) return null;
  return k;
}

type EntriKode = { perangkatId: string; sampai: number };

export type PenyimpananKode = {
  /** Terbitkan kode baru untuk perangkat; kode lama perangkat itu langsung batal. */
  terbitkan: (perangkatId: string) => { kode: string; sampai: number };
  /** Kedaluwarsa kode aktif perangkat (ms epoch), null bila tak ada. */
  sampaiAktif: (perangkatId: string) => number | null;
  /** Tukar kode (sekali pakai) → perangkatId, atau null bila salah/kedaluwarsa. */
  tukar: (masuk: unknown) => string | null;
  /** Batalkan kode aktif perangkat (mis. perangkat dicabut). */
  batalkan: (perangkatId: string) => void;
  /** Jumlah entri tersimpan (uji & pemantauan). */
  ukuran: () => number;
};

/**
 * Penyimpanan kode pasang di memori. Kunci = hash kode (kode mentah tak
 * disimpan). Entri kedaluwarsa dibuang di setiap operasi.
 */
export function buatPenyimpananKode(opsi: {
  acak: (n: number) => Uint8Array;
  hash: (s: string) => string;
  jam?: () => number;
  umurMs?: number;
}): PenyimpananKode {
  const { acak, hash, jam = Date.now, umurMs = UMUR_KODE_MS } = opsi;
  const perHash = new Map<string, EntriKode>();
  const perPerangkat = new Map<string, string>();

  const buang = (h: string) => {
    const e = perHash.get(h);
    perHash.delete(h);
    if (e && perPerangkat.get(e.perangkatId) === h) perPerangkat.delete(e.perangkatId);
  };
  const sapu = (sekarang: number) => {
    for (const [h, e] of perHash) if (sekarang >= e.sampai) buang(h);
  };

  return {
    terbitkan(perangkatId) {
      const sekarang = jam();
      sapu(sekarang);
      const lama = perPerangkat.get(perangkatId);
      if (lama) buang(lama);
      let kode = buatKode(acak);
      while (perHash.has(hash(kode))) kode = buatKode(acak);
      const sampai = sekarang + umurMs;
      const h = hash(kode);
      perHash.set(h, { perangkatId, sampai });
      perPerangkat.set(perangkatId, h);
      return { kode, sampai };
    },
    sampaiAktif(perangkatId) {
      sapu(jam());
      const h = perPerangkat.get(perangkatId);
      return h ? (perHash.get(h)?.sampai ?? null) : null;
    },
    tukar(masuk) {
      const sekarang = jam();
      sapu(sekarang);
      const kode = normalkanKode(masuk);
      if (!kode) return null;
      const h = hash(kode);
      const e = perHash.get(h);
      if (!e) return null;
      buang(h);
      return e.perangkatId;
    },
    batalkan(perangkatId) {
      const h = perPerangkat.get(perangkatId);
      if (h) buang(h);
    },
    ukuran: () => perHash.size,
  };
}

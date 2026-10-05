/**
 * Pembatas laju jendela-tetap di memori proses (proxy Next 16 = runtime
 * Node.js, satu proses per container → cukup tanpa Redis). Murni & tanpa
 * dependensi agar mudah diuji; jam bisa disuntikkan.
 *
 * Memori dibatasi `maksKunci`: entri kedaluwarsa dibuang dulu, lalu yang
 * tertua (Map menjaga urutan sisip) — banjir IP palsu tak bisa menghabiskan RAM.
 */

export type HasilLaju = { izin: true } | { izin: false; ulangDetik: number };

export type PembatasLaju = (kunci: string, sekarang?: number) => HasilLaju;

export function buatPembatasLaju(opsi: { batas: number; jendelaMs: number; maksKunci?: number }): PembatasLaju {
  const { batas, jendelaMs, maksKunci = 10_000 } = opsi;
  const ember = new Map<string, { mulai: number; jumlah: number }>();

  const rapikan = (sekarang: number) => {
    for (const [k, e] of ember) if (sekarang - e.mulai >= jendelaMs) ember.delete(k);
    for (const k of ember.keys()) {
      if (ember.size < maksKunci) break;
      ember.delete(k);
    }
  };

  return (kunci, sekarang = Date.now()) => {
    let e = ember.get(kunci);
    if (!e || sekarang - e.mulai >= jendelaMs) {
      if (!e && ember.size >= maksKunci) rapikan(sekarang);
      e = { mulai: sekarang, jumlah: 0 };
      ember.set(kunci, e);
    }
    e.jumlah++;
    if (e.jumlah <= batas) return { izin: true };
    return { izin: false, ulangDetik: Math.max(1, Math.ceil((e.mulai + jendelaMs - sekarang) / 1000)) };
  };
}

/**
 * Kunci IP klien untuk pembatasan laju. Produksi: container hanya terbuka ke
 * 127.0.0.1 di balik reverse proxy, jadi header di bawah diisi proxy itu:
 * 1. `X-Real-IP` — reverse proxy MENIMPA nilainya (`proxy_set_header
 *    X-Real-IP $remote_addr`), jadi tak bisa dikarang klien;
 * 2. entri PALING KANAN `X-Forwarded-For` — yang ditambahkan hop terakhir
 *    (entri kiri bisa dikarang klien). Catatan: tanpa reverse proxy, Next
 *    sendiri mengisi XFF dengan alamat socket.
 * Bila header dipalsukan pun, pembatas global tetap membatasi beban total.
 */
export function kunciIpKlien(headers: Headers): string {
  const kanan = headers.get("x-forwarded-for")?.split(",").map((s) => s.trim()).filter(Boolean).at(-1);
  return (headers.get("x-real-ip")?.trim() || kanan || "tanpa-ip").slice(0, 64);
}

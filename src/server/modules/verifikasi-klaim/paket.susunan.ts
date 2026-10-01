/**
 * Logika susunan Paket Klaim — MURNI & aman untuk client (tanpa I/O). Dipakai
 * editor susunan (UI) dan server (validasi & butir nonaktif) agar keduanya
 * sepakat tentang urutan bawaan dan kapan paket "berubah sejak digabung".
 */
import type { ItemSusunan, KomponenPaket, LampiranItem, PaketInfo } from "./verifikasi.types";

export type BarisSusunan = ItemSusunan & { aktif: boolean };

/** Kunci unik butir susunan. */
export const kunciItem = (i: ItemSusunan): string => (i.tipe === "komponen" ? `k:${i.key}` : `l:${i.id}`);

const inti = (i: ItemSusunan): ItemSusunan => (i.tipe === "komponen" ? { tipe: "komponen", key: i.key } : { tipe: "lampiran", id: i.id });

/**
 * Susunan awal editor: urutan paket terakhir (butir yang digabung, lalu yang
 * sengaja dinonaktifkan), kemudian komponen / sisipan BARU (belum pernah
 * digabung) — aktif, di akhir — dengan urutan bawaan registri & urutan unggah.
 * Butir yang tak lagi tersedia (komponen hilang di SIMRS, sisipan dihapus) dibuang.
 */
export function susunanAwal(
  komponen: readonly KomponenPaket[],
  lampiran: readonly LampiranItem[],
  paket: Pick<PaketInfo, "manifest"> | null,
): BarisSusunan[] {
  const ada = new Set([
    ...komponen.filter((k) => k.tersedia).map((k) => kunciItem({ tipe: "komponen", key: k.key })),
    ...lampiran.map((l) => kunciItem({ tipe: "lampiran", id: l.id })),
  ]);
  const out: BarisSusunan[] = [];
  const dipakai = new Set<string>();
  const tambah = (i: ItemSusunan, aktif: boolean) => {
    const k = kunciItem(i);
    if (!ada.has(k) || dipakai.has(k)) return;
    dipakai.add(k);
    out.push({ ...inti(i), aktif });
  };
  if (paket) {
    for (const i of paket.manifest.items) tambah(i, true);
    for (const i of paket.manifest.nonaktif) tambah(i, false);
  }
  for (const k of komponen) if (k.tersedia) tambah({ tipe: "komponen", key: k.key }, true);
  for (const l of lampiran) tambah({ tipe: "lampiran", id: l.id }, true);
  return out;
}

/**
 * Pertahankan susunan hasil edit pengguna saat data dimuat ulang (unggah /
 * hapus sisipan): butir yang masih ada tetap di posisi & status aktifnya,
 * butir yang hilang dibuang, butir baru ditambahkan di akhir (urutan `awal`).
 */
export function selaraskan(edit: readonly BarisSusunan[], awal: readonly BarisSusunan[]): BarisSusunan[] {
  const ada = new Set(awal.map(kunciItem));
  const tetap = edit.filter((b) => ada.has(kunciItem(b)));
  const sudah = new Set(tetap.map(kunciItem));
  return [...tetap, ...awal.filter((b) => !sudah.has(kunciItem(b)))];
}

/** Butir aktif sesuai urutan — isi permintaan gabung. */
export const susunanAktif = (baris: readonly BarisSusunan[]): ItemSusunan[] => baris.filter((b) => b.aktif).map(inti);

/** Dua susunan identik (urutan & isi)? */
export function samaSusunan(a: readonly ItemSusunan[], b: readonly ItemSusunan[]): boolean {
  return a.length === b.length && a.every((x, i) => kunciItem(x) === kunciItem(b[i]));
}

/** Pindahkan butir `dari` ke posisi `ke` (seret-lepas / tombol naik-turun). */
export function pindah<T>(xs: readonly T[], dari: number, ke: number): T[] {
  if (dari === ke || dari < 0 || ke < 0 || dari >= xs.length || ke >= xs.length) return [...xs];
  const out = [...xs];
  const [x] = out.splice(dari, 1);
  out.splice(ke, 0, x);
  return out;
}

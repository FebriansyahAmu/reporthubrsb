/**
 * TTD TERSIMPAN MILIK PETUGAS ("tanda tangan saya") — konstanta & aturan murni
 * bersama klien dan server. Satu TTD & satu paraf per pengguna; hanya pemiliknya
 * yang bisa memakai. Saat dipakai, gambarnya disalin ke isian sebagai TTD baru,
 * jadi rekam medis tidak ikut berubah bila TTD tersimpan diganti atau dihapus.
 */

export const JENIS_TTD_SAYA = ["TTD", "PARAF"] as const;
export type JenisTtdSaya = (typeof JENIS_TTD_SAYA)[number];

export const LABEL_JENIS_TTD_SAYA: Record<JenisTtdSaya, string> = {
  TTD: "tanda tangan",
  PARAF: "paraf",
};

export type ItemTtdSaya = { dataUrl: string; diperbarui: string };

/** Respons GET /api/form-rm/ttd-saya. `nama` = nama lengkap bergelar pengguna login. */
export type DataTtdSaya = {
  nama: string;
  item: Partial<Record<JenisTtdSaya, ItemTtdSaya>>;
};

const rapikan = (s: string) => s.trim().replace(/\s+/g, " ").toLowerCase();

/** Nama sama tanpa membedakan huruf besar/kecil & spasi berlebih; kosong ≠ apa pun. */
export const namaSama = (a: string, b: string) => rapikan(a) !== "" && rapikan(a) === rapikan(b);

/**
 * Nama slot setelah TTD dibubuhkan.
 * - `saya` = TTD tersimpan milik pengguna dipakai → nama slot = nama pengguna (TTD & nama
 *   selalu satu orang).
 * - TTD baru (gambar/unggah/kamera/HP) di slot petugas bernama kosong → nama pengguna login.
 * - Selain itu nama tidak disentuh (tetap bisa diketik manual).
 */
export function namaSetelahTtd(o: { nama: string; namaPengguna: string; saya: boolean; isiOtomatis: boolean }): string {
  if (!o.namaPengguna.trim()) return o.nama;
  if (o.saya) return o.namaPengguna;
  if (o.isiOtomatis && o.nama.trim() === "") return o.namaPengguna;
  return o.nama;
}

/**
 * "Simpan sebagai TTD saya" hanya ditawarkan bila nama slot kosong atau sama dengan
 * nama pengguna — mencegah TTD orang lain (mis. dokter yang menandatangani di PC
 * perawat) tersimpan sebagai milik pengguna login.
 */
export const bolehSimpanSebagaiSaya = (namaSlot: string, namaPengguna: string) =>
  namaPengguna.trim() !== "" && (namaSlot.trim() === "" || namaSama(namaSlot, namaPengguna));

/**
 * Pilihan ruangan awal di Checklist Pemeliharaan (murni — mudah diuji).
 *
 * Urutan:
 * 1. `?ruangan=` di URL (ID atau kode prefix, tanpa beda huruf besar/kecil);
 * 2. ruangan terakhir dipakai di peramban ini — hanya bila termasuk "Ruangan
 *    saya", atau akun belum dipetakan ke ruangan mana pun (mis. admin);
 * 3. "Ruangan saya" pertama;
 * 4. kosong (pengguna memilih sendiri).
 * Hanya ruangan aktif (ada di `ruangan`) yang bisa terpilih.
 */
export function pilihRuanganAwal(
  refs: { ruangan: { id: string; kodePrefix: string }[]; ruanganSaya: string[] },
  sumber: { dariUrl: string | null; terakhir: string | null },
): string {
  const aktif = new Set(refs.ruangan.map((r) => r.id));
  const saya = refs.ruanganSaya.filter((id) => aktif.has(id));

  const url = sumber.dariUrl?.trim();
  if (url) {
    if (aktif.has(url)) return url;
    const kode = url.toLowerCase();
    const byKode = refs.ruangan.find((r) => r.kodePrefix.toLowerCase() === kode);
    if (byKode) return byKode.id;
  }

  const t = sumber.terakhir;
  if (t && aktif.has(t) && (saya.length === 0 || saya.includes(t))) return t;

  return saya[0] ?? "";
}

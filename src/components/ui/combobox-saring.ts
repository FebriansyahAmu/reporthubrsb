/** Penyaringan & peringkat opsi Combobox (murni — diuji unit). */

export type ComboboxOption = {
  value: string;
  label: string;
  /** Kode pendek di depan label (mis. kode prefix ruangan) — ikut dicari. */
  badge?: string;
  /** Keterangan kecil di kanan (mis. "Petugas") — ikut dicari. */
  hint?: string;
};
export type ComboboxGroup = { label: string; options: ComboboxOption[] };

/** Lipat huruf: kecil + tanpa diakritik (é → e). Panjang teks NFC tetap. */
export const lipat = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
export const pecah = (q: string) => lipat(q).split(/\s+/).filter(Boolean);

const teksCari = (o: ComboboxOption) => lipat(`${o.badge ?? ""} ${o.label} ${o.hint ?? ""}`);

/** Nilai yang tampil di input untuk opsi terpilih. */
export const tampilOpsi = (o: ComboboxOption) => (o.badge ? `${o.badge} — ${o.label}` : o.label);

/**
 * Saring per kelompok: semua kata harus muncul (urutan bebas). Peringkat dalam
 * kelompok: kode/label diawali kata pertama → awal kata → di tengah; urutan asal
 * dipertahankan untuk peringkat sama. Kelompok kosong dibuang.
 */
export function saring(groups: ComboboxGroup[], query: string): ComboboxGroup[] {
  const kata = pecah(query);
  if (kata.length === 0) return groups.filter((g) => g.options.length > 0);
  const [pertama] = kata;
  const out: ComboboxGroup[] = [];
  for (const g of groups) {
    const cocok: { o: ComboboxOption; rank: number; i: number }[] = [];
    g.options.forEach((o, i) => {
      const t = teksCari(o);
      if (!kata.every((k) => t.includes(k))) return;
      const badge = lipat(o.badge ?? "");
      const label = lipat(o.label);
      const rank =
        badge.startsWith(pertama) || label.startsWith(pertama)
          ? 0
          : new RegExp(`(^|[^a-z0-9])${pertama.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`).test(t)
            ? 1
            : 2;
      cocok.push({ o, rank, i });
    });
    if (cocok.length) {
      cocok.sort((a, b) => a.rank - b.rank || a.i - b.i);
      out.push({ label: g.label, options: cocok.map((c) => c.o) });
    }
  }
  return out;
}

# RM.04 Triase IGD — tampilan pengisian (redesign 19 Nov 2026)

Hanya **layar pengisian** yang berubah. Bagian berikut tidak berubah:
- cetak (`TriaseDocument`, F4 potret);
- skema data dan path kolom;
- 74 ID kriteria (`<kategori><aspek><urut>`, tersimpan di data);
- aturan kategori (`hitungKategori`) dan saran TTV (`saranTtv`, hanya saran);
- isi otomatis SIMRS (kriteria & kesadaran tidak pernah diisi otomatis).

## Masalah pada tampilan lama

| # | Masalah | Akibat |
|---|---|---|
| 1 | Navigasi 5 "chip" bergeser di ponsel tanpa `aria-current`; status "selesai" dihitung di layar, terpisah dari syarat FINAL server. | Posisi tidak jelas; "selesai" di layar ≠ syarat finalisasi. |
| 2 | 74 kriteria memakai tombol `role="checkbox"`; GCS, cara datang, kasus, dan kegawatan memakai tombol `role="radio"`; kecelakaan memakai `aria-pressed`; DOA memakai sakelar. | Perilaku keyboard dan pembaca layar tidak seperti kontrol asli; nama "Bebas" ganda di empat kategori. |
| 3 | Di bawah 1280 px, pemeriksaan memakai tab per kategori (tanpa navigasi panah). | Petugas harus bolak-balik 5 tab untuk menilai satu aspek (A-B-C-D). |
| 4 | Input tanda vital hanya ber-`aria-label`; peringatan salah ketik tidak terhubung ke kolomnya. | Label tidak tampak; pembaca layar tidak tahu kolom mana yang salah. |
| 5 | Kekurangan syarat FINAL tidak bisa diklik ke kolomnya. | Petugas mencari sendiri yang kurang. |

## Tampilan baru

`TataLetakLangkah` (navigasi langkah lengket + panel **Syarat finalisasi**), 5 langkah:
1. **Kedatangan** — waktu (pintasan **Sekarang**) dan cara datang (radio asli; "Lain-lain" membuka kolom berlabel).
2. **Jenis kasus** — kasus (radio), kecelakaan (checkbox; memilih kecelakaan menandai Trauma), DOA (checkbox asli + pukul DOA).
3. **Tanda-tanda vital** — 6 kolom berlabel tampak (satuan dibaca pembaca layar). Salah ketik → `aria-invalid` + pesan via `aria-describedby`. Saran kategori dari ambang formulir tampil di bawah angka.
4. **Pemeriksaan** — matriks = **satu `<table>` semantik** (baris = aspek, kolom = kategori):
   - wadah kartu ≥ 48rem: tabel 1:1 seperti kertas, kepala kolom lengket (xl), baris waktu respon & observasi menyorot kategori hasil;
   - wadah lebih sempit: **bertumpuk per aspek** (A-B-C-Kesadaran-D-Catatan) dengan nama kategori di tiap sel, pil sentuh ≥ 44 px.
   - Kriteria = checkbox asli (nama unik "… — Kategori n"), kesadaran = 5 radio satu grup + "Kosongkan pilihan", saran TTV ditandai "TTV" (dibaca pembaca layar beserta alasannya). Hasil kategori diumumkan lewat live region.
5. **Hasil & tanda tangan** — panel hasil, status kegawatan (radio), kotak petugas (waktu triase + **Sekarang**, nama, TTD dengan status).

## Catatan teknis

- **Syarat FINAL sumber tunggal:** `SYARAT_FINAL_TRIASE` + `kekuranganTriase` di `triase.constants.ts` dipakai registri server dan panel layar. `ringkasLangkahTriase` menghitung status/ringkasan/kekurangan tiap langkah. Unit: `triase.test.ts`.
- **Satu set kontrol:** tabel yang sama menjadi tabel atau tumpukan lewat `@container` (`@3xl:table…`), bukan dua struktur DOM. Dengan begitu id kriteria unik (`rm04-k-<id>`) dan state tidak ganda.
- **Gotcha CSS (berlaku untuk seluruh aplikasi):** `globals.css` punya `* { border-color: var(--border) }` **tanpa layer**. Aturan tak berlapis mengalahkan semua utilitas Tailwind (berlapis), sehingga 361 kelas warna bingkai di 151 berkas (`border-brand`, `has-checked:border-*`, `border-l-success` toast, `border-danger` Select tidak valid, …) tidak pernah berlaku. Aturan itu kini dipindah ke `@layer base`: elemen tanpa kelas warna tetap memakai `--border`, sedangkan kelas warna akhirnya tampil sesuai yang ditulis.

## Verifikasi

Diuji ke dev server :3000, tanpa build produksi karena RAM laptop terbatas.

- **Unit:** form-rm 420/420 (9 baru: syarat sumber tunggal, status langkah).
- **UI RM.04:** 59/59, mencakup:
  - desktop 1440 (tabel), tablet 768 dan ponsel 390/360 (bertumpuk, sentuh);
  - kontrol asli, nama unik, Spasi pada checkbox;
  - saran TTV dan "Centang semua";
  - syarat → fokus kolom, TTD digambar;
  - baca-saja, cetak, tanpa galat konsol/CSP.
- Data uji dibersihkan terarah (prefiks `zz_e2e_rm04ui`). SIMGOS hanya dibaca. Tangkapan layar disamarkan lalu dihapus.

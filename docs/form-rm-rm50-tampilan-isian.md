# RM.50 Monitoring Pemberian Transfusi Darah — tampilan pengisian (redesign 20 Nov 2026)

Hanya **layar pengisian** yang berubah. Bagian berikut tidak berubah:
- cetak (`Rm50Document`, F4 lanskap 2 halaman, 23 baris kantong);
- skema data dan path kolom (`kantong[].ttv.<fase>.<kolom>`, id baris kantong);
- aturan paraf (`cekParafRm50`) dan teks syarat FINAL;
- isi otomatis SIMRS (ruang, dokter, alergi, golongan darah).

## Masalah pada tampilan lama

| # | Masalah | Akibat |
|---|---|---|
| 1 | Navigasi chip lama (`NavAlur`) dan ringkasan kekurangan di bawah halaman tanpa tautan ke kolom. | Petugas mencari sendiri kolom yang kurang, termasuk di kartu kantong yang tertutup. |
| 2 | Alergi, riwayat transfusi, golongan ABO/Rh, dan keadaan kantong memakai tombol `role="radio"`. | Perilaku keyboard (panah) & pembaca layar tidak seperti radio asli; grup tanpa `legend`. |
| 3 | Tombol buka/tutup kartu kantong ada di dalam wilayah isian yang terkunci. | Pengamat (baca-saja) tidak bisa membuka kartu kantong; tidak ada heading per kantong. |
| 4 | Sel tanda vital yang formatnya salah (mis. `120/`, `3,7`) tidak ditandai. | Skema server menolak → **seluruh** isian gagal tersimpan tanpa petunjuk sel mana yang salah. |
| 5 | Hapus kantong menghilangkan fokus (tombolnya ikut terhapus). | Pengguna keyboard/pembaca layar "terlempar" ke awal halaman. |

## Tampilan baru

`TataLetakLangkah` (navigasi langkah lengket + panel **Syarat finalisasi**), 4 langkah:
1. **Data transfusi** — tanggal & jam (pintasan **Sekarang**), ruang rawat, dokter; pengingat "Catatan" 1–4 (tercetak di halaman 2).
2. **Riwayat & golongan darah** — alergi & pernah transfusi (radio asli + kolom bersyarat), tahun ditandai salah bila sesudah tahun transfusi; golongan = 4 radio ABO + 3 radio rhesus (aktif setelah ABO dipilih).
3. **Penerimaan kantong** — utuh / tidak utuh (kartu radio asli) + keterangan; tanggal & jam diterima (+ peringatan bila sesudah jam transfusi).
4. **Monitoring per kantong** — satu kartu per kantong:
   - akordeon ber-heading (`h3 > button[aria-expanded]`), tombolnya di luar wilayah terkunci; **Buka/Tutup semua kantong**; kantong tampil sebagai sub-bagian di navigasi samping;
   - identitas kantong (urutan kolom kertas), lalu **tabel tanda vital** (baris = 4 waktu ukur, kolom = TD · N · R · S): wadah ≥ 36rem tabel seperti kertas, lebih sempit tiap waktu jadi kartu 2 × 2 berlabel;
   - reaksi (+ pintasan "Tidak ada reaksi") dan kotak paraf (nama + TTD, status teks);
   - kaki kartu: kekurangan yang bisa diklik dan "Tutup kantong n" (fokus kembali ke tombol kartu).

## Catatan teknis

- **Syarat FINAL sumber tunggal:** `kekuranganRinciRm50` (pesan + kolom + id baris kantong) di `rm50.constants.ts`; `kekuranganRm50` (dipakai registri server) diturunkan darinya → teks & urutan sama. Unit: `rm50.test.ts`.
- **Fokus ke kolom di kartu tertutup:** `SyaratFinal` & `KakiLangkah` (bersama) kini menerima prop `fokus` opsional (bawaan `fokusKe`). RM.50 membuka kartunya dengan `flushSync` lalu memfokuskan kolom.
- **Format TTV:** `ttvSalahFormat` = pola yang sama dengan skema server. Sel ditandai `aria-invalid` + pesan via `aria-describedby` **setelah ditinggalkan** (tidak saat diketik), diumumkan lewat satu live region sopan; lencana "n TTV salah format" di kepala kartu.
- **Tambah/hapus kantong:** kantong baru mewarisi jenis darah & nama petugas, kartunya terbuka dan fokus ke "Tanggal/jam mulai"; setelah hapus, fokus pindah ke kartu sebelah (atau tombol Tambah).
- `KolomWaktu` (tanggal & jam + "Sekarang") dipindah ke `isian/langkah/bagian.tsx`, dipakai RM.04 & RM.50.
- **Gotcha:** `caption` yang ber-`display:block` di dalam tabel ber-`display:table` terbungkus menjadi sel anonim (tampil di bawah kepala kolom) → mode tabel memakai `table-caption`. Radio di dalam `fieldset disabled` tetap `.disabled === false` — periksa dengan `:disabled`.

## Verifikasi

Diuji ke dev server :3000, tanpa build produksi karena RAM laptop terbatas.

- **Unit:** form-rm 425/425 (5 baru: syarat sumber tunggal, kolom tujuan, tahun, status kantong, format TTV = skema).
- **UI RM.50:** 75/75, mencakup:
  - desktop 1440 (tabel TTV, caption di atas kepala kolom), tablet 768 (tabel), ponsel 390/360 (bertumpuk, sentuh ≥ 44 px, tanpa gulir-x);
  - radio asli + panah keyboard (ABO), format TTV salah → ditandai → dibetulkan;
  - syarat → membuka kartu tertutup & fokus kolom, tambah/hapus kantong dengan pengelolaan fokus, paraf digambar;
  - baca-saja (kartu tetap bisa dibuka, isi terkunci), cetak, tanpa galat konsol/CSP.
- **Regresi UI RM.04:** 59/59 (komponen bersama `KolomWaktu`, `SyaratFinal`, `KakiLangkah`).
- Data uji dibersihkan terarah (prefiks `zz_e2e_rm50ui`). SIMGOS hanya dibaca. Tangkapan layar disamarkan lalu dihapus.

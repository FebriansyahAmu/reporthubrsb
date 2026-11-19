# RM.21 Edukasi Pasien & Keluarga Terintegrasi — tampilan pengisian (redesign 19 Nov 2026)

Branch `feat/form-rm-edukasi-ui` (bertumpu pada `feat/form-rm-consent-ui`). Hanya
**layar pengisian** yang berubah. Cetak (`EdukasiDocument`,
`/print/form-rm/isian/[id]`), skema data, path kolom, simpan gabung per kolom,
penanda SIMRS, log perubahan, dan tanda tangan tidak berubah.

## Masalah pada tampilan lama

| # | Masalah | Akibat |
|---|---|---|
| 1 | Semua pilihan berupa "chip" tombol yang sama, baik pilihan tunggal (pendidikan, penerjemah) maupun ganda (bahasa, hambatan). | Petugas tidak tahu apakah boleh memilih lebih dari satu. Kolom tidak dikelompokkan dengan `fieldset`/`legend`. |
| 2 | Kategori edukasi diaktifkan lewat sakelar visual di dalam tombol besar tanpa status yang terbaca pembaca layar. | Status aktif/tidak hanya terlihat dari warna. |
| 3 | Kolom wajib untuk Finalkan (nama edukator, tanggal & jam, tanda tangan sasaran per kategori yang aktif) tidak ditandai. | Kekurangan baru diketahui saat dialog Finalkan menolak. |
| 4 | Halaman panjang (5 kategori × ±13 kolom) tanpa navigasi atau status per kategori. | Sulit tahu kategori mana yang belum lengkap. |
| 5 | Topik tiap kategori terpotong satu baris; kolom "Lain-lain" tanpa label; "Tidak Ada" hambatan bisa dicentang bersama hambatan lain; tanggal re-edukasi selalu tampil. | Membingungkan dan rawan isian yang saling bertentangan. |

## Tampilan baru

Tiga langkah:

1. **Persiapan edukasi.** Identitas pasien (baca-saja) lalu 7 kelompok isian:
   - **Checkbox asli** untuk pilihan ganda, ditandai "(boleh lebih dari satu)": bahasa, tipe pembelajaran, hambatan.
   - **Radio asli** untuk pilihan tunggal: penerjemah, pendidikan, baca & tulis, kesediaan.
   - Kolom **Lainnya** berlabel tampak.
   - Memilih **"Tidak Ada"** melepas hambatan lain, dan sebaliknya.
   - **"Tidak Bersedia"** memunculkan pengingat untuk mencatat alasannya.
2. **Kebutuhan edukasi.** Ringkasan kebutuhan menurut asesmen SIMRS, lalu 5 kartu kategori. Setiap kartu memuat:
   - **Isi kartu:** topik lengkap, lencana **Dibutuhkan menurut SIMRS**, dan kotak **Diberikan** (checkbox).
   - **Rincian** (tampil saat dicentang), dalam kelompok **Pelaksanaan → Penerima edukasi → Metode & sarana → Hasil edukasi → Tanda tangan**.
   - **Pintasan:**
     - "Nama saya" untuk nama edukator dan **Sekarang** untuk tanggal & jam.
     - Durasi cepat 5/10/15/30 menit; kolom durasi hanya menerima angka.
     - Sasaran "Pasien — nama pasien" atau **"Sama dengan {kategori lain}"**, yang menyalin sasaran, nama, dan hubungan.
   - **Kolom bersyarat:**
     - Kolom hubungan disembunyikan bila sasaran = Pasien.
     - Tanggal re-edukasi muncul saat evaluasi "Re-Edukasi" dicentang.
   - **Status:** "n dari 3 syarat terpenuhi" atau **Lengkap**.
   - **Kategori nonaktif yang masih berisi** diberi keterangan bahwa isiannya tersimpan tetapi tidak tercetak.
3. **Catatan & finalisasi.** Catatan tambahan (tinggi mengikuti isi) dan, di layar < 1280 px, panel **Syarat finalisasi**.

**Navigasi langkah** (komponen bersama dengan RM.03):
- **Layar ≥ 1280 px:** kolom samping lengket berisi 3 langkah dan **5 sub-kategori**, masing-masing dengan status ("Dibutuhkan · belum diberikan", "Diberikan · 1 dari 3 syarat"), ditambah panel **Syarat finalisasi**. Butir syarat yang belum terpenuhi memindahkan fokus ke kolomnya; "Minimal satu…" membawa ke kotak "Diberikan" kategori yang dibutuhkan SIMRS.
- **Layar lebih kecil:** bilah lengket berisi 3 langkah. Sub-kategori menyorot langkah 2.
- **Status langkah 3** menunjukkan kesiapan finalisasi ("n dari m syarat terpenuhi"), karena catatannya opsional.
- **Pengguna tanpa izin ubah:** semua kolom dan kotak "Diberikan" terkunci; pintasan dan daftar syarat disembunyikan.

## Catatan teknis

- **Syarat FINAL satu sumber.** `syaratEdukasi` / `syaratKategori` / `kekuranganEdukasi` (`edukasi.constants.ts`) dipakai registri (diperiksa server saat FINALKAN) dan layar. Pesan & urutannya identik dengan aturan lama (`edukasi.test.ts`, termasuk uji kesetaraan semua kombinasi).
- **Komponen langkah bersama:** `src/features/form-rm/isian/langkah/`.
  - `NavLangkah` (sub-langkah, scrollspy).
  - `bagian.tsx`: `TataLetakLangkah`, `BagianLangkah`, `SyaratFinal`, `LabelKolom`, `KolomTeks`, `IsiCepat`.
  - `PilihanRadio` (varian ringkas + penanda SIMRS).
  - `PilihanCentang` (checkbox, opsi eksklusif, `KolomLainnya`).
  - RM.03 kini memakai komponen yang sama.
- **Peringatan build `:target-current` diperbaiki.** Lightning CSS (Next/Turbopack) belum mengenal pseudo-kelas ini dan memberi peringatan "Parsing CSS source code failed" di setiap kompilasi. Penanganannya:
  - Aturan `:target-current` kini dipasang lewat CSSOM (`adoptedStyleSheets`), hanya di peramban yang mendukung `scroll-target-group`.
  - Peramban lain memakai kelas cadangan `.target-current` (IntersectionObserver; bagian terdalam yang terlihat menang).
  - CSSOM tidak dibatasi CSP `style-src`; uji memastikan tanpa galat CSP.
- **Path data tetap.** Mengaktifkan kategori tetap mengisi tanggal & jam otomatis bila kosong (perilaku lama). Kolom durasi hanya menerima angka (sebelumnya `type=number`).

## Verifikasi

- Unit: 752/752 (6 baru untuk RM.21).
- UI RM.21: 66/66, mencakup desktop, ponsel 390/360 px dengan emulasi sentuh, baca-saja, dan cetak.
- UI RM.03 (regresi komponen bersama): 57/57.
- Regresi Form RM: lihat laporan rilis.
- Build produksi :3100 tanpa peringatan CSS. Data uji dibersihkan; SIMGOS hanya dibaca.

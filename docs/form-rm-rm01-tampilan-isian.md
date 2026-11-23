# RM.01 Ringkasan Masuk & Keluar — tampilan pengisian (redesign 23 Nov 2026)

Hanya **layar pengisian** yang berubah. Bagian berikut tidak berubah:
- cetak (`RingkasanDocument`, A4 potret; halaman 2 hanya bila sebab kematian aktif);
- skema data dan path kolom (penting untuk gabung per kolom IGD → rawat inap);
- teks syarat FINAL, kolom tertaut SIMRS (keadaan keluar), isi otomatis SIMRS.

## Masalah pada tampilan lama

| # | Masalah | Akibat |
|---|---|---|
| 1 | Tujuh kartu tanpa navigasi langkah dan tanpa daftar syarat finalisasi. | Petugas tidak tahu posisi dan apa yang masih kurang sebelum FINAL. |
| 2 | Pilihan tunggal (pendidikan, agama, …) memakai tombol `aria-pressed`; imunisasi (pilihan ganda) juga tombol; halaman 2 memakai `role="switch"`. | Bentuk tunggal vs ganda tak terbedakan; keyboard (panah/Spasi) & pembaca layar tidak seperti kontrol asli. |
| 3 | Label tidak terhubung ke kolom (`<label>` tanpa `for`, kolom memakai `aria-label`); kolom "Lain-lain", sebab kematian, dan lama sakit tanpa label. | Klik label tak memfokuskan kolom; beberapa kolom tak bernama bagi pembaca layar. |
| 4 | Lama rawat diketik manual walau tanggal masuk & keluar sudah ada. | Rawan salah hitung. |

## Tampilan baru

`TataLetakLangkah` (navigasi langkah lengket + panel **Syarat finalisasi**), 6 langkah dalam 2 kelompok halaman kertas:

**Halaman 1: ringkasan**
1. **Identitas & keluarga terdekat** — identitas pendaftaran (hanya baca), alamat (textarea), telp (`type="tel"`, tanpa isi otomatis peramban), dirawat ke-, golongan darah, keluarga terdekat.
2. **Data sosial** — pendidikan (+ "Lain-lain" berlabel), bangsa, agama, status perkawinan, pekerjaan: radio asli + "Kosongkan pilihan"; nama & pekerjaan orang tua.
3. **Masuk & perawatan** — cara masuk, jenis pelayanan, tanggal masuk/keluar (+ **Sekarang**), lama rawat (+ isi cepat **Hitung dari tanggal**), diagnosa sementara, DPJP, peserta, izin keluar.
4. **Diagnosa akhir & catatan** — 5 baris diagnosa + kode (ICD-10; operasi ICD-9-CM; kode tanpa koreksi ejaan, huruf kapital), catatan, infeksi nosokomial (+ "Tidak ada"), imunisasi (checkbox asli).
5. **Keadaan keluar & dokter** — keadaan keluar tertaut SIMRS (hanya baca) + kotak tanda tangan dokter yang merawat (isi cepat **DPJP**, "Nama saya").

**Halaman 2: bila meninggal**
6. **Sebab kematian** — checkbox asli "Pasien meninggal" (melepasnya tidak menghapus isian); peringatan bila SIMRS mencatat meninggal tetapi belum dicentang. I.a–c dan II.1–3 (penyakit + lama sakit, teks resmi), keterangan khusus I–IV (radio asli), pemberi keterangan (tanggal + isi cepat **Tanggal keluar**, nama + isi cepat **Dokter yang merawat**, tanda tangan; pakai ulang TTD hanya bila namanya sama).

## Catatan teknis

- **Syarat FINAL sumber tunggal:** `syaratRingkasan` / `kekuranganRingkasan` di `ringkasan.constants.ts` dipakai registri server dan panel layar (teks & urutan pesan tidak berubah). `ringkasLangkahRingkasan` menghitung status, ringkasan, dan `sisa` (angka lencana) tiap langkah. Unit: `ringkasan.test.ts`.
- `hitungLamaRawat` dipindah dari `isian.petakan.ts` ke `ringkasan.constants.ts` (diekspor ulang di petakan) → isi SIMRS dan pintasan layar memakai fungsi yang sama.
- Tanggal keterangan kematian diisi server = hari isian dibuat, jadi pintasan "Tanggal keluar" tetap ditawarkan selama berbeda; "Hari ini" dihitung saat diklik (bukan saat render) agar tak berselisih server/peramban.
- Sakelar halaman 2 = checkbox biasa di kartu berlabel. Atribut HTML `switch` belum didukung Chrome/Edge (WebView2) dan memerlukan polyfill.

## Verifikasi

Diuji ke dev server :3000, tanpa build produksi karena RAM laptop terbatas.

- **Unit:** form-rm + server form-rm 527/527 (8 baru: syarat sumber tunggal, status & sisa langkah, lama rawat satu sumber).
- **UI RM.01:** 62/62, mencakup:
  - 6 langkah 2 kelompok, tanpa `aria-pressed`/`role=switch`, semua kolom berlabel `for` (tanpa `aria-label` penimpa);
  - radio asli + panah (agama), checkbox + Spasi (imunisasi), "Kosongkan pilihan";
  - isi cepat lama rawat/DPJP/tanggal keluar/dokter, syarat → fokus kolom, TTD digambar, halaman 2 aktif → nonaktif (isian tetap) → aktif;
  - tablet 768, ponsel 390/360 (sentuh ≥ 44 px, tanpa gulir-x), baca-saja, cetak hal. 1–2, tanpa galat konsol/CSP.
- Data uji dibersihkan terarah (prefiks `zz_e2e_rm01ui`). SIMGOS hanya dibaca. Tangkapan layar disamarkan lalu dihapus.

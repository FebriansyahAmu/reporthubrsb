# RM.33 Informasi dan Persetujuan / Penundaan & Penolakan Rujukan — tampilan pengisian (redesign 19 Nov 2026)

Branch `feat/form-rm-rm33-ui`, bertumpu pada `feat/form-rm-rm22-ui` (komponen
persetujuan & langkah bersama). Hanya **layar pengisian** yang berubah. Bagian
berikut tidak berubah: cetak (`Rm33Document`, `/print/form-rm/isian/[id]`),
skema data, path kolom, syarat FINAL (`kekuranganRm33`), aturan tanda tangan
terikat keputusan (`cekTtdRm33`), sumber SIMRS `rujukan`, simpan, dan log
perubahan.

## Masalah pada tampilan lama

| # | Masalah | Akibat |
|---|---|---|
| 1 | Navigasi 7 "chip" berlabel dalam satu baris yang harus digeser di ponsel; `aria-current` menandai langkah berikutnya, bukan posisi gulir. | Di ponsel sebagian langkah tersembunyi; posisi tidak jelas. |
| 2 | Keputusan setuju / menunda / menolak memakai tombol `role="radio"` buatan tanpa navigasi tombol panah. | Perilaku keyboard dan pembaca layar tidak seperti radio asli. |
| 3 | Daftar kekurangan di bawah halaman hanya menaut ke kartu langkah. Tujuan, tanggal rujuk, keputusan, dan dokter tidak punya tujuan fokus. | Petugas harus mencari sendiri kolom yang kurang. |
| 4 | Langkah pernyataan tidak menunjukkan tanggal & tujuan rujukan yang ikut tercetak di kalimat. | Petugas tidak sadar kalimat pernyataan memakai data langkah 1. |
| 5 | Saat konfirmasi "Ganti keputusan" muncul atau ditutup, fokus keyboard hilang ke `<body>`. | Pengguna keyboard / pembaca layar kehilangan posisi. |

## Tampilan baru

Tujuh langkah dikelompokkan seperti dua bagian formulir kertas:

- **A. Pemberian informasi**
  1. **Rencana rujukan** — tujuan (faskes + poli) dan tanggal rujuk, bertanda `*` dan penanda SIMRS; pintasan **Rujuk hari ini**.
  2. **Pihak informasi** — dokter pelaksana (perujuk), pemberi informasi / DPJP, penerima.
  3. **Isi informasi** — tabel semantik + Tanda (V) checkbox asli + meter `<progress>`; saran satu klik "Isi: Rujukan ke …" untuk informasi no. 3.
  4. **Tanda tangan informasi** — kotak TTD dengan status "Sudah/Belum ditandatangani".
- **B. Persetujuan / penundaan / penolakan**
  5. **Keputusan pasien** — tiga kartu berisi **radio asli** (setuju hijau, menunda kuning, menolak merah; selalu dengan ikon dan teks). Catatan cetak menyebut lembar yang dipakai dan pilihan yang dicoret.
  6. **Pernyataan** — identitas yang menyatakan, lalu ringkasan "Dengan ini menyatakan [keputusan] untuk rujuk tanggal … ke …" yang diambil dari langkah 1 (tombol **Ubah di langkah 1**), pilihan "terhadap", **Hari ini**, dan pratinjau kalimat. Judul langkah mengikuti keputusan ("Pernyataan persetujuan / penundaan / penolakan rujukan").
  7. **Tanda tangan, dokter & saksi** — terkunci sampai keputusan dipilih; 4 kotak (yang menyatakan, dokter, saksi 1, saksi 2) dalam grid 2 kolom; nama dokter berlabel tampak + saran satu klik.

Kaki tiap kartu memuat kekurangan yang bisa diklik (fokus ke kolomnya) dan tautan **Lanjut: …**. Navigasi, panel **Syarat finalisasi**, dan mode baca-saja sama dengan RM.22 (`TataLetakLangkah`).

**Ganti keputusan** setelah ada tanda tangan pernyataan/dokter/saksi tetap meminta konfirmasi (TTD akan dihapus). Konfirmasi kini memindahkan fokus ke **Batal**, dan setelah ditutup fokus kembali ke radio keputusan yang terpilih. Perubahan ini ada di `KonfirmasiGanti` bersama, sehingga RM.22, RM.41, dan RM.50 ikut membaik.

## Catatan teknis

- **Pesan syarat → kolom:** `persetujuan/tujuan.ts` kini juga memetakan pesan khusus RM.33 (`Tujuan rujukan …` → `rm33-tujuan`, `Tanggal rujuk` → `rm33-tgl-rujuk`, `Keputusan: …` → `rm33-keputusan`, `Nama dokter` → `rm33-dokter`, `Tanda tangan dokter` → `rm33-ttd-dokter`). `tujuan.test.ts` memastikan semua variasi pesan RM.33 punya tujuan.
- **Gotcha Chromium** (lihat dokumen RM.22): wadah `@container` kartu keputusan diletakkan di LUAR fieldset ber-legend.
- `RingkasRujukan` tidak menyimpan apa pun: tanggal dan tujuan tetap satu sumber di langkah 1.
- **Toast:** `useReducedMotion` framer-motion hanya membaca preferensi sekali saat mount, jadi `Toast.tsx` kini memakai `useMediaQuery("(prefers-reduced-motion: reduce)")` yang reaktif.

- `statusLangkahRm33`: nama dokter kini ikut menandai langkah 7 "tersentuh". Nama dokter bisa terisi dari SIMRS, dan sebelumnya kekurangan "Tanda tangan dokter" tidak pernah tampil di kaki langkah.
- Kartu keputusan: ikon sebaris dengan judul agar keterangan mendapat lebar penuh saat tiga kartu sebaris (≥ 48rem container).

## Verifikasi

Diuji ke dev server :3000, tanpa build produksi karena RAM laptop terbatas.

- **Unit:** form-rm 411/411. Yang baru: pemetaan semua pesan RM.33 ke kolom, dan status langkah 7 dengan nama dokter saja.
- **UI RM.33:** 57/57, mencakup:
  - desktop 1440, tablet 768, ponsel 390/360 dengan sentuh;
  - kaki langkah dan syarat → fokus kolom, termasuk pemilih tanggal, fieldset keputusan, dan kotak TTD dokter;
  - TTD dokter digambar lewat kanvas;
  - ganti keputusan dengan keyboard: konfirmasi, fokus ke Batal, fokus kembali ke radio terpilih, lalu TTD dikosongkan;
  - baca-saja, cetak, tanpa galat konsol/CSP.
- **Toast (RM.22):** 27/27, termasuk "gerak dikurangi" yang diubah saat halaman terbuka.
- Data uji dibersihkan terarah (prefiks `zz_e2e_rm33ui`). SIMGOS hanya dibaca. Tangkapan layar disamarkan lalu dihapus.

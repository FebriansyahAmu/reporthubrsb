# RM.22 Informasi dan Persetujuan / Penolakan Tindakan Kedokteran — tampilan pengisian (redesign 19 Nov 2026)

Branch `feat/form-rm-rm22-ui`, bertumpu pada `feat/form-rm-edukasi-ui` (komponen
langkah bersama). Hanya **layar pengisian** yang berubah. Bagian berikut tidak
berubah: cetak (`Rm22Document`, `/print/form-rm/isian/[id]`), skema data, path
kolom, syarat FINAL (`kekuranganRm22`), aturan tanda tangan terikat lembar
(`cekTtdPernyataan`), simpan gabung, penanda SIMRS, dan log perubahan.

## Masalah pada tampilan lama

| # | Masalah | Akibat |
|---|---|---|
| 1 | Navigasi 6 "chip" berlabel dalam satu baris yang harus digeser di ponsel; `aria-current` menandai langkah berikutnya, bukan posisi gulir. | Di ponsel sebagian langkah tersembunyi; posisi tidak jelas. |
| 2 | Keputusan, "terhadap diri/keluarga", dan jenis kelamin memakai tombol `role="radio"` buatan tanpa navigasi tombol panah. Tanda (V) memakai tombol `aria-pressed`. | Perilaku keyboard dan pembaca layar tidak seperti radio/checkbox asli. |
| 3 | Daftar kekurangan hanya menaut ke kartu langkah, bukan ke kolomnya. Kolom wajib tidak bertanda. | Petugas harus mencari sendiri kolom yang kurang di antara 11 baris informasi dan beberapa tanda tangan. |
| 4 | Tabel informasi dibangun dari `div role="table"`. Meter "Terisi/Ditandai" berupa `span` dengan lebar inline. | Semantik tabel dan kemajuan tidak terbaca pembaca layar. |
| 5 | Nama saksi tanpa label tampak (hanya `aria-label`). Status tanda tangan tidak terlihat. Tidak ada pintasan tanggal. | Membingungkan dan butuh lebih banyak ketukan. |

## Tampilan baru

Enam langkah dikelompokkan seperti dua bagian formulir kertas:

- **A. Pemberian informasi**
  1. **Pihak informasi** — dokter pelaksana, pemberi informasi / DPJP ("Nama saya"), penerima ("Pasien sendiri"); semua bertanda `*`.
  2. **Isi informasi** — `<table>` semantik (judul baris = jenis informasi). Tanda (V) berupa **checkbox asli** yang aktif setelah isinya diisi. Meter Terisi/Ditandai berupa `<progress>` berlabel. Tombol "Tandai (V) semua yang terisi" tetap ada.
  3. **Tanda tangan informasi** — kotak TTD dengan status "Sudah/Belum ditandatangani".
- **B. Persetujuan / penolakan**
  4. **Keputusan pasien** — dua kartu pilihan berisi **radio asli** (seluruh kartu dapat diklik; terpilih hanya mengubah warna, tanpa geser tata letak). Ganti lembar tetap meminta konfirmasi bila tanda tangan pernyataan sudah ada.
  5. **Pernyataan** — identitas yang menyatakan (jenis kelamin radio asli; alamat menyesuaikan tinggi), tindakan, pilihan "terhadap" (radio asli berupa kartu), **Hari ini** untuk tanggal, dan pratinjau kalimat.
  6. **Tanda tangan & saksi** — terkunci sampai keputusan dipilih; nama saksi berlabel tampak; status tanda tangan per kotak.

Setiap kartu langkah menampilkan lencana status ("Lengkap", "n belum lengkap", "Belum diisi", atau "Langkah berikutnya"). Kaki kartu berisi:
- **kekurangan yang bisa diklik** — memindahkan fokus ke kolomnya; disembunyikan selama langkah belum disentuh;
- tautan **Lanjut: …** ke langkah sesudahnya.

**Navigasi** (komponen bersama RM.03/RM.21):
- **Layar ≥ 1280 px:** kolom samping berisi 6 langkah dalam 2 kelompok, ditambah panel **Syarat finalisasi** per langkah. Ringkasan kekurangan tiap langkah dapat diklik untuk langsung ke kolom pertama yang kurang.
- **Layar lebih kecil:** bilah lengket berisi 6 bulatan bernomor (44 px, satu baris, tanpa geser). Ringkasan "Langkah n dari 6" tampil bila lebarnya cukup (container query, mis. tablet). Panel syarat versi ponsel ada di langkah 6.
- **Mode baca-saja:** pintasan, kekurangan, dan daftar syarat disembunyikan.

## Catatan teknis

- **Pesan syarat → kolom:** `persetujuan/tujuan.ts` (`tujuanPesan(awalan, pesan)`) memetakan setiap pesan `kekuranganRm22` ke id kolomnya. `tujuan.test.ts` memastikan semua variasi pesan RM.22 punya tujuan.
- **Komponen bersama yang ikut membaik di RM.33** (`persetujuan/bidang.tsx`):
  - tabel informasi semantik, checkbox Tanda (V), meter `<progress>`;
  - radio asli untuk "terhadap" dan jenis kelamin;
  - label tampak nama saksi, status TTD, "Hari ini";
  - prop baru (`awalan`, `idTtd`, `sudah`) bersifat opsional.

  Tata letak dan alur RM.33 lainnya tidak berubah. `PilihJk` (dipakai RM.41) tetap seperti semula; `PilihanBesar` dihapus karena tidak dipakai lagi.
- **NavLangkah:**
  - `grup` = judul kelompok di navigasi samping;
  - mode padat (> 4 langkah) = label horizontal hanya untuk pembaca layar, dan ringkasan teks muncul lewat `@container` (≥ 28rem).
- **bagian.tsx:**
  - `LencanaLangkah` dan `KakiLangkah` baru;
  - `BagianLangkah` mendapat prop `lencana`/`sorot`;
  - `ButirSyarat` mendapat `ket` (rincian kekurangan).

- **Gotcha Chromium — container query di dalam `<fieldset>` ber-legend.** Elemen `container-type` (`@container`) yang menjadi anak `<fieldset>` dengan `<legend>` bisa tidak dirender ulang saat isinya berubah: tingginya menjadi 0 dan kolom di dalamnya hilang. Di sini pemicunya adalah memilih "Diri sendiri". Aturannya:
  - wadah `@container` diletakkan di LUAR fieldset ber-legend (pilihan lembar);
  - `IdentitasOrang` memakai breakpoint layar.

  Uji UI memeriksa kolom identitas tetap terlihat setelah memilih "Diri sendiri" maupun "Keluarga".

## Verifikasi

- Unit: 755/755 (3 baru untuk pemetaan syarat → kolom).
- UI RM.22: 70/70, mencakup desktop 1440, tablet 768, ponsel 390/360 dengan sentuh, baca-saja, cetak, kolom identitas tetap tampil setelah memilih "terhadap", dan uji asap RM.33.
- Regresi:

  | Uji | Hasil |
  |---|---|
  | UI RM.03 | 57/57 |
  | UI RM.21 | 66/66 |
  | Berlanjut L1 UI | 23/23 |
  | 10 formulir E2E | 154/154 |
  | 10 formulir UI | 81/81 |
  | Gabung per kolom E2E | 71/71 |
  | Keamanan berlanjut | 49/49 |
- Data uji dibersihkan; SIMGOS hanya dibaca. Tangkapan layar uji disamarkan; pratinjau pernyataan dan blok identitas dikaburkan seluruhnya.

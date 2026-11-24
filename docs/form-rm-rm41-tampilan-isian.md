# RM.41 Pulang Atas Permintaan Sendiri — tampilan pengisian (redesign 24 Nov 2026)

Hanya **layar pengisian** yang berubah. Bagian berikut tidak berubah:
- cetak (`Rm41Document`, F4 potret, satu lembar);
- skema data dan path kolom;
- teks syarat FINAL, isi otomatis SIMRS (identitas, alamat, waktu & petugas kepulangan APS), aturan TTD (`cekTtdRm41`).

## Masalah pada tampilan lama

| # | Masalah | Akibat |
|---|---|---|
| 1 | Navigasi alur lama tanpa panel syarat finalisasi yang bisa diklik. | Petugas tidak langsung dibawa ke kolom yang masih kurang. |
| 2 | "Selaku …" dan jenis kelamin memakai tombol `role="radio"` tiruan. | Panah/Spasi dan pembaca layar tidak berperilaku seperti radio asli. |
| 3 | Isi cepat hanya untuk "diri sendiri"; alamat/waktu/petugas dari SIMRS tak bisa dipulihkan setelah diubah. | Ketik ulang manual. |
| 4 | Penghitung karakter alasan tidak terhubung ke kolomnya. | Pembaca layar tak mengumumkan batas karakter. |

## Tampilan baru

`TataLetakLangkah` (navigasi langkah lengket + panel **Syarat finalisasi**), 4 langkah sesuai urutan kertas:

1. **Yang bertanda tangan** — "Selaku … dari pasien" (7 radio asli, pratinjau teks tercetak dengan pilihan lain dicoret), nama, umur, alamat (textarea tumbuh mengikuti isi). Isi cepat: nama & umur pasien (bila "Diri sendiri"), alamat pasien dari SIMRS.
2. **Data pasien** — nama, jenis kelamin (radio asli), tanggal lahir, nomor RM (penanda SIMRS di tiap label).
3. **Alasan & pernyataan** — alasan (penghitung karakter lewat `aria-describedby`) + empat butir pernyataan resmi dengan alasan tersisip di butir 1.
4. **Waktu & tanda tangan** — "Modayag, tanggal & jam" (+ **Sekarang**, + isi cepat **Waktu pulang di SIMRS**), tanda tangan petugas RS (+ isi cepat petugas SIMRS, "Nama saya"), saksi, dan yang menyatakan (terkunci sampai "Selaku" dipilih). Status tiap kotak tertulis "Sudah/Belum ditandatangani".

Mengganti "Selaku" saat TTD yang menyatakan sudah ada meminta konfirmasi (fokus ke "Batal"; batal → fokus kembali ke radio terpilih).

## Catatan teknis

- Syarat FINAL tetap `kekuranganRm41` (registri server & panel layar). Pesan → kolom: `tujuanRm41` di `rm41.constants.ts` (unit: `rm41.test.ts`).
- `PilihJk` (segmen tombol tiruan, hanya dipakai RM.41) dihapus dari `persetujuan/bidang.tsx`.

## Verifikasi

Diuji ke dev server :3000, tanpa build produksi karena RAM laptop terbatas.

- **Unit:** form-rm 434/434 (baru: setiap pesan kekurangan punya kolom tujuan unik).
- **UI RM.41:** 52/52 — struktur 4 langkah, tanpa kontrol tiruan, label `for` tanpa `aria-label` penimpa; radio asli + panah; isi cepat alamat SIMRS; penghitung alasan; syarat → fokus `rm41-waktu`; "Sekarang"; tiga TTD digambar; syarat 4/4; konfirmasi ganti "Selaku" (Batal & Ganti); tablet 768, ponsel 390/360 (sentuh ≥ 44 px, tanpa gulir-x); baca-saja; cetak; tanpa galat konsol/CSP.
- Data uji dibersihkan terarah (prefiks `zz_e2e_rm41ui`). SIMGOS hanya dibaca. Tangkapan layar disamarkan lalu dihapus.

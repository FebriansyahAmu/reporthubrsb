# PROMPT DESAIN 1:1 — "BUKTI PELAYANAN / PERAWATAN PESERTA JKN-KIS"

> Prompt ini adalah spesifikasi lengkap 100% untuk membuat ulang formulir **Bukti Pelayanan / Perawatan Peserta JKN-KIS** (RSUD Bolaang Mongondow Timur) secara identik. Ikuti setiap angka, teks, dan aturan format persis seperti tertulis. Semua teks dicetak **tebal (bold)**, jenis huruf **Bahnschrift SemiLight**, warna hitam, latar putih, tanpa arsiran/warna sel.

---

## 1. INSTRUKSI UTAMA (ringkas)

Buatkan satu dokumen formulir 1 halaman (yang secara alami memanjang ke beberapa halaman karena tabel isian) berupa **Bukti Pelayanan / Perawatan Peserta Jaminan Kesehatan Nasional (JKN – KIS)**. Terdiri dari: **blok kepala (identitas peserta)** → **Tabel A (ringkasan rawat, 9 kolom)** → **judul seksi "Pelayanan Paket Dan Luar Paket"** → **Tabel B (catatan pelayanan, 6 kolom, ± 30 baris kosong)** → **baris keterangan keadaan keluar RS** → **blok tanda tangan (Kepala Ruangan & Pelayanan Telah Diterima)**.

---

## 2. SPESIFIKASI HALAMAN

| Properti | Nilai |
|---|---|
| Ukuran kertas | **F4 / Folio** — 21,59 cm × 33,02 cm (8,5" × 13"; 12240 × 18720 twips) |
| Orientasi | Portrait (tegak) |
| Margin atas | 1,0 cm (567 twips) |
| Margin bawah | 1,0 cm (567 twips) |
| Margin kanan | 1,0 cm (567 twips) |
| Margin kiri | 2,0 cm (1134 twips) |
| Header / Footer | 0,5" (720 twips) |

---

## 3. TIPOGRAFI GLOBAL

- **Jenis huruf:** `Bahnschrift SemiLight` untuk seluruh dokumen.
- **Gaya:** seluruh teks **Bold**.
- **Warna teks:** hitam. **Warna sel:** putih (tanpa shading).
- **Ukuran font yang dipakai:**
  - **12 pt** → judul, subjudul, seluruh baris identitas kepala, judul seksi ("CATATAN PELAYANAN PADA PESERTA", "Pelayanan Paket Dan Luar Paket").
  - **10 pt** → baris "Keadaan Setelah Keluar RS…", dan seluruh teks blok tanda tangan.
  - **8 pt** → seluruh judul kolom & isi Tabel A dan Tabel B.
- **Spasi baris:** rapat (single, `after = 0`) untuk teks kepala; **1,5 baris** (line 360) untuk baris-baris kosong di dalam Tabel B agar tinggi baris konsisten.
- **Garis tabel:** hitam tunggal **0,5 pt** (sz 4) di semua sisi (atas, bawah, kiri, kanan, garis dalam horizontal & vertikal). Margin dalam sel: kiri/kanan 0,19 cm (108 twips), atas/bawah 0.

---

## 4. BLOK KEPALA (IDENTITAS) — 12 pt, bold

Baris 1 & 2 rata **tengah**. Baris identitas rata **kiri**, format `Label` + spasi menuju posisi tab, lalu `:` , lalu isi/garis titik-titik. Titik pengisi memakai karakter elipsis berderet (`…`), bukan garis bawah.

```
       BUKTI PELAYANAN / PERAWATAN PESERTA JAMINAN KESEHATAN NASIONAL (JKN – KIS)      (rata tengah)
        {Mohon Di Isi Dengan Lengkap Digunakan Sebagai Lampiran Tagihan Rumah Sakit)    (rata tengah)

Rumah Sakit                          : RSUD BOLAANG MONGONDOW TIMUR
Nama Penderita                       : …………………………………………………………………………………………………………
No. Surat Jaminan Perawatan/SIP      : …………………………………………………………………………………………………………
Peserta / Istri / Suami / Anak Ke    : …………………………………………………………………………………………………………
No. Kartu JKN                        : …………………………………………………………………………………………………………
Nama Perserta / KK                   : …………………………………………………………………………………………………………

CATATAN PELAYANAN PADA PESERTA
No. Medical Record                   : …………………………………………………………………………………………………………
Diagnosa Rumah Sakit                 : …………………………………………………………………………………………………………
```

Catatan teks verbatim (harus persis, termasuk kekhasannya):
- Subjudul memakai kurung kurawal-buka lalu diakhiri kurung-tutup biasa: `{Mohon … Rumah Sakit)`.
- Tulis **"Nama Perserta / KK"** (ejaan asli "Perserta", jangan dikoreksi).
- Pemisah pada judul memakai en-dash: `JKN – KIS`.
- Posisi tanda `:` disejajarkan pada tab ± 2,8 cm dari margin kiri (tab kiri di 3969 & 4253 twips), sehingga semua titik dua sejajar vertikal.

---

## 5. TABEL A — RINGKASAN RAWAT (9 kolom)

- **8 pt, bold. Judul kolom rata tengah, vertikal tengah.**
- **1 baris header + 1 baris isi kosong.** Baris isi kosong dibuat setinggi ± 4 baris (sel pertama berisi 4 paragraf kosong) agar ada ruang menulis.
- Indent tabel dari margin kiri: 108 twips (0,19 cm). Total lebar ± 18,6 cm.

Lebar kolom (twips → cm) dan judulnya (urut kiri→kanan):

| # | Judul kolom (persis) | Lebar (twips) | Lebar (cm) |
|---|---|---|---|
| 1 | Ruang Rawat/ Kelas Perawatan | 1189 | 2,10 |
| 2 | MRS **↵** Tanggal | 1189 | 2,10 |
| 3 | KRS **↵** Tanggal | 1189 | 2,10 |
| 4 | Jumlah Hari Rawat | 1189 | 2,10 |
| 5 | Tanggal Pelayanan | 1022 | 1,80 |
| 6 | Jenis Tindakan/ Operasi | 1190 | 2,10 |
| 7 | TT Dan Nama Peserta / Keluarga | 1190 | 2,10 |
| 8 | TT Dan Nama Dokter / Petugas | 1190 | 2,10 |
| 9 | Ket. Anastesi Umum/ Lokal | 1190 | 2,10 |

Keterangan sel header:
- Kolom **2 "MRS"** dan kolom **3 "KRS"** masing-masing memuat dua baris: nama singkatan di baris pertama dan kata **"Tanggal"** di baris kedua (dalam satu sel).
- Tulis **"Anastesi"** (ejaan asli, bukan "Anestesi").

Setelah Tabel A, beri **satu paragraf kosong kecil** (jeda) lalu masuk judul seksi berikutnya.

---

## 6. JUDUL SEKSI — 12 pt, bold, rata kiri

```
Pelayanan Paket Dan Luar Paket
```

---

## 7. TABEL B — CATATAN PELAYANAN (6 kolom)

- **8 pt, bold. Judul kolom rata tengah, vertikal tengah.**
- **1 baris header + ± 30 baris isian kosong** (baris kosong memakai spasi 1,5 agar tinggi seragam; tinggi baris minimum sangat kecil sehingga baris tampak rapat).
- Lebar total tabel: **10545 twips ≈ 18,6 cm**. Indent 108 twips.

Lebar kolom dan judul (urut kiri→kanan):

| # | Judul kolom (persis) | Lebar (twips) | Lebar (cm) |
|---|---|---|---|
| 1 | Ruang Rawat / Kelas Perawatan | 1242 | 2,19 |
| 2 | Tanggal Pelayanan | 1134 | 2,00 |
| 3 | Jenis Tindakan Pelayanan Yang Diberikan | 4570 | 8,06 |
| 4 | TT Dan Nama Peserta / Keluarga | 1276 | 2,25 |
| 5 | TT Dan Nama Dokter / Petugas | 1276 | 2,25 |
| 6 | Keterangan | 1047 | 1,85 |

> Kolom 3 sengaja jauh lebih lebar (± 8 cm) karena untuk menulis uraian tindakan.

---

## 8. BARIS "KEADAAN SETELAH KELUAR RS" (10 pt, bold)

Satu **baris penuh** (merge seluruh 6 kolom / selebar tabel), rata kiri, tepat setelah baris isian terakhir Tabel B:

```
Keadaan Setelah Keluar RS : Sembuh  /  Dirujuk  / Meninggal  / Paksa Pulang
```

(Pertahankan spasi ganda di sekitar tanda `/` seperti aslinya.)

---

## 9. BLOK TANDA TANGAN (10 pt, bold, tanpa garis)

Tabel **tanpa border**, dibagi menjadi **dua kolom** berdampingan dengan lebar hampir sama (kiri ± 4494 twips / 7,9 cm; kanan ± 4866 twips / 8,6 cm). Tinggi ± 2 cm untuk ruang tanda tangan.

**Kolom kiri (rata tengah):**
```
Kepala Ruangan
………………………………………………….


(…………………………………………………………………………….)
         NIP.
```

**Kolom kanan (rata tengah):**
```
Tanggal …………………………………….
Pelayanan Telah Diterima



(……………………….……………………………………………….)
```

Aturan:
- Beri beberapa baris kosong di antara jabatan dan tanda kurung nama agar tersedia ruang tanda tangan (± 5–6 baris kosong).
- `NIP.` di kolom kiri diletakkan setelah kurung nama, sedikit menjorok (didahului beberapa spasi).
- Kurung nama di kolom kanan lebih panjang daripada kolom kiri (perhatikan jumlah titik).

---

## 10. RINGKASAN URUTAN ELEMEN (checklist 1:1)

1. Judul (rata tengah, 12 pt) — teks JKN–KIS.
2. Subjudul (rata tengah, 12 pt) — kalimat `{Mohon … Rumah Sakit)`.
3. 6 baris identitas kepala (kiri, 12 pt): Rumah Sakit → Nama Penderita → No. Surat Jaminan Perawatan/SIP → Peserta/Istri/Suami/Anak Ke → No. Kartu JKN → Nama Perserta/KK.
4. Judul seksi `CATATAN PELAYANAN PADA PESERTA` (12 pt).
5. 2 baris: No. Medical Record → Diagnosa Rumah Sakit (12 pt).
6. **Tabel A** (9 kolom, 8 pt) + 1 baris isian kosong.
7. Jeda 1 paragraf.
8. Judul seksi `Pelayanan Paket Dan Luar Paket` (12 pt).
9. **Tabel B** (6 kolom, 8 pt) + ± 30 baris isian kosong.
10. Baris penuh `Keadaan Setelah Keluar RS : Sembuh / Dirujuk / Meninggal / Paksa Pulang` (10 pt).
11. Blok tanda tangan 2 kolom tanpa garis (10 pt): kiri **Kepala Ruangan (+NIP.)**, kanan **Tanggal … / Pelayanan Telah Diterima**.

---

## 11. CATATAN KONVERSI (untuk implementasi)

- 1440 twips = 1 inci = 2,54 cm.
- Ukuran font dalam file asli disimpan sebagai "half-point": sz 16 = 8 pt, sz 20 = 10 pt, sz 24 = 12 pt.
- Ketebalan garis sz 4 = 4 eighth-point = **0,5 pt**.
- Jika font **Bahnschrift SemiLight** tidak tersedia di perangkat target, gunakan pengganti paling dekat (mis. *Bahnschrift Light* atau sans-serif kondensat ringan) — tetapi utamakan memasang Bahnschrift agar identik 1:1.

---

### Teks verbatim yang WAJIB dipertahankan (jangan diubah ejaannya)

- `BUKTI PELAYANAN / PERAWATAN PESERTA JAMINAN KESEHATAN NASIONAL (JKN – KIS)`
- `{Mohon Di Isi Dengan Lengkap Digunakan Sebagai Lampiran Tagihan Rumah Sakit)`
- `RSUD BOLAANG MONGONDOW TIMUR`
- `Nama Perserta / KK` (ejaan "Perserta")
- `Ket. Anastesi Umum/ Lokal` (ejaan "Anastesi")
- `Keadaan Setelah Keluar RS : Sembuh  /  Dirujuk  / Meninggal  / Paksa Pulang`
- `Pelayanan Telah Diterima`

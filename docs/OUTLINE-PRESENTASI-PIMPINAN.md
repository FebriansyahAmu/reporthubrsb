# AuditTrail RS BOLTIM — Outline Presentasi untuk Pimpinan

> **Aplikasi pendamping SIMGOS** untuk melengkapi pelaporan, kelengkapan berkas
> klaim, dan formulir rekam medis di RSUD Pratama Bolaang Mongondow Timur.
>
> Dokumen ini adalah **kerangka presentasi** (bukan aplikasi). Setiap bagian di
> bawah = satu slide/segmen, dilengkapi **inti pesan** dan **poin bicara**.

| | |
|---|---|
| **Nama aplikasi** | AuditTrail RS BOLTIM (ReportHub RSB) |
| **Versi saat ini** | v1.1.2 — sudah berjalan (production) |
| **Sifat terhadap SIMGOS** | **Hanya membaca (read-only)** — tidak mengubah apa pun |
| **Untuk** | Pimpinan & manajemen RSUD Boltim |
| **Durasi presentasi** | ± 15–20 menit + diskusi |

---

## Alur Presentasi (ringkas)

1. Ringkasan Eksekutif → 2. Masalah yang dijawab → 3. Apa itu aplikasi ini →
4. **Jaminan keamanan data SIMGOS** → 5. Modul & manfaat → 6. Manfaat per unit →
7. Keamanan akses & tata kelola → 8. Status & keandalan → 9. Rencana ke depan →
10. Penutup & dukungan yang dibutuhkan.

---

## 1. Ringkasan Eksekutif

**Inti pesan:** *Aplikasi ini melengkapi SIMGOS — bukan menggantinya — agar
pelaporan, klaim, dan kelengkapan rekam medis lebih cepat, rapi, dan terkontrol,
tanpa menyentuh (mengubah) data SIMGOS sama sekali.*

Poin bicara:
- SIMGOS tetap menjadi sistem utama. Aplikasi ini **membaca** data SIMGOS lalu
  menyajikannya sebagai laporan, monitoring, dan cetakan yang selama ini belum
  tersedia di SIMGOS.
- Hal-hal yang perlu **diisi/ditulis** (formulir RM, bukti pelayanan, tanda
  tangan) disimpan di **database terpisah milik aplikasi**, sehingga SIMGOS tetap
  utuh dan aman.
- Sudah **berjalan di server rumah sakit** dan dipakai (versi v1.1.2).

---

## 2. Masalah yang Dijawab

**Inti pesan:** *Beberapa kebutuhan harian belum terjawab langsung oleh SIMGOS.*

Poin bicara (contoh nyata):
- **Berkas klaim BPJS** sering harus dirakit manual; sulit melihat sekilas
  dokumen mana yang sudah lengkap dan mana yang belum.
- **Kelengkapan rekam medis** (Ringkasan Masuk-Keluar, Edukasi, Persetujuan)
  susah dipantau per pasien.
- **Laporan** (mis. 10 penyakit terbanyak, pemakaian obat) butuh waktu untuk
  disusun dan diekspor.
- **Monitoring antrean BPJS & pelayanan** belum ada tampilan ringkas real-time.
- Beberapa **cetakan** (Bukti Pelayanan, Resume Pulang) belum tersedia rapi.

---

## 3. Apa Itu AuditTrail RS BOLTIM

**Inti pesan:** *Satu portal untuk monitoring, kelengkapan berkas, formulir, dan
laporan — dengan data yang berasal langsung dari SIMGOS.*

Poin bicara:
- Diakses lewat **browser** di jaringan internal rumah sakit (tidak perlu instal
  aplikasi di tiap komputer).
- Menampilkan data SIMGOS yang **selalu terkini** karena membaca langsung dari
  sumbernya.
- Menambahkan fitur yang membantu petugas: penanda kelengkapan, pengisian
  formulir, tanda tangan digital, dan ekspor laporan ke Excel.

---

## 4. Jaminan Keamanan Data SIMGOS ⭐ (bagian terpenting)

**Inti pesan:** *SIMGOS 100% aman. Aplikasi ini secara teknis TIDAK BISA mengubah
data SIMGOS — hanya membaca.*

Poin bicara (tegaskan berlapis):
1. **Di tingkat database** — akun yang dipakai aplikasi hanya diberi izin
   **"membaca"**. Secara sistem, ia tidak punya kemampuan menambah, mengubah,
   atau menghapus data, apalagi struktur tabel SIMGOS.
2. **Data milik aplikasi disimpan terpisah** — formulir RM, bukti pelayanan,
   tanda tangan, akun & peran disimpan di database sendiri (`reporthub`), bukan
   di SIMGOS.
3. **Terpisah = tidak ada risiko** SIMGOS rusak/berubah karena aktivitas
   aplikasi ini.
4. Prinsip ini dijaga konsisten sejak desain sampai operasional.

> Kalimat kunci untuk pimpinan: *"Aplikasi ini seperti 'jendela baca' ke SIMGOS —
> boleh melihat dan menyalin ke laporan, tapi tidak memegang pena untuk mengubah
> isinya."*

---

## 5. Modul & Fitur Utama (beserta manfaat)

**Inti pesan:** *Setiap modul menyelesaikan satu pekerjaan nyata di lapangan.*

| Modul | Fungsi singkat | Manfaat |
|---|---|---|
| **Dashboard** | Statistik ringkas kunjungan, tren, sensus | Pimpinan lihat kondisi RS sekilas |
| **Kunjungan Pasien** | Daftar kunjungan pasien | Penelusuran cepat |
| **Monitoring Antrean BPJS** | Pantau tahapan antrean BPJS (Task 1–7) | Kepatuhan antrean online BPJS |
| **Monitoring Pelayanan** | Kunjungan berjalan/belum final, kelengkapan diagnosa & resume | Deteksi berkas yang belum selesai |
| **Berkas Klaim RM** | Kelengkapan dokumen klaim per pasien + cetak | **Percepat & rapikan klaim BPJS** |
| **Form RM (Admisi)** | Isi formulir RM saat pendaftaran (Ringkasan, Edukasi, Persetujuan) | **Tingkatkan kelengkapan rekam medis** |
| **Pusat Laporan** | 10 Penyakit Terbanyak, Farmasi/Obat, ekspor Excel | Laporan cepat & siap cetak |
| **Master (Pengguna, Peran, Mapping Ruangan)** | Kelola akun, hak akses, & pejabat penandatangan | Kontrol & tata kelola |

Sorotan fitur (boleh 1–2 slide contoh layar):
- **Berkas Klaim:** satu halaman menampilkan status tiap dokumen (Rekam Medis,
  Triase, SEP, SPRI, Bukti Pelayanan, CPPT, Resume Pulang) — hijau = ada, merah =
  belum — plus tombol cetak.
- **Form RM:** kartu pasien IGD diberi **penanda kelengkapan** (hijau lengkap,
  kuning sebagian, merah belum diisi) sehingga petugas tahu mana yang perlu
  dilengkapi.
- **Bukti Pelayanan:** dibuat dari data tindakan SIMGOS, lalu **ditandatangani
  digital** oleh Kepala Ruangan.
- **Tanda tangan jarak jauh:** tanda tangan bisa dilakukan lewat **HP** (scan QR)
  lalu otomatis masuk ke dokumen di komputer.
- **10 Penyakit Terbanyak:** kini bisa **difilter per ruangan/bangsal** dan
  diekspor ke Excel.

---

## 6. Manfaat per Unit / Pemangku Kepentingan

**Inti pesan:** *Manfaatnya dirasakan lintas unit.*

- **Manajemen/Pimpinan:** dashboard & laporan ringkas untuk pengambilan
  keputusan; laporan bisa diekspor.
- **Rekam Medis:** kelengkapan berkas & formulir terpantau; cetakan rapi.
- **Kasir/Klaim BPJS:** berkas klaim lebih cepat dirakit dan diperiksa
  kelengkapannya → mengurangi berkas pending/dikembalikan.
- **Admisi/Perawat:** pengisian formulir RM lebih terarah dengan penanda
  kelengkapan.
- **IT:** aman terhadap SIMGOS, mudah dipelihara, berbasis web.

---

## 7. Keamanan Akses & Tata Kelola

**Inti pesan:** *Setiap orang hanya melihat/mengerjakan yang menjadi haknya.*

Poin bicara:
- **Login** dengan akun aplikasi, atau **akun SIMGOS** yang sudah diberi peran —
  memudahkan petugas (satu identitas).
- **Peran & Hak Akses (RBAC):** akses diatur per modul (mis. hanya kasir yang
  buka Berkas Klaim, hanya admin yang kelola pengguna).
- **Mapping Ruangan:** menentukan Kepala Ruangan sebagai penandatangan sah Bukti
  Pelayanan.
- **Koneksi terenkripsi (HTTPS)** di jaringan internal RS.

---

## 8. Status & Keandalan Operasional

**Inti pesan:** *Bukan konsep — sudah berjalan dan stabil.*

Poin bicara:
- Versi **v1.1.2**, berjalan di **server rumah sakit** dalam wadah terisolasi
  (container), otomatis hidup kembali bila server restart.
- Berdampingan dengan aplikasi RS lain di server yang sama tanpa saling ganggu.
- Pembaruan dilakukan bertahap & tercatat (setiap rilis diberi penanda versi).

---

## 9. Rencana Pengembangan (Roadmap)

**Inti pesan:** *Masih bisa tumbuh sesuai kebutuhan RS.*

Contoh arah lanjutan (untuk diskusi/persetujuan):
- Filter ruangan yang sama untuk laporan lain (mis. Farmasi/Obat).
- Tambahan jenis laporan sesuai kebutuhan manajemen/Kemenkes.
- Arsip cetakan dalam bentuk PDF.
- Perluasan formulir RM elektronik.

> Prioritas ditentukan bersama pimpinan berdasarkan kebutuhan paling mendesak.

---

## 10. Penutup & Dukungan yang Dibutuhkan

**Inti pesan:** *Aplikasi siap dipakai lebih luas; butuh dukungan pimpinan untuk
adopsi.*

Usulan penutup:
- **Manfaat utama:** klaim lebih cepat, rekam medis lebih lengkap, laporan lebih
  mudah — **tanpa risiko terhadap SIMGOS**.
- **Dukungan yang diminta:** penetapan unit pengguna & perannya, sosialisasi
  singkat ke petugas, dan penentuan prioritas pengembangan berikutnya.
- Ajakan: mulai dari modul yang paling berdampak (mis. Berkas Klaim & Form RM).

---

## Lampiran A — Antisipasi Pertanyaan (Q&A)

- **"Apakah data SIMGOS bisa berubah karena aplikasi ini?"** → Tidak. Aplikasi
  hanya membaca; akunnya tidak punya izin mengubah apa pun.
- **"Kalau aplikasi ini mati, SIMGOS terganggu?"** → Tidak. Keduanya terpisah;
  SIMGOS tetap jalan normal.
- **"Datanya real-time?"** → Ya, membaca langsung dari SIMGOS.
- **"Siapa yang bisa mengakses?"** → Hanya pengguna yang diberi akun & peran
  oleh admin RS.
- **"Formulir & tanda tangan disimpan di mana?"** → Di database aplikasi sendiri
  (`reporthub`), terpisah dari SIMGOS.

## Lampiran B — Daftar Modul Lengkap

| # | Modul | Keterangan |
|---|---|---|
| 1 | Dashboard | Statistik ringkas kunjungan, tren & sensus |
| 2 | Kunjungan Pasien | Daftar kunjungan pasien |
| 3 | Monitoring Antrean BPJS | Pantau tahapan antrean BPJS (Task 1–7) |
| 4 | Monitoring Pelayanan | Kunjungan, belum final, kelengkapan diagnosa & resume |
| 5 | Berkas Klaim RM | Kelengkapan dokumen klaim pasien final + cetak |
| 6 | Form RM (Admisi) | Formulir RM saat pendaftaran (Ringkasan/Edukasi/Persetujuan) |
| 7 | Pusat Laporan | 10 Penyakit Terbanyak, Farmasi/Obat, ekspor Excel |
| 8 | Master › Pengguna | Kelola akun (termasuk login via akun SIMGOS) |
| 9 | Master › Peran & Hak Akses | Atur izin akses per modul (RBAC) |
| 10 | Master › Mapping Ruangan | Kepala Ruangan = penandatangan Bukti Pelayanan |

## Lampiran C — Catatan Teknis (bila ditanya tim IT)

- **Basis:** aplikasi web (Next.js/React), berjalan sebagai container Docker di
  balik reverse proxy (nginx) dengan HTTPS.
- **Data:** membaca SIMGOS (MySQL) **read-only**; menulis hanya ke database
  aplikasi `reporthub` yang terpisah.
- **Keamanan akses:** login berbasis token, peran & hak akses per modul.
- Dokumentasi teknis lengkap ada di folder `docs/` (arsitektur, database,
  keamanan, RBAC, roadmap).

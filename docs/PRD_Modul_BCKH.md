# PRD & Rencana Bertahap — **BCKH (Buku Catatan Kegiatan Harian)**

## Modul baru: catat kegiatan harian ala profil GitHub, log pengisian, dasbor persentase, dan cetak Laporan Kinerja Harian 1:1

**Project:** ReportHub (`reporthubrsb`) · Workspace baru **BCKH** (`/bckh`)
**Organisasi:** UPTD RSUD Bolaang Mongondow Timur
**Versi:** 1.0 · **Tanggal:** 2 November 2026 · **Status:** B0–B6 selesai (§13)
**Sifat data:** Modul ini **tidak membaca maupun menulis SIMGOS**. Semua data disimpan di DB aplikasi `reporthub` (tabel baru `bckh_*`, dibuat dengan `CREATE TABLE IF NOT EXISTS`, tanpa mengubah tabel lain).

---

## 1. Latar Belakang & Tujuan

Setiap pegawai (termasuk tenaga ahli non-ASN) menyerahkan **Laporan Kinerja Harian** per bulan. Saat ini laporan diketik ulang di Word tiap bulan (contoh: `6. BCKH NOVEMBER.docx/.pdf`). Akibatnya:

- kegiatan baru ditulis di akhir bulan, sehingga isinya mengandalkan ingatan;
- penomoran dan format tidak konsisten (contoh dokumen: nomor 11 terlewat, hari kerja bertanda ✓ sekaligus "OFF");
- atasan tidak bisa memantau pengisian sebelum laporan diserahkan.

Yang diminta:

1. **Input tracking kegiatan harian** yang cepat, karena kegiatan rutin berulang hampir setiap hari.
2. **Tampilan seperti profil GitHub**, dengan mekanisme yang mirip: grafik kontribusi, ringkasan aktivitas, dan linimasa per bulan.
3. **Log pengisian**: kapan setiap catatan dibuat, diubah, atau dihapus.
4. **Dasbor persentase kegiatan.**
5. **Tarikan laporan 1:1** dengan dokumen contoh.
6. Interaktif, responsif, dan elegan.

**Tujuan terukur:**

- Mencatat satu hari kerja rutin cukup **≤ 3 klik**: "Catat kegiatan", "Salin hari kerja terakhir", lalu Simpan.
- PDF laporan bulanan **identik tata letaknya** dengan contoh. Ukurannya diambil dari dokumen Word asli (bagian §9).
- Setiap perubahan catatan **terjejak** di log pengisian. Keterlambatan pengisian terlihat (diisi > H+1).

---

## 2. Ruang Lingkup

**Termasuk:**
- profil BCKH per pengguna;
- catatan harian (status hari + daftar kegiatan);
- log pengisian;
- dasbor persentase;
- PDF Laporan Kinerja Harian bulanan;
- tampilan Tim untuk atasan (hanya-lihat dan unduh laporan bawahan);
- pengaturan penandatangan "Mengetahui" dan kop.

**Tidak termasuk (bisa menyusul):**
- persetujuan/tanda tangan elektronik atasan;
- penguncian bulan setelah diserahkan;
- impor dari Word lama;
- keluaran .docx;
- notifikasi pengingat harian;
- integrasi absensi.

---

## 3. Peran & Hak Akses (RBAC, katalog di kode)

| Modul (`key`) | Aksi | Untuk siapa | Yang dibuka |
| --- | --- | --- | --- |
| `bckh` | view, update, print | Semua pegawai yang mengisi BCKH | Profil sendiri, isi/ubah/hapus catatan sendiri, dasbor sendiri, unduh laporan sendiri |
| `bckh.tim` | view, print | Atasan / Kepala Instalasi / Kepegawaian | Daftar Tim, profil & dasbor pegawai lain (**hanya-lihat**), unduh laporan pegawai lain |
| `bckh.pengaturan` | view, update | Admin / Kepegawaian | Kop laporan & penandatangan "Mengetahui" (Direktur) |

**Aturan:**

- **Catatan hanya bisa diubah pemiliknya.** Pemegang `bckh.tim` tidak bisa menyunting catatan orang lain.
- Superadmin melewati semua cek, sesuai pola RBAC yang ada.
- Semua API `GET` menerima `?u=<id pengguna>`:
  - tanpa `u`, atau `u` = diri sendiri → butuh `bckh:view`;
  - `u` orang lain → butuh `bckh.tim:view` (unduh laporan: `bckh.tim:print`).

---

## 4. "Seperti GitHub" — Pemetaan Konsep

| GitHub | BCKH |
| --- | --- |
| Avatar *identicon* + nama + username | *Identicon* 5×5 dari ID pengguna (tanpa unggah foto) + nama lengkap + username + jabatan |
| Sidebar profil (bio, organisasi, lokasi) | Jabatan, unit, NIP, atasan langsung |
| Popular / pinned repositories | **Kegiatan rutin**: 6 uraian tersering dalam 90 hari, sekali klik menambahkan ke catatan |
| *Contribution graph* (53 minggu × 7 hari, 5 tingkat warna) | **Grafik kegiatan**: jumlah kegiatan per hari. Hari Off/Cuti/Sakit/Izin/Libur bertanda khusus. Klik sel = buka catatan hari itu |
| "N contributions in the last year" + pemilih tahun | "N kegiatan dalam setahun terakhir" + pemilih tahun |
| *Activity overview* | **Komposisi kegiatan** per kategori (bilah persentase ala "Languages") + persentase selesai |
| *Contribution activity* (linimasa per bulan) | **Aktivitas per bulan**: "Mencatat 52 kegiatan dalam 13 hari", rincian kategori, status hari, bisa dibuka |
| Commit = perubahan tercatat | **Simpan catatan = satu entri log** (+n ditambah, ~n diubah, −n dihapus) |
| Commit history | Tab **Log Pengisian**, dikelompokkan per tanggal aksi, dengan penanda "terlambat" |
| Streak (dulu) | **Rangkaian hari kerja terisi**: sekarang & terpanjang (akhir pekan tanpa catatan tidak memutus) |
| Organization › People | Halaman **Tim** untuk atasan |

Warna grafik memakai **ramp teal** dari palet aplikasi ("Active Teal"), bukan hijau GitHub. Biru `--brand` tetap untuk aksi dan state aktif, sehingga data tidak tertukar dengan tombol.

---

## 5. Model Data (DB `reporthub`, DDL manual idempoten)

`scripts/db/bckh.sql` + `scripts/db/migrate-bckh.mjs`. Hanya `CREATE TABLE IF NOT EXISTS`; tidak ada `ALTER`, `DROP`, atau perubahan tabel lain. Tabel `bckh_*` sengaja tidak memakai FK ke `users`, supaya catatan kinerja tetap ada walau akun dihapus dan alur hapus pengguna di Master tidak terganggu. Antar-tabel `bckh_*` memakai FK `ON DELETE CASCADE`.

| Tabel | Kolom inti | Catatan |
| --- | --- | --- |
| `bckh_profil` | `user_id` PK, `nama_lengkap`, `nama_ttd`, `jabatan`, `nip`, `unit`, `atasan_nama`, `atasan_nip`, `created_at`, `updated_at` | Opsional. Tanpa baris → bawaan dari `users` (gelar + nama, NIP) |
| `bckh_hari` | `id` PK, `user_id`, `tanggal` DATE, `status`, `keterangan`, `created_at`, `updated_at`, **UNIQUE (`user_id`, `tanggal`)** | Satu catatan per pengguna per tanggal |
| `bckh_kegiatan` | `id` PK, `hari_id` FK CASCADE, `urutan`, `uraian` (≤ 300), `kategori`, `target` (`SELESAI`/`PROSES`) | Maks. 30 kegiatan per hari |
| `bckh_log` | `id` PK, `user_id` (pemilik catatan), `aktor_id`, `aktor_nama`, `aksi` (`BUAT`/`UBAH`/`HAPUS`/`EKSPOR`), `tanggal` (hari yang disentuh; bulan untuk ekspor), `rincian` JSON, `ip`, `created_at`; INDEX (`user_id`, `created_at`) | Log pengisian. Tanpa data pasien. Hanya bertambah (*append-only*) |
| `bckh_pengaturan` | `id` = 1, `kop_1`, `kop_2`, `instansi_1`, `instansi_2`, `mengetahui_jabatan`, `mengetahui_nama`, `mengetahui_nip`, `diubah_oleh_*`, `updated_at` | Satu baris global. Tanpa baris → bawaan kop dari dokumen contoh |

---

## 6. Aturan Bisnis

### 6.1. Status hari

| Status | Kegiatan | Kolom CATATAN KINERJA di laporan | TARGET | KET |
| --- | --- | --- | --- | --- |
| `MASUK` | wajib ≥ 1 | daftar kegiatan (bullet "-") | ✓ PROSES bila ada kegiatan berstatus proses, selain itu ✓ SELESAI | keterangan (opsional) |
| `TUGAS_LUAR` | opsional | "TUGAS LUAR" + kegiatan (bila ada) | seperti MASUK (tanpa kegiatan → ✓ SELESAI) | keterangan |
| `OFF`, `CUTI`, `SAKIT`, `IZIN`, `LIBUR` | tidak ada | "OFF" / "CUTI" / … | kosong | keterangan atau label status ("OFF") |

### 6.2. Kegiatan
- **Kategori** (warna mengikuti kategori, urutan tetap):
  1. Tugas Pokok
  2. Pemantauan & Pemeliharaan
  3. Pelayanan & Dukungan
  4. Rapat & Koordinasi
  5. Apel & Administrasi
  6. Pengembangan Diri
  7. Lainnya (netral)
- **Saran kategori otomatis** dari uraian, dan selalu bisa diganti. Contoh: "Monitoring …" → Pemantauan, "Rapat …" → Rapat, "Apel …" → Apel, "Fix Bug …" → Tugas Pokok.
- **Target** per kegiatan: Selesai (bawaan) atau Proses.

### 6.3. Tanggal
- Catatan boleh untuk tanggal **≤ hari ini (WITA)** dan **≥ 1 Januari tahun lalu**. Tanggal masa depan ditolak.
- Mengisi atau mengubah tanggal lampau tetap boleh, tetapi tercatat di log sebagai **terlambat** bila dibuat > H+1.

### 6.4. Konkurensi
- Simpan membawa `versi` (`updated_at` terakhir yang dibaca).
- Bila catatan sudah diubah di tab lain → **409** "Catatan sudah diubah di tempat lain", dan klien memuat ulang.

### 6.5. Metrik dasbor
Periode yang tersedia: bulan atau tahun.

| Metrik | Rumus |
| --- | --- |
| Kepatuhan pengisian | hari kerja (Sen–Jum, s.d. hari ini) yang punya catatan ÷ hari kerja |
| Tepat waktu | catatan yang dibuat paling lambat H+1 ÷ semua catatan |
| Persentase selesai | kegiatan Selesai ÷ semua kegiatan |
| Komposisi kategori | kegiatan per kategori ÷ semua kegiatan |
| Komposisi status hari | hari per status ÷ hari tercatat |

### 6.6. Grafik dan ringkasan profil
- **Tingkat warna grafik:** 0 = tanpa kegiatan; 1–4 = kuartil jumlah kegiatan pada hari-hari berkegiatan dalam rentang tampil, seperti GitHub.
- **Rangkaian (streak):** dihitung mundur dari hari ini (hari ini belum terisi tidak memutus).
  - Hari kerja tanpa catatan memutus.
  - Akhir pekan tanpa catatan dilewati.
  - Catatan apa pun (termasuk Off) menyambung.
- **Kegiatan rutin:** uraian dinormalisasi (huruf kecil, spasi tunggal), 6 tersering dalam 90 hari terakhir.

---

## 7. API (semua JSON `{ data }`, `no-store`)

| Metode & rute | Izin | Fungsi |
| --- | --- | --- |
| `GET /api/bckh/profil?tahun=&u=` | `bckh:view` / `bckh.tim:view` | Profil, grafik (rentang tahun / setahun terakhir), streak, rutin, aktivitas per bulan, tahun tersedia |
| `PUT /api/bckh/profil` | `bckh:update` | Ubah profil sendiri |
| `GET /api/bckh/hari?dari=&sampai=&u=` | view | Daftar catatan + kegiatan dalam rentang (≤ 366 hari) |
| `GET /api/bckh/hari/[tanggal]?u=` | view | Satu catatan (atau `null`) |
| `PUT /api/bckh/hari/[tanggal]` | `bckh:update` | Buat atau ubah catatan sendiri (status, keterangan, kegiatan[], versi). Menulis log |
| `DELETE /api/bckh/hari/[tanggal]?versi=` | `bckh:update` | Hapus catatan sendiri. Menulis log |
| `GET /api/bckh/log?sebelum=&u=` | view | Log pengisian, halaman 30 entri (cursor) |
| `GET /api/bckh/dasbor?dari=&sampai=&u=` | view | Metrik §6.5 |
| `GET /api/bckh/laporan?bulan=YYYY-MM&u=` | view | Pratinjau baris laporan + kelengkapan penandatangan |
| `GET /api/bckh/laporan/pdf?bulan=&u=&unduh=1` | `bckh:print` / `bckh.tim:print` | PDF 1:1. Menulis log `EKSPOR` |
| `GET /api/bckh/tim?bulan=` | `bckh.tim:view` | Ringkasan per pegawai: kegiatan, hari terisi, kepatuhan, terakhir mengisi |
| `GET/PUT /api/bckh/pengaturan` | `bckh.pengaturan:view/update` | Kop & penandatangan "Mengetahui". Diaudit |

**Pengaman tulis** (PUT/DELETE), sama dengan pola pemetaan RL:
- tolak permintaan lintas situs (CSRF);
- batas laju 60/menit per pengguna;
- batas body 32 KB;
- Zod `strictObject`.

---

## 8. Rancangan UI/UX

### 8.1. Navigasi
Workspace baru **BCKH** (ikon buku catatan) dengan item:
- **Profil Saya** → `/bckh`;
- **Tim** → `/bckh/tim`, hanya untuk pemegang `bckh.tim`.

Profil pegawai lain: `/bckh/u/<username>` (hanya-lihat).

### 8.2. Halaman profil (`/bckh`), tata letak dua kolom ala GitHub
- **Kolom kiri** (≥ 1024 px; di ponsel menjadi kepala ringkas):
  - identicon besar, nama, username, jabatan;
  - tombol "Ubah profil";
  - unit, NIP, atasan;
  - rangkaian hari kerja.
- **Kolom kanan:**
  - tab **Ikhtisar · Kegiatan · Log Pengisian · Dasbor · Laporan**, disimpan di `?tab=`;
  - tombol utama **"Catat kegiatan"**.

| Tab | Isi |
| --- | --- |
| **Ikhtisar** | Kegiatan rutin (kartu), grafik kegiatan + pemilih tahun + legenda "Sedikit ▢▢▢▢▢ Banyak", komposisi kategori, aktivitas per bulan |
| **Kegiatan** | Daftar catatan per bulan (pemilih bulan, filter kategori/status, cari uraian), satu kartu per hari, bisa diubah |
| **Log Pengisian** | Riwayat ala *commit history*: dikelompokkan per tanggal aksi, ikon aksi, ringkasan +/~/−, waktu relatif, penanda "terlambat N hari" |
| **Dasbor** | Pemilih periode; 4 tile (kegiatan, kepatuhan, tepat waktu, selesai); komposisi kategori; status hari; kegiatan teratas; kegiatan per bulan |
| **Laporan** | Pemilih bulan; daftar periksa kelengkapan (jabatan, atasan, Mengetahui, hari kerja kosong); pratinjau tabel; tombol **Unduh PDF** & **Buka untuk cetak** |

### 8.3. Panel "Catat kegiatan" (drawer kanan; layar penuh di ponsel)
- **Tanggal:** bawaan hari ini; bila sudah terisi, otomatis mode ubah.
- **Status hari:** kontrol tersegmen.
- **Daftar kegiatan:**
  - uraian dengan saran dari riwayat;
  - kategori (saran otomatis);
  - Selesai/Proses;
  - naik/turun dan hapus.
- **Chip "Kegiatan rutin"** dan tombol **"Salin dari <hari kerja terakhir>"**.
- **Keterangan.**
- **Simpan** (Ctrl+Enter) dan **Hapus catatan**.
- **Penanda aksi pada grafik:** sel yang baru disimpan berdenyut sekali.

### 8.4. Prinsip UX
- Bahasa Indonesia yang lugas.
- Kontrol keyboard penuh: grafik bisa dinavigasi dengan panah dan Enter membuka catatan.
- Fokus terlihat; `prefers-reduced-motion` dihormati.
- Warna tidak pernah menjadi satu-satunya pembeda: grafik punya tooltip + label aria, kategori punya legenda.
- **Responsif:**
  - grafik di ponsel menggulir horizontal (minggu terbaru terlihat lebih dulu);
  - tabel laporan pratinjau bisa digeser;
  - tanpa luapan halaman di 390 px.

---

## 9. Spesifikasi Laporan 1:1 (diukur dari `6. BCKH NOVEMBER.docx`/.pdf)

**Kertas:** **Letter 612 × 792 pt** (8,5 × 11 in), sama dengan dokumen asli.

**Halaman 1 — Sampul:**
- **Bingkai:**
  - persegi membulat (76,8; 38,7), 449 × 734 pt;
  - jari-jari 74,8 pt (`roundRect` bawaan Word = 1/6 sisi pendek);
  - garis hitam 0,75 pt.
- **Logo Kab. Bolaang Mongondow Timur:** (271,5; 66,6), 59,5 × 68,2 pt.
- **Kop** (bold sans 16 pt, baseline 160,6 & 180,1, tengah ±306): "PEMERINTAH KABUPATEN" / "BOLAANG MONGONDOW TIMUR".
- **Kotak abu:**
  - fill `#A4A4A4`, tepi `#F1F1F1` 3 pt, bayangan kanan-bawah;
  - (82,8; 271,7), 430,1 × 74,8 pt;
  - isi "DINAS KESEHATAN" / "RSUD BOLAANG MONGONDOW TIMUR" (bold 17 pt, baseline 293,1 & 314,1).
- **Kotak biru:**
  - fill `#5A9BD4`;
  - (82,8; 365,3), 430,1 × 95,35 pt;
  - isi "LAPORAN KINERJA HARIAN" (bold 18 pt, baseline 388,9), "TAHUN yyyy" & "( BULAN NAMABULAN )" (bold 12 pt, baseline 405,2 & 419,8).
- **Identitas** (Times 12 pt):
  - label x 116,2; titik dua x 189,4; isi x 217,7;
  - baseline 510,9 / 528,5 / 547,5 untuk NAMA, JABATAN, NIP ("-" bila kosong).
- **"TAHUN yyyy":** bold 20 pt, baseline 654,6.

**Halaman 2+ — Tabel:**
- **Posisi:** x 58,85 → 576, mulai y 40,5. Batas bawah halaman 778 pt (margin bawah 14 pt).
- **Kolom (twip Word → pt):**

  | NO | HARI / TANGGAL | CATATAN KINERJA | PROSES | SELESAI | KET |
  | --- | --- | --- | --- | --- | --- |
  | 28,1 | 91,25 | 192,25 | 63,8 | 63,8 | 77,95 |

- **Kepala 2 baris** (Times Bold 12, tinggi 28 pt): "NO", "HARI /⏎TANGGAL", "CATATAN KINERJA", "TARGET" di atas "PROSES" & "SELESAI", "KET". Kepala **tidak diulang** di halaman berikutnya (seperti asli).
- **Isi** (Times 12):
  - nomor "n." dan "Hari, dd/mm/yyyy" rata atas (tanggal dibungkus bila tak muat);
  - kegiatan berpoin "-" (x +36 pt dari kiri kolom, teks gantung +18 pt), jarak baris 15,87 pt (1,15×);
  - ✓ (garis vektor) di tengah vertikal kolom PROSES/SELESAI;
  - KET di tengah.
- **Baris tidak dipecah antarhalaman**, kecuali satu baris lebih tinggi dari satu halaman.
- **Nomor urut** 1..n tanpa celah. Hanya tanggal yang punya catatan yang dicetak, urut tanggal.

**Blok tanda tangan** (Times 11 pt, setelah tabel ±40 pt; pindah halaman bila tak muat):
- "YANG MELAPORKAN" (tengah x 186,3) dan "ATASAN LANGSUNG" (tengah x 446);
- nama bergaris bawah 50,7 pt di bawahnya; "NIP. …" atasan;
- "MENGETAHUI," / jabatan Mengetahui (tengah x 311);
- nama bergaris bawah + "NIP. …" (tengah x 316,4).

**Font:**
- **Times-Roman/Times-Bold** (standar PDF) = Times New Roman asli, metrik setara.
- Judul sampul aslinya Calibri/Tahoma/Leelawadee, yang tidak boleh disertakan di server (lisensi). Diganti **Helvetica-Bold yang dipadatkan horizontal** (operator `Tz`) supaya lebar dan tinggi hurufnya sama dengan aslinya.

**Nama berkas:** `BCKH_<Nama>_<YYYY-MM>.pdf`. Ekspor tercatat di log (`EKSPOR`).

---

## 10. Keamanan

- **RBAC server-side** di setiap route, dengan pemisahan pemilik vs tim (§3). ID target divalidasi dan pengguna harus ada.
- **Validasi input:** Zod strict untuk semua input; tanggal divalidasi kalender + rentang; teks dipangkas dan dibatasi panjangnya; karakter kontrol dibuang.
- **Query:** Prisma (parameter terikat), tanpa SQL mentah dari input.
- **Pengaman tulis:** CSRF lintas situs ditolak, batas laju, dan batas body.
- **PDF:** teks melalui sanitasi WinAnsi; tidak ada berkas dari pengguna yang disisipkan.
- **Log:** tanpa data pasien. Log hanya-tambah; tidak ada API untuk mengubah atau menghapus log.
- **Pengaturan:** perubahan tercatat di `audit_log` (`bckh.pengaturan`).

---

## 11. Rencana Bertahap

| Stage | Isi | Kriteria selesai |
| --- | --- | --- |
| **B0 Fondasi** | DDL + migrasi, model Prisma, katalog RBAC + workspace, konstanta/tipe/Zod, aturan murni (status → laporan, kategori, streak, kuartil, kepatuhan) | Migrasi idempoten jalan; unit test aturan lulus |
| **B1 Catat & Log** | Service + API catatan harian & log, drawer "Catat kegiatan" (rutin, salin hari kerja terakhir, konkurensi) | Simpan/ubah/hapus tercatat di log; 409 versi; RBAC pemilik |
| **B2 Profil GitHub** | API profil, halaman `/bckh`: sidebar, identicon, grafik interaktif, rutin, komposisi, aktivitas per bulan, ubah profil | Grafik = data; navigasi keyboard; ponsel tanpa luapan |
| **B3 Dasbor** | API + tab Dasbor persentase | Angka = hitung ulang independen |
| **B4 Laporan 1:1** | Pembangun PDF pdf-lib, pratinjau, unduh/cetak, log ekspor, modal pengaturan | Render PDF dibanding berdampingan dengan asli; teks & posisi cocok |
| **B5 Tim** | `/bckh/tim`, profil hanya-lihat `/bckh/u/<username>`, unduh laporan bawahan | Tanpa `bckh.tim` → 403; tidak bisa menulis catatan orang lain |
| **B6 Validasi** | Unit, E2E API+RBAC (prod build :3100 & dev), uji UI (CDP, tangkapan layar), tinjauan keamanan, dokumentasi, memori | Semua lulus, data uji dibersihkan terarah |

---

## 12. Keputusan (diambil dengan bawaan; bisa diubah)

| Pertanyaan | Bawaan yang dipakai |
| --- | --- |
| Hari tanpa catatan ikut dicetak? | **Tidak** — hanya tanggal bercatatan (seperti contoh: akhir pekan tak dicetak). Hari kerja kosong ditampilkan sebagai peringatan di tab Laporan |
| Ukuran kertas | **Letter**, sama dengan dokumen asli |
| Target per kegiatan atau per hari? | **Per kegiatan** (untuk persentase), diringkas per hari di laporan |
| Penandatangan "Mengetahui" | Global (pengaturan), bawaan dari dokumen contoh; atasan langsung per pegawai (profil) |
| Batas tanggal pengisian | ≤ hari ini dan ≥ 1 Jan tahun lalu, tanpa kunci bulan |
| Warna grafik | Ramp teal palet aplikasi (bukan hijau GitHub) |

---

## 13. Status Implementasi (2 November 2026)

Semua stage B0–B6 selesai dan divalidasi di build produksi.

### 13.1. Peta kode

| Lapisan | Berkas |
| --- | --- |
| DDL & migrasi | `scripts/db/bckh.sql`, `scripts/db/migrate-bckh.mjs` (hanya `CREATE TABLE IF NOT EXISTS bckh_*`), model `Bckh*` di `prisma/app/schema.prisma` |
| Aturan murni (aman untuk klien) | `src/server/modules/bckh/bckh.constants.ts`, `bckh.aturan.ts`, `bckh.schema.ts`, `bckh.types.ts`. Diuji `bckh.test.ts` |
| Server | `bckh.akses.ts` (pemilik vs tim, CSRF, batas laju), `bckh.dal.ts`, `bckh.catatan.ts` (simpan/hapus + log, konkurensi), `bckh.profil.ts`, `bckh.laporan.ts` (laporan, dasbor, pengaturan), `bckh.tim.ts`, `bckh.pdf.ts` |
| API | `src/app/api/bckh/{profil,hari,hari/[tanggal],log,dasbor,laporan,laporan/pdf,tim,pengaturan}` |
| Halaman & UI | `/bckh`, `/bckh/tim`, `/bckh/tim/[username]`. Komponen di `src/features/bckh/*` (`GrafikKegiatan`, `CatatDrawer`, `Tab*`, `TimView`, `ui.tsx`). Token `--heat-0..4` & animasi `denyut` di `globals.css` |

### 13.2. Catatan rancangan yang ditetapkan saat implementasi

- **Konkurensi optimistis:**
  - `UPDATE … WHERE id = ? AND updated_at = <versi>` (atomik): dua simpan paralel dengan versi sama menghasilkan tepat satu 200 dan satu 409.
  - ID kegiatan wajib milik catatan itu.
- **Simpan tanpa perubahan** tidak menulis apa pun (versi tetap, tanpa log).
- **Grafik:** minggu dimulai **Senin** (pekan kerja); ukuran sel cair 9–15 px mengikuti lebar kartu.
- **Bulan bawaan** tab Laporan/Dasbor dan halaman Tim pada tanggal ≤ 7 adalah **bulan lalu** (masa penyusunan laporan).
- **GET unduh PDF** menolak navigasi lintas situs. GET itu menulis log EKSPOR, dan cookie `SameSite=Lax` tetap terkirim pada navigasi dari situs lain.
- **Kalibrasi PDF:** posisi diukur dari `6. BCKH NOVEMBER.docx` (twip) dan render PDF-nya (pdf.js), lalu dibandingkan berdampingan per halaman. Font Times = lebar Times New Roman (selisih ≤ 1%). Judul sampul memakai Helvetica-Bold dengan `Tz` 86–99%; teks kotak abu diberi goresan 0,45 pt (bobot Tahoma Bold).

### 13.3. Verifikasi

| Uji | Hasil |
| --- | --- |
| `tsc`, ESLint (seluruh repo) | bersih |
| Unit (Vitest) | 551/551 (aturan BCKH, skema, katalog RBAC, halaman awal) |
| E2E API `scratchpad/bckh-e2e.mjs` (build produksi :3100) | **106/106** — rincian di bawah tabel |
| UI `scratchpad/bckh-ui.mjs` (headless Chrome) | **23/23** — rincian di bawah tabel |
| Kinerja | profil ±13 ms, PDF ±150 ms, Tim ±40 ms |

**Cakupan E2E:**
- **RBAC:** pemilik / hanya-lihat / tim / tim tanpa print / pengaturan / tanpa izin; lintas situs (tulis & unduh PDF); 404 pengguna.
- **Validasi:** 21 kasus 422/413/429.
- **Catatan:** CRUD, versi 409, simpan paralel, kegiatan milik orang lain, CASCADE tanpa yatim, log (rincian +/~/−, cursor, penanda terlambat WITA).
- **Oracle independen:** laporan (setiap baris), dasbor (3 periode), sel grafik, streak, rutin, Tim.
- **PDF:** teks diperiksa per halaman via pdf.js, termasuk 3 halaman Letter dan EKSPOR tercatat.
- **Lainnya:** pengaturan teraudit; halaman dan redirect.
- **Kebersihan:** data uji 0, `bckh_pengaturan` pulih.

**Cakupan UI:**
- **Grafik:** jumlah sel = rentang, warna = API, tooltip termasuk sel tepi, navigasi panah keyboard.
- **Panel Catat:** salin hari kerja terakhir + chip rutin → simpan → toast + sel berdenyut + tersimpan di server.
- **Tab:** Log, Dasbor, dan Laporan sama dengan API.
- **Ponsel 390 px:** tanpa luapan, tombol mengambang.
- **Tim:** daftar dan profil hanya-lihat; tanpa galat JS.

### 13.4. Deploy

```sh
docker compose run --rm migrate scripts/db/migrate-bckh.mjs   # tabel bckh_* (idempoten)
docker compose build && docker compose up -d
```

Setelah deploy, Admin memberi hak lewat **Master › Peran & Hak Akses**:
- `Catatan Kegiatan Saya` (view, update, print) untuk peran pegawai;
- `BCKH Tim (Atasan)` untuk atasan;
- `Pengaturan Laporan BCKH` untuk kepegawaian.

Penandatangan "Mengetahui" memakai nilai bawaan dokumen contoh sampai diubah di tab Laporan › **Pengaturan laporan**.

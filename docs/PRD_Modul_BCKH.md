# PRD & Rencana Bertahap — **BCKH (Buku Catatan Kegiatan Harian)**

## Modul baru: catat kegiatan harian ala profil GitHub, log pengisian, dasbor persentase, dan cetak Laporan Kinerja Harian 1:1

**Project:** ReportHub (`reporthubrsb`) · Workspace baru **BCKH** (`/bckh`)
**Organisasi:** UPTD RSUD Bolaang Mongondow Timur
**Versi:** 1.2 · **Tanggal:** 3 November 2026 · **Status:** B0–B6 selesai (§13); v1.1 = status Remote, foto profil, responsif tanpa gulir menyamping (§14); v1.2 = persetujuan & tanda tangan atasan → direktur, Pegawai saya, log berhalaman, pengaturan didesain ulang, tab Summary (§15)
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
| Avatar (foto / *identicon*) + nama + username | **Foto profil** yang bisa diganti (unggah, potong persegi, hapus) — tanpa foto → *identicon* 5×5 dari ID pengguna — + nama lengkap + username + jabatan |
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

**Foto profil** tidak disimpan di tabel (tabel `bckh_*` tidak diubah): berkas di folder penyimpanan aplikasi (`STORAGE_DIR`, di produksi bind mount `./storage`) `bckh/avatar/<userId>/<versi>.<webp|jpg|png>`, `versi` = 16 heks pertama SHA-256 isi. Berkas terbaru = foto aktif; berkas lama dihapus saat foto diganti. Tanpa berkas → identicon.

---

## 6. Aturan Bisnis

### 6.1. Status hari

| Status | Kegiatan | Kolom CATATAN KINERJA di laporan | TARGET | KET |
| --- | --- | --- | --- | --- |
| `MASUK` | wajib ≥ 1 | daftar kegiatan (bullet "-") | ✓ PROSES bila ada kegiatan berstatus proses, selain itu ✓ SELESAI | keterangan (opsional) |
| `TUGAS_LUAR` | opsional | "TUGAS LUAR" + kegiatan (bila ada) | seperti MASUK (tanpa kegiatan → ✓ SELESAI) | keterangan |
| `REMOTE` (v1.1) | wajib ≥ 1 | daftar kegiatan, tanpa baris status | seperti MASUK | keterangan, atau **"REMOTE"** bila kosong |
| `OFF`, `CUTI`, `SAKIT`, `IZIN`, `LIBUR` | tidak ada | "OFF" / "CUTI" / … | kosong | keterangan atau label status ("OFF") |

Remote = bekerja jarak jauh: dihitung **hari bekerja** di semua metrik (grafik, rata-rata per hari, pola mingguan, Tim), sama seperti Masuk dan Tugas Luar. Kolom `status` (`VARCHAR(16)`) sudah memuat nilai baru, sehingga tidak ada perubahan tabel.

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
| `GET /api/bckh/avatar?u=&v=` (v1.1) | `bckh:view` / `bckh.tim:view` | Foto profil (`?v=` cocok → cache permanen). 404 = belum berfoto. `nosniff` + CSP `sandbox` |
| `POST /api/bckh/avatar` (v1.1) | `bckh:update` | Pasang/ganti foto SENDIRI (multipart `avatar`; JPG/PNG/WebP dari isi berkas, ≤ 512 KB, ≤ 1024×1024 px) |
| `DELETE /api/bckh/avatar` (v1.1) | `bckh:update` | Hapus foto sendiri → identicon |

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

Profil pegawai lain: `/bckh/tim/<username>` (hanya-lihat).

### 8.2. Halaman profil (`/bckh`), tata letak dua kolom ala GitHub
- **Kolom kiri** (≥ 1280 px; di bawahnya menjadi kepala profil di atas tab — §14.3):
  - foto profil besar (atau identicon), dengan lencana kamera untuk menggantinya; nama, username, jabatan;
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
- **Responsif tanpa gulir menyamping** di semua lebar (v1.1, menggantikan rancangan awal "grafik menggulir horizontal") — rincian §14.3.

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
| API | `src/app/api/bckh/{profil,hari,hari/[tanggal],log,dasbor,laporan,laporan/pdf,tim,pengaturan,avatar}` (avatar: v1.1, `bckh.avatar.ts` + `src/server/lib/info-gambar.ts`) |
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

---

## 14. v1.1 — Status Remote, Foto Profil, Responsif (2 November 2026)

Permintaan pengguna: tampilan menyesuaikan semua ukuran layar, avatar profil BCKH bisa diganti, bagian profil/tab tidak perlu digulir kanan-kiri, dan status hari **Remote**. Tetap tanpa SIMGOS dan **tanpa perubahan tabel** (tidak ada `ALTER`/tabel baru).

### 14.1. Status Remote
- Aturan & laporan: §6.1. `STATUS_WAJIB_KEGIATAN` = Masuk + Remote (skema & panel Catat menolak Remote tanpa kegiatan).
- KET laporan bawaan `KET_LAPORAN_BEKERJA.REMOTE` = "REMOTE" (`ketBawaan()` dipakai laporan, PDF, dan placeholder Keterangan di panel Catat).
- UI: chip status "Remote" di panel Catat (+ petunjuk), lencana hijau, tooltip grafik "n kegiatan (remote)", linimasa bulanan "· n hari remote".
- Palet status dasbor divalidasi ulang (validator CVD & normal, pasangan bersebelahan): Remote `#008300`; **Izin diganti `#7d5bd0`** (merah muda lama terlalu mirip Sakit, ΔE normal 13,2 < 15). Off/Libur tetap netral.

### 14.2. Foto profil
- **Ganti:** klik foto di profil sendiri (lencana kamera) → modal **Foto profil**: unggah / seret / tempel → bingkai persegi bermasker lingkaran (seret, gulir/cubit, slider, papan ketik: panah, `+`/`−`, `0`) → **Simpan foto**. **Hapus foto** → identicon.
- **Di browser:** orientasi EXIF diterapkan, dipotong & diperkecil ke ≤ 400×400 px, dienkode ulang WebP (JPEG bila tak didukung) → ± 3–60 KB; metadata/lokasi GPS ikut terbuang. Berkas asli maks 25 MB.
- **Di server** (`bckh.avatar.ts`, `server/lib/info-gambar.ts`): jenis dari isi berkas (JPEG SOFn / PNG IHDR / WebP VP8·VP8L·VP8X), ≤ 512 KB, sisi ≤ 1024 px (cegah bom dekompresi di browser atasan); hanya folder milik sendiri; penulisan atomik; berkas lama (lebih tua) dihapus sehingga unggahan bersamaan tak saling menghapus.
- **Tampil:** sidebar/kepala profil, profil hanya-lihat (atasan), daftar Tim. URL berversi → cache permanen; gagal muat → identicon.

### 14.3. Responsif tanpa gulir menyamping
- **Tata letak:** dua kolom ala GitHub hanya mulai **xl (≥ 1280 px)**. Di bawahnya kepala profil: ponsel = foto + nama sebaris, tombol selebar layar; `sm`–`xl` = foto kiri merentang tiga baris, tombol "Ubah profil laporan" di kanan nama, meta & streak di bawah nama.
- **Kolom isi = container** (`@container`): bar tab & isi tab menyesuaikan lebar kolom, bukan lebar layar.
  - **Bar tab:** kolom ≥ 48rem → tab sebaris ala GitHub + tombol "Catat kegiatan"; lebih sempit → 5 kolom sama lebar (ikon di atas label, "Log Pengisian" → "Log", penghitung jadi lencana), tombol jadi ikon "+" (ponsel: tombol mengambang). Tidak pernah menggulir.
  - **Grafik kegiatan:** sel 9–15 px (layar sentuh min. 13 px agar mudah diketuk). Bila 53 minggu tak muat, minggu dibagi ke **pita bertumpuk** (2–4 pita, batas digeser ke awal bulan); navigasi panah lintas pita (±1 hari / ±1 minggu); tooltip dijepit di dalam kartu & dibungkus; label bulan yang tak muat dilewati.
  - **Pemilih tahun** membungkus; **ringkasan** 2/3/1 kolom; kartu rutin, Dasbor (tile 2/4 kolom, panel 1/2), Kegiatan, Laporan (tombol aksi selebar kolom di layar sempit), dan Tim (baris dua tingkat di layar sempit) mengikuti lebar kolom.
  - **Pratinjau laporan:** kertas sempit (< 32rem) → tiap baris jadi blok bertumpuk (NO · HARI/TANGGAL, ✓ target, catatan, KET); lebar → tabel seperti PDF. Teks panjang (`overflow-wrap:anywhere`) tak pernah melebarkan tabel.
- **Perbaikan sampingan:** isi tooltip grafik kini dihitung dari data terbaru (sebelumnya bisa basi "Belum ada catatan" setelah grafik dimuat ulang saat fokus dipulihkan drawer).

### 14.4. Verifikasi v1.1 (build produksi :3100)

| Uji | Hasil |
| --- | --- |
| `tsc`, ESLint (seluruh repo) | bersih |
| Unit (Vitest) | **556/556** (+ Remote di laporan/skema, `info-gambar` JPEG/PNG/WebP/penolakan) |
| E2E API `bckh-e2e.mjs` | **138/138** — + [Remote] (laporan/KET, dasbor, log Remote→Off, PDF "REMOTE") + [Avatar] 21 cek (401/403 izin, CSRF, HTML/SVG berkedok, 3000×3000 → 422, > 512 KB → 413, versi & cache, `nosniff` + CSP `sandbox`, tim 200 / pengisi lain 403, ganti → 1 berkas, hapus → folder hilang) |
| UI `bckh-ui.mjs` | **35/35** — + Remote lewat panel Catat (wajib kegiatan, petunjuk KET, tooltip), foto profil (unggah → bingkai keyboard → simpan WebP 400×400 → hapus), ponsel 390 px tanpa luapan/gulir samping dengan grafik berpita |
| Audit responsif `bckh-responsif.mjs` | **90/90** (15 lebar 320–2560 px × 6 halaman; layar sentuh & mouse): luapan halaman 0, elemen bergulir samping 0, elemen keluar layar 0, bar tab pas, label grafik tak terpotong, tanpa galat JS |

Deploy: tanpa migrasi baru (cukup `docker compose build && docker compose up -d`). Foto tersimpan di bind mount `./storage` yang sudah ada (pemilik UID 1001).

---

## 15. v1.2 — Persetujuan & Tanda Tangan, Pegawai Saya, Log Berhalaman (3 November 2026)

Permintaan pengguna:
- kartu pengaturan laporan lebih interaktif dan elegan;
- log pengisian berhalaman;
- tab "Ikhtisar" diganti "Summary";
- menu bagi atasan untuk melihat pegawainya beserta profil BCKH-nya;
- pegawai mengajukan laporan bulanan untuk disetujui dan **ditandatangani** atasan langsung, lalu diketahui direktur.

**Keputusan pengguna (3 Nov):**
- Boleh menambah **tabel baru** di DB `reporthub`. Tabel `bckh_*` lama tidak diubah dan SIMGOS tidak disentuh.
- Atasan dipilih pegawai sendiri di profil, sebagai **akun**. Akun direktur ("Mengetahui") dipilih admin di Pengaturan laporan.
- Alur **berurutan**: atasan dulu, lalu direktur. Pegawai boleh memilih cukup sampai atasan.
- PDF memuat **gambar TTD dan QR verifikasi**. Halaman verifikasinya perlu login.

### 15.1. Model data (tabel baru, DDL di `scripts/db/bckh.sql`, idempoten)

| Tabel | Isi |
| --- | --- |
| `bckh_atasan` | Pegawai → **akun** atasan langsung, satu baris per pegawai (`user_id` PK, `atasan_id` terindeks). Nama/NIP atasan untuk cetak tetap di `bckh_profil` dan terisi otomatis saat akun dipilih. |
| `bckh_setelan` | Setelan global kunci–nilai. Kunci `mengetahui_id` = akun direktur penanda tangan "Mengetahui". Dibuat kunci–nilai agar setelan berikutnya tak perlu `ALTER`. |
| `bckh_pengajuan` | Satu pengajuan per (pegawai, bulan, percobaan); lihat kolom di bawah tabel ini. |
| `bckh_ttd` | Gambar TTD per pengajuan × peran (PEGAWAI / ATASAN / MENGETAHUI): PNG yang dinormalkan server, SHA-256, penanda tangan, IP, waktu. Sekali tulis. |

Kolom utama `bckh_pengajuan`:
- `status`;
- `aktif` = `'1'` selama berjalan atau disetujui, NULL bila berakhir. `UNIQUE(user_id, bulan, aktif)` menjamin hanya satu pengajuan aktif per bulan, juga saat dua klik terjadi bersamaan;
- `sampai_mengetahui`;
- akun penanda tangan yang dibekukan saat pengajuan: `atasan_id`, `mengetahui_id`;
- `isi` = **snapshot laporan** (profil, pengaturan, baris) beserta segelnya di `isi_sha256`. Segel itu **HMAC-SHA256 berkunci server**, bukan SHA-256 polos. Kuncinya diturunkan dari `FORM_RM_KUNCI_INTEGRITAS` dengan label `bckh.pengajuan.isi.v1`, jadi isi yang diubah langsung di DB tidak bisa disegel ulang. Tanpa kunci, pengajuan ditolak 503;
- `token` 128-bit untuk URL verifikasi;
- catatan pegawai, alasan tolak/batal, dan pelaku pengakhiran.

### 15.2. Alur & aturan

```
            ajukan (+TTD pegawai)
 (tidak ada) ─────────────────────▶ MENUNGGU_ATASAN ──setujui (+TTD atasan)──▶ MENUNGGU_MENGETAHUI ──setujui (+TTD direktur)──▶ DISETUJUI
                                       │      └─ bila tidak sampai Mengetahui ───────────────────────────────────────────────▶ DISETUJUI
                                       ├─ tolak (alasan) ▶ DITOLAK         (juga dari MENUNGGU_MENGETAHUI)
                                       └─ tarik (pegawai) ▶ DITARIK        (juga dari MENUNGGU_MENGETAHUI)
 DISETUJUI ── batalkan (atasan/direktur pengajuan itu, alasan) ▶ DIBATALKAN
```

**Mengajukan.** Syarat:
- bulan ≤ bulan berjalan dan sudah ada catatan;
- jabatan terisi;
- akun atasan sudah dipilih dan bukan diri sendiri;
- bila sampai Mengetahui, akun direktur sudah diatur.

Pegawai menandatangani sebagai "Yang melaporkan". Snapshot laporan dibekukan saat itu, dan PDF yang disahkan selalu dibangun dari snapshot, sehingga perubahan profil/pengaturan sesudahnya tidak mengubah dokumen bertanda tangan. Bila bulan yang diajukan belum berakhir, UI memberi peringatan.

**Kunci.** Selama pengajuan aktif (menunggu atau disetujui), catatan bulan itu tak bisa dibuat, diubah, atau dihapus (409). Untuk mengubah: pengajuan ditarik, ditolak, atau dibatalkan.

**Penanda tangan.** Hanya akun yang dituju pada tahap berjalan yang bisa menyetujui atau menolak; superadmin pun tidak bisa menandatangani atas nama orang lain. Ia juga harus memegang `bckh.persetujuan:update`. Setiap transisi berupa update bersyarat status (atomik), jadi persetujuan ganda bersamaan ditolak 409.

**TTD.** Bisa digambar, diunggah, lewat kamera, atau via HP (komponen `SignaturePad` Form RM). Bisa juga memakai **TTD tersimpan** milik sendiri, yaitu tabel Form RM `form_rm_ttd_petugas` yang sama, sehingga satu TTD berlaku di dua modul. Server menormalkan PNG (`normalkanPng`).

**Log pengisian** mendapat aksi `AJUKAN` / `TARIK` / `SETUJU` / `TOLAK` / `BATAL` (rincian: bulan, peran, alasan ≤ 200 karakter).

### 15.3. Hak akses

Modul baru **`bckh.persetujuan`** "Pegawai & Persetujuan (Atasan)":
- `view` = menu, kotak masuk, pegawai saya, profil bawahan (hanya-lihat);
- `update` = setujui/tolak/batalkan & TTD;
- `print` = unduh laporan bawahan.

**Bawahan** seorang penampil adalah pegawai yang memilih akunnya sebagai atasan, atau semua pegawai bila ia direktur "Mengetahui". Pegawai yang pernah mengajukan kepadanya juga ikut, untuk riwayat.

`aksesBaca` kini mengizinkan pegawai lain bila penampil memegang `bckh.tim`, atau memegang `bckh.persetujuan` dan target adalah bawahannya.

Daftar akun yang bisa dipilih sebagai atasan/direktur: pengguna aktif yang perannya memegang `bckh.persetujuan:update`, atau superadmin.

### 15.4. UI

- **Tab "Summary"** (dulu Ikhtisar; kunci URL tetap `ikhtisar`).
- **Laporan › kartu "Persetujuan & tanda tangan"**:
  - stepper Diajukan → Atasan → Mengetahui → Disetujui, berisi nama, waktu, dan gambar TTD;
  - tombol **Ajukan tanda tangan** membuka dialog: ringkasan kelengkapan, tujuan (atasan saja / sampai Mengetahui), catatan, dan TTD pegawai;
  - **Tarik pengajuan**;
  - alasan tolak/batal ditampilkan;
  - pratinjau memakai snapshot saat pengajuan aktif.
- **Pengaturan laporan** (modal didesain ulang):
  - dua bagian, Kop sampul dan Penandatangan "Mengetahui";
  - **pratinjau langsung** sampul dan blok TTD;
  - pemilih **akun direktur** yang mengisi nama/NIP;
  - penanda "diubah", kembalikan bawaan per bidang, info terakhir diubah.
- **Ubah profil laporan:** pemilih **akun atasan** (cari nama) yang mengisi nama/NIP atasan; tetap bisa diubah manual untuk cetak.
- **Menu "Pegawai & Persetujuan"** (`/bckh/persetujuan`), tiga tab:
  - **Perlu tanda tangan** (lencana jumlah): kartu pengajuan → panel tinjau berisi pratinjau kertas snapshot, tahapan, dan aksi **Setujui & tanda tangani** / **Tolak**;
  - **Riwayat**: semua pengajuan yang pernah dituju, termasuk tombol batalkan bila disetujui;
  - **Pegawai saya**: master–detail, yaitu daftar (cari, filter status laporan bulan) dan panel detail (identitas, kepatuhan, grafik 5 minggu, status laporan bulan, kegiatan terakhir, tautan profil lengkap). Di ponsel detailnya tampil di drawer.
- Profil bawahan hanya-lihat di `/bckh/persetujuan/pegawai/<username>`.
- **Log berhalaman:**
  - 20 entri per halaman dengan nomor halaman;
  - filter Semua / Catatan / Laporan / Persetujuan;
  - "Menampilkan a–b dari n";
  - ganti filter kembali ke halaman 1; halaman di luar jangkauan dijepit server ke halaman terakhir. API lama `?sebelum=` (cursor) dihapus dan kini ditolak 422.
- **Verifikasi** `/bckh/verifikasi/<token>` (perlu login, pemegang salah satu izin BCKH):
  - status keaslian, identitas, bulan, penanda tangan dan waktunya;
  - kode SHA-256 snapshot;
  - tautan PDF bila penampil berhak.

### 15.5. PDF

Bila bulan punya pengajuan **aktif**, PDF dibangun dari snapshot:
- gambar TTD yang sudah ada dibubuhkan di atas nama tiap blok (Yang melaporkan, Atasan langsung, Mengetahui);
- bila **DISETUJUI**, QR verifikasi 56 pt ditambahkan di kanan blok "Mengetahui", dengan keterangan "Disahkan elektronik" dan kode 8 heksa.

Tanpa `PUBLIC_APP_ORIGIN`, QR tidak dicetak (hanya kode). Tata letak 1:1 lainnya tidak berubah.

Bila isi snapshot tidak cocok dengan segelnya, sistem gagal tertutup (fail-closed):
- PDF tidak diterbitkan (409);
- pengajuan tidak bisa disetujui (409), tetapi masih bisa ditolak;
- halaman verifikasi menampilkan "Isi dokumen tidak cocok".

### 15.6. API baru

| Endpoint | Izin | Keterangan |
| --- | --- | --- |
| `GET /api/bckh/penyetuju` | `bckh:update` atau `bckh.pengaturan:update` | Akun yang bisa dipilih sebagai atasan / direktur |
| `GET /api/bckh/pengajuan?bulan=&u=` | `bckh:view` (sendiri), `bckh.tim:view`, atau `bckh.persetujuan:view` + bawahan | Status bulan: pengajuan aktif (snapshot + TTD), atau yang terakhir berakhir, plus kesiapan mengajukan |
| `POST /api/bckh/pengajuan` `{bulan, sampaiMengetahui, catatan, ttd}` | `bckh:update`, CSRF, laju | Ajukan laporan SENDIRI + TTD pegawai |
| `POST /api/bckh/pengajuan/<id>/tarik` | `bckh:update` | Hanya pemilik, sebelum disahkan |
| `GET /api/bckh/persetujuan?tab=menunggu\|riwayat&halaman=` | `bckh.persetujuan:view` | Kotak masuk penanda tangan (20 per halaman) + jumlah menunggu |
| `GET /api/bckh/persetujuan/<id>` | `bckh.persetujuan:view` + berhak atas pemilik | Detail + snapshot + gambar TTD + status segel |
| `POST /api/bckh/persetujuan/<id>/setujui\|tolak\|batalkan` | `bckh.persetujuan:update`, CSRF, laju | Setujui `{ttd}`, tolak / batalkan `{alasan}`. Hanya akun yang dituju; klik ganda → 409 |
| `GET /api/bckh/persetujuan/pegawai?bulan=` | `bckh.persetujuan:view` | Pegawai saya + kepatuhan + status laporan bulan |
| `GET/PUT/DELETE /api/bckh/ttd-saya` | `bckh` atau `bckh.persetujuan` | TTD tersimpan milik sendiri (tabel Form RM `form_rm_ttd_petugas`) |
| `GET /api/bckh/log?halaman=&jenis=` | seperti sebelumnya | Berhalaman nomor; `jenis` = semua / catatan / laporan / persetujuan |

Halaman baru:
- `/bckh/persetujuan` (`?tab=`, `?buka=<id>`);
- `/bckh/persetujuan/pegawai/<username>` (bukan bawahan → 404);
- `/bckh/verifikasi/<token>` (login + salah satu izin BCKH; tanpa login diarahkan ke login dengan `callbackUrl`).

`PUT /api/bckh/profil` menerima `atasanId` dan `PUT /api/bckh/pengaturan` menerima `mengetahuiId` (opsional). Keduanya wajib akun penyetuju yang sah; atasan tidak boleh diri sendiri. Perubahan akun direktur diaudit.

### 15.7. Peta kode

| Lapisan | Berkas |
| --- | --- |
| DB | `scripts/db/bckh.sql` (+4 tabel), `migrate-bckh.mjs`, model Prisma `BckhAtasan`/`BckhSetelan`/`BckhPengajuan`/`BckhTtd` |
| Server | `bckh.relasi.ts` (bawahan, daftar penyetuju, setelan), `bckh.persetujuan.ts` (alur, segel, kotak masuk, pegawai saya, verifikasi, bahan PDF), `bckh.catatan.ts` (kunci bulan + log berhalaman), `bckh.akses.ts` (relasi atasan), `bckh.pdf.ts` (TTD + QR), `server/lib/pdf-qr.ts` (QR vektor bersama, juga dipakai label inventaris) |
| UI | `KartuPersetujuan.tsx` (stepper, dialog ajukan, tarik), `TinjauPengajuan.tsx` (panel tinjau & tanda tangan), `PersetujuanView.tsx`, `PegawaiSaya.tsx`, `PemilihAkun.tsx`, `TtdBckh.tsx` (SignaturePad Form RM + TTD tersimpan), `KertasLaporan.tsx` (pratinjau kertas + blok TTD), `PengaturanModal.tsx` (didesain ulang), `ProfilModal.tsx` (akun atasan), `TabLog.tsx` (berhalaman) |

### 15.8. Verifikasi v1.2 (build produksi :3100)

| Uji | Hasil |
| --- | --- |
| `tsc`, ESLint (seluruh `src`) | bersih |
| Unit (Vitest) | **563/563** (+ alur status, tarik/batal, kode, ringkasan baris, skema ajukan/setujui/alasan, log berhalaman, `modules.test` modul baru) |
| E2E persetujuan `bckh-aju-e2e.mjs` | **108/108**. Mencakup: penyetuju sah, relasi akses (atasan / direktur / bukan bawahan / akun tak ada → 403), halaman bawahan 404, syarat & validasi TTD (SVG/HTML/PNG rusak → 422), CSRF, ganda → 409, kunci catatan, giliran tahap, klik ganda → 409, PDF 2→3 TTD, verifikasi (sah / tanpa tautan PDF / token tak dikenal / tanpa login → login / tanpa izin → 403), batal → terbuka lagi, tolak, tarik, setujui bersamaan (tepat satu sukses), satu pengajuan aktif per bulan di DB, segel HMAC (isi diubah di DB → setujui & PDF 409, verifikasi "tidak cocok"), log persetujuan & halaman, TTD tersimpan hanya milik sendiri |
| UI `bckh-aju-ui.mjs` | **42/42**. Mencakup: label Summary, log halaman 2 + filter, ajukan dengan TTD digambar di kanvas, tinjau & tanda tangan atasan → direktur (`?buka=`), kartu "Disahkan" → verifikasi, pegawai saya master–detail + profil bawahan, pratinjau langsung pengaturan + kembalikan bawaan, ponsel 390 px (tab 3 kolom, detail & tinjau di drawer, tanpa luapan), tanpa galat JS |
| Regresi | E2E BCKH 138/138 (uji log disesuaikan ke halaman nomor), UI 35/35, laci 8/8, audit responsif 14 lebar × 6 halaman bersih, label QR inventaris tetap terbangun |
| Data | data uji 0 tersisa; `bckh_setelan` & `bckh_pengaturan` dipulihkan persis; data nyata tak berubah |

### 15.9. Deploy v1.2

1. `docker compose build`
2. `docker compose run --rm migrate scripts/db/migrate-bckh.mjs`. Idempoten: hanya `CREATE TABLE IF NOT EXISTS`, menambah 4 tabel baru, tanpa `ALTER`/`DROP`.
3. `docker compose up -d`
4. Pastikan `FORM_RM_KUNCI_INTEGRITAS` sudah ada di `.env` produksi. Kunci ini sudah dipakai Form RM dan **jangan diganti**.
5. Master › Peran: beri peran atasan dan direktur hak **Pegawai & Persetujuan** (lihat, ubah, cetak).
6. Admin memilih akun direktur di Laporan › Pengaturan laporan.
7. Pegawai memilih akun atasan di "Ubah profil laporan".

QR verifikasi memakai `PUBLIC_APP_ORIGIN` / `SIGN_PUBLIC_ORIGIN`. Tanpa salah satunya, PDF hanya mencetak kode verifikasi.

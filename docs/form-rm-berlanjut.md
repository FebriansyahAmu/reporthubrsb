# Panduan IT — Form RM berlanjut IGD → Rawat Inap

Panduan deploy dan pengoperasian **isian bersama IGD → rawat inap** untuk RM.03 General Consent, RM.21 Edukasi Pasien & Keluarga Terintegrasi, dan RM.01 Ringkasan Masuk & Keluar. Ditujukan untuk tim IT RS dan pengelola rekam medis.

Rancangan lengkap, penilaian keamanan OWASP, dan hasil uji ada di [PRD_Form_RM_Berlanjut_IGD_RI.md](./PRD_Form_RM_Berlanjut_IGD_RI.md). Hak per rute ada di [rbac/02-otorisasi.md §5.2](./rbac/02-otorisasi.md).

---

## 1. Cara kerja singkat

1. Pasien IGD yang dirawat inap mendapat **NOPEN baru** di SIMGOS. Aplikasi menautkan episode rawat inap itu ke episode IGD asal:
   - ada **SPRI** dari IGD → tertaut otomatis saat petugas RI membuka form;
   - tanpa SPRI, ada pendaftaran IGD pasien yang sama **≤ 24 jam** sebelumnya → petugas RI wajib memilih **Lanjutkan isian IGD** atau **Isi terpisah**.
2. Ketiga form disimpan **satu isian per perawatan** (di episode IGD). Petugas IGD dan RI membuka dokumen yang sama.
3. Simpan bersifat **per kolom**: kolom berbeda yang diubah bersamaan digabung otomatis; kolom yang sama memunculkan pilihan **Pakai milik saya / Pakai milik <nama>**.
4. Perubahan petugas lain tampil di layar **kurang dari 1 detik** lewat satu koneksi **SSE** per tab yang sedang terlihat, beserta "Juga membuka: …".
5. Setiap perubahan dicatat di **log per kolom** (nilai sebelum → sesudah, siapa, unit/ruang, jam), disegel HMAC berantai. Tab **Perubahan** di Riwayat isian menampilkannya.

Database SIMGOS **hanya dibaca** (SELECT berparameter) untuk menemukan episode IGD asal, jenis leg, nama ruang, dan data pulang. Tidak ada tulis ke SIMGOS.

---

## 2. Deploy ke server produksi

### 2.1 Migrasi database (sekali)

Fitur ini menambah **dua tabel** di database aplikasi (`reporthub`): `form_rm_tautan_episode` dan `form_rm_isian_log`. Tidak ada tabel lama yang diubah bentuknya.

```bash
docker compose run --rm migrate scripts/db/migrate-form-rm.mjs
```

Runner idempoten (`CREATE TABLE IF NOT EXISTS`, tanpa `DROP`), aman dijalankan ulang, dan hanya memakai `DATABASE_URL_APP`. Jangan memakai `prisma db push`.

Cek hasil:

```sql
SELECT table_name FROM information_schema.tables
WHERE table_schema = DATABASE() AND table_name IN ('form_rm_tautan_episode', 'form_rm_isian_log');
-- harus 2 baris
```

### 2.2 Variabel lingkungan

| Variabel | Wajib | Keterangan |
| --- | --- | --- |
| `FORM_RM_KUNCI_INTEGRITAS` | Ya | Sudah dipakai untuk segel revisi FINAL. Kini juga untuk segel log per kolom. Minimal 32 karakter. **Tanpa kunci ini, menyimpan ketiga form ditolak 503** (fail-closed). Jangan diganti setelah ada data: log & revisi lama akan terbaca "tidak cocok". |
| `PUBLIC_APP_ORIGIN` | Ya | Host yang diizinkan pada cek asal-sama (anti-CSRF), termasuk aliran SSE. Sama seperti untuk TTD siaga. |

Tidak ada variabel atau flag baru, dan tidak ada mode debug / "lewati cek".

### 2.3 Hak akses (RBAC)

Tidak ada modul baru. Diatur di **Master › Peran & Hak Akses**:

| Modul | Aksi | Untuk |
| --- | --- | --- |
| `form-rm` atau `form-rm.<kategori>` | view | membuka isian, melihat log perubahan, menerima pembaruan langsung |
| `form-rm` atau `form-rm.<kategori>` | create, update | membuat & mengubah isian; mengonfirmasi tautan ≤ 24 jam |
| `form-rm.kelola` | update | pengelola rekam medis: **Lepas tautan** yang salah, **Buka koreksi** isian FINAL |

Petugas IGD dan RI memakai hak yang sama atas kategori yang sama.

### 2.4 Satu proses aplikasi

Daftar koneksi SSE disimpan di memori proses. Jalankan **satu** container aplikasi (seperti sekarang). Bila kelak diskalakan ke beberapa instance, data tetap aman (simpan memakai transaksi + kunci baris di database), tetapi pembaruan langsung hanya sampai ke pengguna di instance yang sama — perlu pub/sub (Redis) lebih dulu.

### 2.5 Saat aplikasi dimulai ulang / di-deploy

Semua koneksi SSE putus. Browser menyambung ulang sendiri (1 → 30 detik bertahap) lalu mengambil isi terbaru. Ketikan yang belum tersimpan tetap di layar dan disimpan otomatis seperti biasa. Tidak perlu pemberitahuan khusus ke petugas.

---

## 3. nginx

Server produksi: `https://10.202.1.103:8444` → container `127.0.0.1:3003`.

### 3.1 IP klien

Sama seperti panduan TTD siaga: nginx harus menimpa `X-Real-IP` dan `X-Forwarded-For` dengan alamat asli klien (audit & pembatas laju).

### 3.2 Aliran SSE

Aplikasi mengirim `X-Accel-Buffering: no`, `Cache-Control: no-store, no-transform`, dan detak setiap 20 detik. Bila blok aliran TTD siaga sudah dipasang, **perluas pola `location`-nya** agar mencakup aliran isian:

```nginx
location ~ ^/api/(ttd-siaga/aliran|form-rm/ttd-siaga/permintaan/[A-Za-z0-9_-]+/aliran|form-rm/isian/[a-z0-9]{20,32}/aliran)$ {
    proxy_pass http://127.0.0.1:3003;
    proxy_http_version 1.1;
    proxy_set_header Connection "";
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_buffering off;
    proxy_cache off;
    gzip off;
    proxy_read_timeout 1h;
}
```

Gejala bila belum benar: "Juga membuka" tidak muncul, perubahan petugas lain baru tampil setelah beberapa detik, atau baris "Pembaruan langsung terputus — menyambung ulang…" muncul tiap ±60 detik.

### 3.3 Sangat dianjurkan: HTTP/2

```nginx
listen 8444 ssl http2;
```

Setiap tab isian yang **terlihat** memegang satu koneksi SSE. Pada HTTP/1.1, browser membatasi 6 koneksi per origin — petugas yang membuka banyak tab bisa membuat halaman lain lambat dimuat. HTTP/2 menghilangkan batas itu. Tab yang disembunyikan sudah menutup koneksinya sendiri.

### 3.4 Cek cepat setelah konfigurasi

```bash
# Tanpa sesi → 401 seketika (tidak menggantung)
curl -sk -o /dev/null -w "%{http_code}\n" https://10.202.1.103:8444/api/form-rm/isian/abcdefghijklmnopqrst/aliran
curl -sk -o /dev/null -w "%{http_code}\n" https://10.202.1.103:8444/api/form-rm/isian/abcdefghijklmnopqrst/terkini
```

Keduanya harus `401`.

---

## 4. Batas dan kapasitas

| Batas | Nilai | Bila terlewati |
| --- | --- | --- |
| Aliran SSE per pengguna | 8 tab terlihat | 429; tab ke-9 tidak menerima pembaruan langsung (form tetap bisa diisi & disimpan) |
| Aliran SSE total | 400 | 503; sama seperti di atas |
| Umur satu aliran | 10 menit | ditutup lalu tersambung ulang otomatis (hak dicek ulang) |
| Sambung aliran | 30 / menit / pengguna | 429 |
| Ambil isi terkini | 120 / menit / pengguna | 429 |
| Simpan | 60 / menit / pengguna, body 4 MB | 429 / 413 |
| Kolom per simpan | 500 | 422 |

Hasil uji beban di build produksi (PRD §15 Langkah 4): 400 aliran terbuka dalam ±1,2 detik; simpan per kolom p95 ±50 ms (dengan atau tanpa 400 aliran); event ke 300 layar p95 ±70 ms, 0 hilang. Memori proses (RSS) bisa naik hingga ±250–300 MB di atas kondisi diam saat 400 aliran aktif, lalu turun kembali setelah aliran ditutup (6 siklus buka-tutup 400 aliran: tanpa pertumbuhan tertahan). Sediakan ruang memori container minimal ±1 GB.

---

## 5. Pemecahan masalah

| Gejala | Penyebab | Tindakan |
| --- | --- | --- |
| Simpan RM.03/RM.21/RM.01 gagal "Kunci integritas Form RM … belum dikonfigurasi" (503) | `FORM_RM_KUNCI_INTEGRITAS` kosong / < 32 karakter | isi env, mulai ulang container |
| "Data SIMRS untuk menautkan episode IGD → rawat inap tidak dapat dibaca" (503) saat petugas RI membuka form | SIMGOS tak terjangkau / lambat | periksa koneksi SIMGOS; aplikasi sengaja tidak membuat dokumen terpisah selama SIMGOS tak terbaca |
| "Isian ini sedang disimpan petugas lain. Coba lagi sebentar." (503) | simpan bersamaan menunggu kunci baris > 8 detik (sangat jarang) | ulangi; bila sering, periksa beban DB reporthub |
| Pita "Tautan perawatan IGD → rawat inap untuk episode ini sudah berubah. Muat ulang halaman." | pengelola RM melepas tautan episode ini | muat ulang halaman |
| "Anda tidak lagi memiliki akses ke isian ini. Pembaruan langsung dihentikan." | hak kategori dicabut | sesuai harapan |
| Episode RI salah tertaut ke IGD pasien yang sama tapi perawatan berbeda | kandidat ≤ 24 jam dikonfirmasi keliru | pengelola RM: profil pasien RI → **Lepas tautan** (alasan wajib); petugas RI lalu memilih ulang |
| Profil pasien menandai "dua isian untuk perawatan ini" | data lama: episode RI sudah punya isian sendiri sebelum fitur ini | pengelola RM membatalkan salah satu (tidak ada penggabungan otomatis) |

---

## 6. Audit, log, dan integritas

- **audit_log** (tanpa isi kolom & tanpa nama pasien):
  - `form-rm.tautan.otomatis` / `.konfirmasi` / `.terpisah` / `.lepas`;
  - `form-rm.isian.simpan` (metadata `mode: gabung`, jumlah kolom, jumlah timpa, NOPEN konteks), `…finalkan`, `…buka-koreksi`, `…batalkan`, `…muat-ulang-simrs`;
  - `form-rm.isian.log-lihat` (membuka tab Perubahan);
  - `form-rm.isian.terkini` — dirangkum satu entri per petugas per isian per 10 menit (layar yang terbuka mengambil isi terbaru setiap ada perubahan dari petugas lain); pembukaan halaman tetap `form-rm.isian.lihat`.
- **form_rm_isian_log**: nilai kolom sebelum → sesudah. Simpan beruntun oleh petugas yang sama dari konteks yang sama dalam 5 menit digabung jadi satu entri (nilai awal tetap tercatat).
- **Integritas**: setiap entri log disegel HMAC berantai. Perubahan langsung di database (mengubah, menghapus, atau menukar urutan entri) tampil sebagai **masalah integritas** di tab Perubahan.
- **Unit & ruang di log** = episode tempat isian dibuka (dipilih dari anggota rantai dan dibaca dari SIMGOS oleh server), bukan unit kerja petugas. Nama petugas selalu dari sesi login.
- Isi kolom **tidak pernah** dikirim lewat SSE; hanya nama kolom dan siapa/unit/ruang/jam.

---

## 7. Mengembalikan ke versi sebelumnya

Bila aplikasi dikembalikan ke versi sebelum fitur ini, kedua tabel boleh dibiarkan (tidak dibaca versi lama). Isian yang sudah dibuat tetap ada di episode IGD; petugas RI di versi lama akan membuat isian terpisah lagi. Jangan menghapus tabel log bila ada kemungkinan maju lagi — rantai segel akan putus.

---

## 8. Daftar periksa setelah deploy

1. Migrasi selesai; kedua tabel ada (§2.1).
2. `FORM_RM_KUNCI_INTEGRITAS` terisi (≥ 32 karakter) dan sama dengan sebelumnya.
3. Cek cepat nginx (§3.4) → `401` untuk `aliran` dan `terkini`.
4. Uji dua PC: petugas IGD dan petugas RI membuka RM.01 pasien yang sama.
   - Masing-masing melihat "Juga membuka: …".
   - IGD mengubah satu kolom → dalam ±1 detik layar RI ikut berubah dengan pita "<nama> (IGD · …) mengubah: …".
   - Keduanya mengetik di kolom yang sama → yang belum menyimpan langsung melihat panel pilihan.
5. Riwayat isian → tab **Perubahan** → "Log perubahan utuh".
6. Hanya satu container aplikasi berjalan (§2.4).

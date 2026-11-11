# Panduan IT — TTD Perangkat Siaga

Panduan pemasangan dan pengoperasian **tablet siaga tanda tangan** untuk Form RM. Ditujukan untuk tim IT RS (server, jaringan, perangkat) dan pengelola perangkat.

Rancangan lengkap, penilaian keamanan, dan hasil uji ada di [PRD_TTD_Perangkat_Siaga.md](./PRD_TTD_Perangkat_Siaga.md).

---

## 1. Cara kerja singkat

1. Tablet Android dipasang **sekali** dengan kode dari pengelola. Setelah itu tablet membuka `/ttd-siaga` dan siaga terus.
2. Petugas membuka isian Form RM (status **Draf**). Di slot tanda tangan, petugas menekan **Kirim ke tablet siaga** dan memilih tablet.
3. Dalam kurang dari satu detik, tablet menampilkan **kanvas kosong saja**. Tidak ada nama pasien, judul form, atau nama petugas.
4. Pasien menggambar lalu menekan **Kirim**.
5. Petugas melihat pratinjau di PC, lalu memilih **Pakai tanda tangan ini** atau **Minta ulang**.

Tablet tersambung ke server lewat satu koneksi **SSE** (Server-Sent Events) yang selalu terbuka. Server mendorong permintaan lewat koneksi itu, jadi tidak perlu scan QR per tanda tangan.

---

## 2. Deploy ke server produksi (sekali)

### 2.1 Migrasi database

Fitur ini menambah **satu tabel** di database aplikasi (reporthub), yaitu `form_rm_perangkat_ttd`. Database SIMGOS **tidak disentuh**.

```bash
docker compose run --rm migrate scripts/db/migrate-form-rm.mjs
```

Runner ini idempoten (hanya `CREATE TABLE IF NOT EXISTS`), jadi aman dijalankan ulang. Jangan memakai `prisma db push`.

### 2.2 Variabel lingkungan

| Variabel | Wajib | Keterangan |
| --- | --- | --- |
| `PUBLIC_APP_ORIGIN` (atau `SIGN_PUBLIC_ORIGIN`) | Ya | Origin HTTPS yang dijangkau tablet, mis. `https://10.202.1.103:8444`. Dipakai untuk QR pasang, dan sebagai host yang diizinkan pada cek asal-sama (anti-CSRF). Tanpa path, tanpa garis miring di akhir. |

Tidak ada variabel lain. Tidak ada flag "lewati cek" atau mode debug.

### 2.3 Hak akses (RBAC)

Diatur di **Master › Peran & Hak Akses**:

| Modul | Aksi | Untuk siapa |
| --- | --- | --- |
| `form-rm.perangkat` | view, create, update, delete | Pengelola perangkat (IT / kepala ruangan). Menu **Form RM › Perangkat TTD**. |
| `form-rm` atau `form-rm.<kategori>` | update | Petugas yang meminta tanda tangan (hak yang sudah ada untuk mengisi form). |

Pengelola perangkat tidak otomatis bisa membuka formulir pasien, dan petugas tidak otomatis bisa mengelola perangkat.

---

## 3. nginx

Server produksi: `https://10.202.1.103:8444` → container `127.0.0.1:3003`.

### 3.1 Wajib: IP klien yang benar

Pembatas laju per IP dan jejak audit memakai header `X-Real-IP`. nginx **harus menimpanya** dengan alamat asli klien:

```nginx
proxy_set_header X-Real-IP $remote_addr;
proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
```

Tanpa ini, semua tablet terlihat berasal dari satu IP. Akibatnya, batas 12 sambungan baru per IP per menit bisa tercapai bersamaan setelah Wi-Fi putus massal.

### 3.2 Aliran SSE

Aplikasi sudah mengirim `X-Accel-Buffering: no` dan `Cache-Control: no-store, no-transform`, plus detak setiap 20 detik. Biasanya itu cukup.

**Tambahkan blok di bawah bila** tablet menunjukkan "Terputus" sekitar setiap 60 detik, atau permintaan baru sampai setelah jeda beberapa detik:

```nginx
location ~ ^/api/(ttd-siaga/aliran|form-rm/ttd-siaga/permintaan/[A-Za-z0-9_-]+/aliran)$ {
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

Blok ini hanya mencocokkan dua jalur aliran tersebut, jadi tidak membuka rute lain.

### 3.3 Dianjurkan: HTTP/2

```nginx
listen 8444 ssl http2;
```

Pada HTTP/1.1, browser PC membatasi 6 koneksi per origin. Aliran PC hanya hidup selama satu permintaan berjalan, jadi HTTP/1.1 tetap aman. Namun HTTP/2 menghilangkan batas itu sepenuhnya.

### 3.4 Batas ukuran body

Kiriman tanda tangan dibatasi 512 KB oleh aplikasi. Bila nginx memakai `client_max_body_size` di bawah 1 MB, naikkan menjadi minimal `1m`.

### 3.5 Cek cepat setelah konfigurasi

```bash
# Header keamanan halaman tablet (harus ada CSP ber-nonce, X-Frame-Options DENY, no-store)
curl -skI https://10.202.1.103:8444/ttd-siaga

# Aliran tanpa kredensial harus langsung 401 (bukan menggantung)
curl -sk -o /dev/null -w "%{http_code}\n" https://10.202.1.103:8444/api/ttd-siaga/aliran

# Rute tak terdaftar di bawah /api/ttd-siaga harus 404
curl -sk -o /dev/null -w "%{http_code}\n" https://10.202.1.103:8444/api/ttd-siaga/apa-saja
```

Hasil yang diharapkan: perintah kedua `401`, perintah ketiga `404`.

---

## 4. Sertifikat (self-signed)

Sertifikat server produksi tidak dipercaya Android secara bawaan. Pasang sertifikatnya sebagai **CA tepercaya** di setiap tablet. Dengan begitu:
- tidak ada halaman peringatan setiap tablet dinyalakan ulang;
- halaman dianggap konteks aman, sehingga fitur "layar tetap menyala" (Screen Wake Lock) berjalan.

Langkah:
1. Salin berkas sertifikat server (`.crt` / `.pem`, **bukan kunci privat**) ke tablet.
2. Android: **Setelan › Keamanan › Enkripsi & kredensial › Pasang sertifikat › Sertifikat CA**. Nama menu sedikit berbeda antar-merek.
3. Pilih berkasnya dan konfirmasi.
4. Buka `https://10.202.1.103:8444/ttd-siaga` di browser. Halaman harus terbuka tanpa peringatan.

Bila sertifikat server diganti, ulangi langkah ini di semua tablet.

---

## 5. Menyiapkan tablet

**Perangkat:**
- Android 8–10 inci; HP juga bisa dengan pengaturan yang sama;
- **selalu tersambung pengisi daya**;
- tersambung ke Wi-Fi LAN yang menjangkau server;
- stylus kapasitif opsional.

**Browser kiosk (dianjurkan: Fully Kiosk Browser):**

| Pengaturan | Nilai |
| --- | --- |
| Start URL | `https://10.202.1.103:8444/ttd-siaga` |
| Keep Screen On | Aktif |
| Launch on Boot | Aktif |
| Kiosk Mode | Aktif (kunci ke aplikasi, sembunyikan navigasi) |
| Address bar / Tab / Back | Nonaktif |
| Pull to refresh | Nonaktif (supaya tidak terpicu saat menggambar) |
| Remote Admin / Developer tools | Nonaktif, atau dilindungi kata sandi |

**Alternatif tanpa Fully Kiosk:** Chrome + **Sematkan aplikasi** (Screen pinning) + opsi pengembang **Tetap aktif saat mengisi daya**. Cara ini kurang kokoh.

**Wajib di kedua cara:**
- matikan **optimasi baterai** untuk browser;
- izinkan browser berjalan di latar.

Tanpa ini Android bisa memutus koneksi saat layar redup.

---

## 6. Memasang tablet (pengelola)

1. Di PC: **Form RM › Perangkat TTD › Tambah perangkat**. Isi nama yang jelas, mis. "Tablet IGD 1", dan lokasinya.
2. Pada baris perangkat, klik **Kode pasang**. Kode 8 karakter + QR berlaku **10 menit** dan hanya bisa dipakai **sekali**.
3. Di tablet, buka `/ttd-siaga`, lalu ketik kode atau scan QR-nya.
4. Modal di PC berubah menjadi **"Tablet terpasang"**, dan baris perangkat menunjukkan **Terhubung**.

Kredensial tablet disimpan sebagai cookie `HttpOnly` dan diputar otomatis setiap 24 jam. Tablet yang **mati lebih dari 30 hari** harus dipasang ulang.

**Mengganti tablet:** buat kode pasang baru untuk perangkat yang sama, lalu pasang di tablet baru. Tablet lama langsung berhenti.

**Tablet hilang atau dicuri:** segera klik **Cabut**. Aliran tablet tertutup dalam kurang dari 1 detik, permintaan yang sedang berjalan dibatalkan, dan kredensialnya tidak berlaku lagi.

---

## 7. Batas dan kapasitas

| Hal | Batas | Bila terlampaui |
| --- | --- | --- |
| Tablet tersambung bersamaan | 200 | Tablet berikutnya mendapat 503 "Server sedang penuh" dan mencoba lagi otomatis |
| Sambungan baru per IP | 12 / menit | 429, tablet mencoba lagi dengan jeda bertahap 3 → 30 detik |
| Aliran status di PC | 500 | 503 |
| Permintaan aktif per tablet | 1 | 409 "sedang dipakai" |
| Permintaan aktif per petugas | 3 | 429 |
| Permintaan baru per petugas | 20 / menit | 429 |
| Waktu menggambar | 3 menit | Kedaluwarsa, tablet kembali siaga |
| Waktu keputusan petugas | 2 menit | Kedaluwarsa, gambar dibuang |
| PC menutup halaman saat menunggu | 10 detik | Permintaan dibatalkan, tablet kembali siaga |

**Hasil uji beban** (build produksi):
- 300 tablet menyambung serentak: tepat 200 diterima, 100 ditolak 503;
- detak sampai ke semua aliran dengan sebaran 10 ms;
- permintaan sampai ke tablet tujuan dalam 48 ms;
- memori server naik ±126 MB saat 200 aliran terbuka, lalu turun lagi setelah semua putus.

Semua permintaan TTD disimpan di **memori satu proses**. Bila kelak aplikasi dijalankan lebih dari satu instance, hub perlu dipindah ke Redis (PRD §14).

---

## 8. Pemecahan masalah

| Gejala | Kemungkinan penyebab | Tindakan |
| --- | --- | --- |
| Tablet menampilkan layar **Pasangkan tablet ini** | Perangkat dicabut, dipasang di tablet lain, mati > 30 hari, atau kredensial terdeteksi disalin | Lihat audit (§9). Bila wajar, buat kode pasang baru. |
| Titik status tablet merah / "Terputus" | Wi-Fi putus, tablet tertidur, atau server dimulai ulang | Tablet menyambung ulang sendiri. Bila sering: cek optimasi baterai, Wi-Fi, dan blok nginx §3.2. |
| "Terputus" tepat sekitar setiap 60 detik | nginx menahan atau memutus aliran | Pasang blok nginx §3.2. |
| Tablet: **"Layar siaga dibuka di tempat lain"** | Halaman `/ttd-siaga` terbuka di dua tab/perangkat dengan kredensial yang sama | Tutup tab lain, lalu tekan **Pakai di layar ini**. |
| PC: tablet tidak muncul di daftar pilihan | Perangkat belum terpasang atau sudah dicabut | Cek di **Perangkat TTD**. |
| PC: "Terputus" di pilihan tablet | Tablet terpasang tapi tidak tersambung saat ini | Nyalakan tablet / cek Wi-Fi. |
| PC: "Server sedang penuh" / 503 | > 200 tablet tersambung, atau database aplikasi tidak terjangkau | Cek jumlah tablet dan kesehatan DB. Tablet tidak perlu dipasang ulang: saat DB pulih, semuanya tersambung lagi. |
| Permintaan hilang setelah server restart | Permintaan hanya ada di memori | Normal. Petugas cukup menekan **Kirim lagi**. Tablet tersambung ulang otomatis. |

**Saat database aplikasi bermasalah:**
- semua pemeriksaan kredensial tablet menjawab **503**. Cookie tablet tidak dihapus, jadi tablet tidak perlu dipasang ulang;
- aliran yang sudah terbuka tetap hidup;
- rute petugas menolak dengan pesan umum, tanpa detail teknis.

Setelah database pulih, semua kembali normal tanpa restart. Perilaku ini sudah diuji dengan memutus koneksi DB secara sengaja.

---

## 9. Audit dan pemantauan

Semua peristiwa tercatat di log audit aplikasi dengan awalan `form-rm.ttd-siaga.`. Log tidak memuat gambar tanda tangan, token, maupun nama pasien.

| Peristiwa | Arti |
| --- | --- |
| `perangkat-buat`, `perangkat-ubah`, `kode-pasang`, `perangkat-cabut`, `pasang` | Pengelolaan perangkat |
| `minta`, `tampil`, `ttd`, `ulang`, `terima`, `batal`, `kedaluwarsa` | Siklus satu permintaan tanda tangan; `ttd` dan `terima` mencatat sha256 gambar |
| `indikasi-salin` ⚠ | Kredensial lama dipakai setelah diputar: kemungkinan disalin. Perangkat **dicabut otomatis**. |
| `koneksi-ganda` ⚠ | Kredensial yang sama dipakai dari IP berbeda. Bila berulang dari ≥ 2 IP, perangkat dicabut otomatis. |
| `laju-pasang` ⚠ | Percobaan kode pasang melewati batas global: kemungkinan ada yang menebak kode |

Peristiwa bertanda ⚠ bertingkat **peringatan** dan layak ditindaklanjuti.

**Bukti tanda tangan.** sha256 gambar di audit `terima` sama dengan sha256 di tabel `form_rm_ttd` setelah isian disimpan. Saat isian difinalkan, revisinya disegel HMAC.

---

## 10. TTD "Via HP" (cara lama, tetap tersedia)

Metode **Via HP** (petugas menampilkan QR, pasien menandatangani di HP) diperkeras di Langkah 4:
- QR hanya memberi hak **mengirim satu tanda tangan**. Pemegang tautan tidak bisa membaca status maupun gambarnya;
- gambar hanya bisa diambil **sekali**, oleh **akun petugas yang membuat QR**. Akun lain, termasuk superadmin, mendapat 404;
- gambar diperiksa dan disusun ulang server (hanya PNG). Kiriman kedua ditolak;
- halaman HP `/sign/<token>` memakai header keamanan yang sama dengan halaman tablet (CSP ber-nonce, tidak bisa dibingkai, tidak diindeks, tanpa cache), ditambah pembatas laju per IP;
- QR berlaku 10 menit. Satu petugas maksimal punya 10 QR aktif; yang tertua otomatis tidak berlaku.

Tidak ada pengaturan server tambahan untuk Via HP.

---

## 11. Daftar periksa setelah deploy

- [ ] Migrasi §2.1 dijalankan; tabel `form_rm_perangkat_ttd` ada.
- [ ] `PUBLIC_APP_ORIGIN` diisi origin HTTPS produksi.
- [ ] nginx menimpa `X-Real-IP` (§3.1). Cek cepat §3.5 memberi 401 dan 404.
- [ ] Peran pengelola mendapat `form-rm.perangkat`.
- [ ] Sertifikat CA terpasang di tablet; `/ttd-siaga` terbuka tanpa peringatan.
- [ ] Browser kiosk terkonfigurasi (§5); optimasi baterai dimatikan.
- [ ] Satu tablet dipasang, lalu status **Terhubung** bertahan lebih dari 2 menit tanpa putus.
- [ ] Uji satu alur penuh di isian **Draf** uji: Kirim ke tablet → gambar → Pakai → isian tersimpan.
- [ ] Uji **Cabut**: tablet kembali ke layar pasang dalam hitungan detik.

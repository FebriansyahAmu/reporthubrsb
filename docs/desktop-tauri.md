# Aplikasi Desktop AuditTrail RS BOLTIM (Tauri / WebView2)

Panduan untuk **IT RSUD** (memasang, mengatur alamat server, memperbarui) dan **pengembang** (membangun & merilis). Latar belakang dan syarat keamanannya ada di PRD Form RM Terpadu §12.

## 1. Apa ini

Aplikasi Windows kecil yang **hanya membuka server ReportHub** dalam jendela sendiri, dengan ikon di taskbar. Isinya sama persis dengan versi browser. Server Next.js, kredensial SIMGOS, dan secret login **tidak pernah ada di PC**.

| Perilaku | Keterangan |
| --- | --- |
| Satu alamat server | Jendela hanya menampilkan origin server yang diatur (skema + host + port). |
| Tautan ke situs lain | Dibuka di browser bawaan Windows, bukan di jendela aplikasi. |
| Skema berbahaya | `file:`, `javascript:`, `data:`, dan protokol aplikasi lain ditolak. |
| Halaman cetak (`target="_blank"`) | Dibuka di jendela aplikasi baru dengan sesi dan penguncian yang sama. |
| IPC | Tidak ada. Halaman server tidak bisa memanggil fungsi aplikasi apa pun. |
| Izin | Hanya **kamera** (TTD foto, foto barang) dan unduhan beruntun yang boleh **diminta** halaman server; pengguna tetap ditanya. Mikrofon, lokasi, notifikasi sistem, clipboard baca, dan akses berkas ditolak. |
| DevTools | Mati di build rilis. |
| Satu instance | Membuka aplikasi lagi hanya memunculkan jendela yang sudah ada. |
| Pembaruan | Diperiksa saat aplikasi dibuka, dari server ReportHub sendiri. Paket **wajib bertanda tangan** dan diverifikasi sebelum dipasang. |
| Keluar otomatis saat idle | Sama dengan browser (K6, `SESI_IDLE_MENIT`). |
| Halaman pertama | `/desktop`: server mengalihkan ke **Form RM** bila peran pengguna punya akses salah satu modul Form RM, selain itu ke `/beranda` (modul pertama yang diizinkan peran). Setelah masuk tanpa tujuan tertentu, aplikasi juga ke `/desktop` (browser ke `/beranda`). |
| Simpan kata sandi | Pengelola kata sandi WebView2 menawarkan **Simpan / Not now** setelah masuk berhasil; akun tersimpan dipilih dari daftar saat kolom Username diklik. Bisa dimatikan per PC (lihat §2.1). Isian otomatis umum (alamat, riwayat isian) tetap mati agar data pasien tidak terisi ulang. |

### Server masih HTTP (K4)

Selama server belum HTTPS, aplikasi memperlakukan **hanya origin ReportHub** sebagai konteks aman (argumen WebView2 `--unsafely-treat-insecure-origin-as-secure`). Akibatnya:

- kamera (TTD foto, foto barang) dan service worker berjalan di aplikasi, padahal di browser biasa tidak;
- izin kamera tetap ditanyakan kepada pengguna.

> **Risiko yang diterima (keputusan 7 Okt 2026):** lalu lintas HTTP tidak terenkripsi. Pihak yang bisa menyadap atau membelokkan jaringan LAN dapat menyisipkan skrip yang ikut meminta kamera. Setelah server HTTPS dan `reporthub.json` diganti ke `https://…`, pelonggaran ini otomatis tidak dipakai lagi.

## 2. Memasang (IT)

**Syarat PC:** Windows 10/11 64-bit dan jaringan ke server ReportHub. WebView2 sudah ada di Windows 10/11 terbaru; bila belum ada, installer memasangnya otomatis (perlu internet). **Windows 7 tidak didukung** (Tauri 2.12).

1. Unduh installer:
   - dari tombol **Unduh aplikasi desktop** di halaman masuk ReportHub (tanpa login), atau dari menu pengguna setelah masuk. Keduanya hanya muncul di browser Windows bila rilis sudah diterbitkan di server, dan tidak muncul di dalam aplikasi desktop itu sendiri; atau
   - langsung dari `http://<server>/api/desktop/unduh/terbaru`.
2. Jalankan installer. Pemasangan dilakukan **per pengguna Windows**, tanpa hak admin, sehingga pembaruan otomatis juga tidak butuh admin. Folder pemasangan: `%LOCALAPPDATA%\AuditTrail RS BOLTIM`.
3. Installer belum ditandatangani sertifikat code signing, jadi Windows SmartScreen bisa memperingatkan. Pilih **More info → Run anyway** (lihat §6).

### Alamat server

Alamat bawaan ditanam saat build (`REPORTHUB_URL` di `.env` proyek, lihat §4). Untuk menggantinya tanpa build ulang (mis. pindah ke domain HTTPS), buat berkas `reporthub.json` di folder pemasangan:

```json
{ "server": "https://reporthub.rsudboltim.go.id" }
```

- Isinya **wajib origin saja**: `http(s)://host[:port]`, tanpa path, query, atau nama pengguna. Kunci selain `server` dan `simpanKataSandi` ditolak.
- Berkas ini mengalahkan alamat bawaan. Tutup lalu buka lagi aplikasinya.
- Isi yang salah memunculkan pesan galat yang menjelaskan formatnya, dan aplikasi tidak membuka apa pun.
- Berkas ini bertahan saat aplikasi diperbarui maupun dicopot (pencopot hanya menghapus berkas yang dipasangnya).

### 2.0 Sertifikat HTTPS server (pin)

Server produksi `https://10.202.1.103:8444` memakai sertifikat **self-signed** (`CN=antrian.loket`, berlaku s.d. 2036) yang tidak dipercaya Windows. Browser masih bisa "lanjutkan saja", tetapi aplikasi tidak. Karena itu aplikasi **mem-pin sidik SHA-256** sertifikat tersebut: `4db33370a75c8d9566315cecc04e098695b4c3966af42011c5ae963c2d75d3d7`.

- **WebView2:** galat sertifikat diizinkan hanya bila permintaan ke origin server **dan** sidiknya cocok. Selain itu permintaan dibatalkan dan muncul dialog yang menjelaskan masalahnya, berikut sidik sertifikat yang ditolak untuk IT.
- **Pembaruan otomatis:** klien TLS hanya menerima sertifikat ber-sidik pin, dan tanda tangan jabat-tangan TLS tetap diperiksa.
- **Sumber pin:**
  - `REPORTHUB_CERT_SHA256` di `.env` saat build (ditanam ke exe). Pin ini berlaku hanya untuk alamat bawaan.
  - `reporthub.json` per PC, yang menimpanya:
    ```json
    { "server": "https://10.202.1.103:8444", "sertifikatSha256": ["<sidik-baru>", "<sidik-lama>"] }
    ```
  - Daftar boleh berisi lebih dari satu sidik (masa transisi). `[]` = tanpa pin, hanya sertifikat yang dipercaya Windows.
- **Sertifikat server diganti:**
  1. Terbitkan dulu rilis aplikasi baru yang memuat sidik **lama dan baru** (`REPORTHUB_CERT_SHA256="<lama>,<baru>"`), atau sebar `reporthub.json` dengan keduanya.
  2. Baru ganti sertifikat di server.

  Kalau urutannya terbalik, PC yang terpasang tidak bisa terhubung dan harus diberi `reporthub.json` manual.
- **Melihat sidik:** `npm run rilis -- --cek` membaca sertifikat server dan menyatakan cocok atau tidak dengan pin. Cocokkan juga dari server sendiri: `openssl x509 -in <cert.pem> -noout -fingerprint -sha256`.
- **Pindah ke sertifikat dari CA yang dipercaya** (domain + CA internal / Let's Encrypt): kosongkan `REPORTHUB_CERT_SHA256`. Pin tidak diperlukan lagi.

### 2.1 Simpan kata sandi

Bawaan **aktif**: setelah masuk berhasil, aplikasi menawarkan **Save your password? → Save / Not now**. Akun yang disimpan muncul di daftar *Saved passwords* saat kolom Username diklik, jadi beberapa petugas bisa memilih akunnya masing-masing tanpa mengetik ulang.

- Kata sandi disimpan **WebView2 di profil Windows pengguna** (`%LOCALAPPDATA%\id.go.boltimkab.rsud.audittrail`, terenkripsi DPAPI). Aplikasi dan server tidak pernah menyimpannya.
- Penyimpanan ini **terpisah dari Google Password Manager / Chrome / Edge**. Di browser, form masuk ramah pengelola kata sandi: Chrome menawarkan simpan ke Google Password Manager, dan akun tersimpan dipilih dari kolom Username. Ini juga berlaku lewat HTTP; tawaran eksplisit lewat Credential Management API hanya aktif di HTTPS.
- **PC bersama** (satu akun Windows dipakai banyak petugas): siapa pun yang duduk di PC itu bisa masuk sebagai akun tersimpan, dan jejak audit jadi tidak lagi menunjuk orang yang benar. Matikan penyimpanan:

  ```json
  { "server": "https://reporthub.rsudboltim.go.id", "simpanKataSandi": false }
  ```

  Setelah dimatikan, tawaran simpan tidak muncul lagi. Kata sandi yang **sudah** tersimpan tetap bisa dipakai sampai profil dihapus: tutup aplikasi, lalu hapus folder `%LOCALAPPDATA%\id.go.boltimkab.rsud.audittrail\EBWebView`. Ini juga mengeluarkan sesi di PC itu.

## 3. Pembaruan otomatis

- Saat dibuka (setelah ±5 detik), aplikasi memeriksa `GET /api/desktop/pembaruan/windows/x86_64/<versi>` di server yang sama.
- Bila ada versi lebih baru, muncul dialog **Pasang sekarang / Nanti**. Draf formulir diminta disimpan dulu, lalu installer berjalan pasif dan aplikasi dibuka kembali.
- Paket diverifikasi dengan kunci publik yang tertanam di aplikasi (minisign), dan tanda tangannya wajib memuat versi yang diumumkan. Paket yang tidak cocok ditolak walaupun server atau jaringan dibobol.

**Diagnosis:** `audittrail-rsboltim.exe --cek-pembaruan` memeriksa, mengunduh, dan memverifikasi paket tanpa memasangnya, lalu menulis satu baris ke stdout:

| Keluaran | Arti | Kode keluar |
| --- | --- | --- |
| `TERBARU <versi>` | tidak ada versi lebih baru | 0 |
| `TERSEDIA <versi> TANDA_TANGAN_SAH <n> byte` | ada versi baru dan paketnya sah | 0 |
| `GAGAL_VERIFIKASI …` | tanda tangan/versi paket tidak cocok | 2 |
| `GAGAL_PERIKSA …` / `GAGAL_KONFIGURASI …` | server tak terjangkau / konfigurasi salah | 2 |

Karena aplikasi tidak punya jendela konsol, tampilkan keluarannya dengan:

```powershell
Start-Process "$env:LOCALAPPDATA\AuditTrail RS BOLTIM\audittrail-rsboltim.exe" -ArgumentList "--cek-pembaruan" -Wait -RedirectStandardOutput hasil.txt; Get-Content hasil.txt
```

## 4. Membangun & merilis (pengembang)

**Prasyarat (sekali per PC build):** Node.js, Rust `stable-x86_64-pc-windows-msvc` (rustup), dan Visual Studio Build Tools 2022 dengan workload *Desktop development with C++*. Lalu jalankan `npm install` di folder `desktop/`.

**Kunci tanda tangan pembaruan:**

- Lokasi: `%USERPROFILE%\.tauri\audittrail-rsboltim.key` dan `…key.password`. Aksesnya dibatasi ke akun pembuatnya, dan **tidak pernah masuk repo**. Kunci publiknya tertanam di `desktop/src-tauri/tauri.conf.json`.
- **Cadangkan keduanya** ke tempat aman (pengelola kata sandi / media terenkripsi).
  - Bila hilang, aplikasi yang sudah terpasang tidak bisa diperbarui lagi; semua PC harus memasang ulang installer baru.
  - Bila bocor, selama server masih HTTP penyerang di LAN bisa menyebarkan paket palsu. Segera buat kunci baru dan pasang ulang di semua PC.
- Build di mesin lain: isi env `TAURI_SIGNING_PRIVATE_KEY` (isi atau path kunci) dan `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`.

**Merilis versi baru:**

1. Naikkan `version` di `desktop/src-tauri/tauri.conf.json` (juga `Cargo.toml` dan `package.json` agar seragam).
2. Isi alamat bawaan installer di `.env` proyek:
   ```
   REPORTHUB_URL="http://<alamat-server-produksi>"
   ```
   - Wajib origin saja dan sama dengan `PUBLIC_APP_ORIGIN`/`SIGN_PUBLIC_ORIGIN` server produksi; skrip memberi peringatan bila berbeda.
   - Hanya kunci ini yang dibaca dari `.env`; rahasia server lain tidak ikut ke proses build.
   - `$env:REPORTHUB_URL = "…"` di sesi PowerShell menimpa nilai `.env` untuk sekali build.
3. Di folder `desktop/`:
   ```powershell
   npm run rilis -- --cek                              # periksa kunci & alamat saja
   npm run rilis -- --catatan "Ringkasan perubahan"
   ```
   Hasilnya ada di `desktop/rilis/<versi>/`: `audittrail-rsboltim_<versi>_x64-setup.exe` dan `rilis.json`.
4. Terbitkan ke server (Docker). Installer **tidak** ada di image app; ia disajikan dari folder host `./storage/desktop`, yang di-mount **read-only** ke container. Dengan begitu tidak perlu build ulang image, dan app yang dibobol pun tidak bisa mengganti installer.
   ```sh
   # dari PC Windows: salin paket rilis ke folder home di server
   scp -r desktop/rilis/<versi> user@server:~/rilis-<versi>
   # di server, folder proyek (tempat docker-compose.yml):
   sudo sh scripts/desktop/terbitkan.sh ~/rilis-<versi>
   ```
   - Jangan `scp` langsung ke `storage/desktop` (hasilnya "Permission denied"). Folder `storage` dimiliki uid 1001 (user container), jadi skrip dijalankan dengan `sudo`. Jangan melonggarkan izin folder itu.
   - Skrip memeriksa paket sebelum menyalin:
     - versi dan nama berkas sah, tanpa path;
     - tanda tangan ada;
     - installer benar program Windows (header `MZ`).
   - Lalu menyalin **installer dulu, `rilis.json` terakhir**, masing-masing atomik (berkas sementara + rename).
   - Tidak perlu restart container: tombol **Unduh aplikasi desktop** di halaman masuk dan pembaruan otomatis langsung memakai versi baru.
   - Installer lama dibiarkan sebagai cadangan rollback. Server hanya menyajikan berkas yang tercantum di `rilis.json`.
   - Rollback: terbitkan ulang folder rilis versi sebelumnya. Aplikasi yang sudah terpasang **tidak** turun versi otomatis (updater hanya naik versi).
   - Server dev/uji lokal (tanpa Docker): `npm run rilis -- --pasang-ke <STORAGE_DIR>` menyalin langsung.
5. Server membuat URL unduhan dari `PUBLIC_APP_ORIGIN` (atau `SIGN_PUBLIC_ORIGIN`). Alamat itu harus bisa dijangkau PC klien.

**Uji:** `npm test` di `desktop/` menjalankan uji unit Rust (konfigurasi, penguncian navigasi, izin). Uji endpoint server ada di suite E2E aplikasi.

**Pengaturan WebView2 di luar API Tauri:** penyimpanan kata sandi (`ICoreWebView2Settings4::SetIsPasswordAutosaveEnabled`) diatur lewat `with_webview` (crate `webview2-com`, versi sama dengan milik wry). Jendela utama dibuka di `about:blank`, pengaturan diterapkan, lalu baru diarahkan ke server, sehingga navigasi pertama sudah memakai pengaturan itu.

## 5. Endpoint server (publik, tanpa login)

| Endpoint | Fungsi |
| --- | --- |
| `GET /api/desktop/pembaruan/{windows}/{x86_64\|aarch64\|i686}/{a.b.c}` | 204 = tidak ada pembaruan; 200 = manifest updater Tauri. Parameter lain → 404. Batas 30/menit/IP. |
| `GET /api/desktop/unduh/{berkas}` | Hanya installer yang tercantum di `rilis.json`; `terbaru` = installer Windows x64. Batas 10/menit/IP. |

Keduanya tidak memuat data pasien. Manifest divalidasi ketat (nama berkas tanpa path, versi `a.b.c`, tanda tangan base64), dan manifest yang rusak dianggap tidak ada.

**Tautan unduhan sengaja tanpa atribut `download` (13 Okt 2026).** Server produksi memakai sertifikat self-signed. Di sana Chrome menggagalkan `<a href=… download>` dengan "Failed - Network error", dan nama berkasnya tampil "terbaru". Penyebabnya: permintaan unduhan itu tidak memakai pengecualian sertifikat yang sudah disetujui petugas di halaman peringatan.
- Tautan biasa (navigasi) memakai pengecualian itu. Server sudah mengirim `Content-Disposition: attachment`, jadi halaman tidak berpindah.
- Hal yang sama berlaku untuk tautan unduhan lain ke server, misalnya foto barang Inventaris. Unduhan lewat `fetch` → blob (ekspor Excel/PDF) tidak terdampak.
- Jawaban 429 kini berteks, karena saat tautan diklik berulang jawaban itu tampil sebagai halaman.
- Akar masalahnya tetap sertifikat yang belum dipercaya PC klien. Setelah sertifikat dipercaya, misalnya lewat CA internal, kedua cara sama-sama berfungsi.

## 6. Belum dikerjakan

- **Sertifikat code signing** untuk installer (menghilangkan peringatan SmartScreen). Perlu sertifikat dari CA. Setelah tersedia, isi `bundle.windows.certificateThumbprint` / `signCommand` di `tauri.conf.json`.
- Cetak langsung ke printer tertentu tanpa dialog, pad TTD USB, pembaca e-KTP, dan mode kiosk (PRD §12.4) hanya dibangun bila ada kebutuhan nyata. Masing-masing butuh perintah native dengan capability yang dibatasi.

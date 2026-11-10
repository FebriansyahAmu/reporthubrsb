# PRD — TTD Perangkat Siaga (Form RM)

**Versi:** 1.0, 9 Nov 2026. Disetujui untuk dikerjakan langkah demi langkah (§13).
**Sifat data SIMGOS:** **read-only.** Fitur ini tidak menulis apa pun ke SIMGOS. Satu-satunya bacaan SIMGOS adalah nama ruangan untuk label lokasi perangkat, lewat DAL yang sudah ada.
**Riwayat:** v0.1 (riset, 9 Nov 2026) → v1.0 (keputusan pemilik + penilaian keamanan OWASP).

---

## 0. Keputusan pemilik (9 Nov 2026)

| #   | Keputusan                                                                                                                                                       |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| K1  | Dorongan permintaan ke tablet memakai **SSE**. Petugas meminta TTD (pasien, keluarga, saksi, dll.), pasien cukup menggambar. **Tanpa pindai QR** per tanda tangan. |
| K2  | **Tablet hanya menampilkan kanvas.** Tidak ada nama pasien, judul form, maupun nama petugas di layar tablet.                                                     |
| K3  | **Satu tabel baru** di DB `reporthub`, `form_rm_perangkat_ttd`. Tidak ada tabel lama yang diubah. SIMGOS tidak disentuh.                                         |
| K4  | Pengelola perangkat memakai **modul RBAC baru `form-rm.perangkat`**. Superadmin otomatis boleh.                                                                  |
| K5  | **Goresan langsung di PC** masuk tahap berikutnya (T2). Tahap pertama mengirim PNG final.                                                                         |
| K6  | Cakupan: **semua slot TTD di Form RM**. Berkas Klaim, BCKH, dan Master tidak ikut.                                                                               |
| K7  | Wajib aman: tidak boleh ada celah, eksploit, backdoor, atau IDOR. Dinilai dengan **OWASP Top 10:2025** dan **OWASP API Security Top 10:2023** (§8).               |

## 1. Latar belakang dan tujuan

**Kondisi sekarang.** TTD pasien/keluarga lewat HP memakai alur **"Via HP"**:
- PC membuat sesi dan menampilkan QR, pasien memindai, lalu menggambar di HP.
- Ada langkah pindai di setiap tanda tangan, dan HP pasien belum tentu satu jaringan dengan server.

**Tujuan.**
- Tablet atau HP milik RS **selalu siaga** di meja layanan atau samping tempat tidur.
- Petugas menekan **"Kirim ke perangkat"** di slot TTD. **Kanvas langsung muncul** di tablet.
- Pasien menggambar dan menekan **Kirim**. Tanda tangan muncul di PC, petugas memeriksa lalu memakainya.

**Ukuran keberhasilan.**
- Kanvas muncul di tablet **< 1 detik** setelah petugas mengirim (LAN).
- Nol langkah pindai per tanda tangan.
- Lulus seluruh uji keamanan §8.6 di build produksi.

## 2. Ruang lingkup

**Termasuk:**
- registri perangkat (tambah, pasang, ganti nama/lokasi, cabut) beserta halaman pengelola;
- halaman tablet `/ttd-siaga` (pasang, siaga, kanvas);
- hub SSE;
- metode **"Perangkat"** di `SignaturePad` untuk semua Form RM;
- aliran status ke PC, langkah terima/minta ulang, batal, dan tenggat;
- audit;
- panduan nginx dan tablet.

**Tidak termasuk:**
- goresan langsung (T2);
- TTE tersertifikasi (BSrE/PSrE), sama seperti `PRD_Form_RM_Terpadu.md` §5;
- pad TTD USB;
- aplikasi native Android/iOS;
- modul di luar Form RM.

**Tetap ada:** alur "Via HP" (QR) sebagai cadangan untuk lokasi tanpa tablet siaga.

## 3. Pilihan teknologi (ringkasan riset)

| Opsi                                     | Keputusan                       | Alasan                                                                                                                                                                        |
| ---------------------------------------- | ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **SSE (`EventSource`)**                  | ✅ dipakai                       | Dorongan satu arah (server → tablet/PC). Bawaan browser, sambung ulang otomatis. Jalan di route handler Node (`ReadableStream`). Tanpa server kustom, tanpa dependensi baru. |
| WebSocket                                | ❌                               | Route handler Next tidak bisa *upgrade* koneksi, jadi butuh server kustom + konfigurasi `Upgrade` nginx. Dua arah tidak dibutuhkan.                                          |
| Polling                                  | ❌                               | Tablet siaga 24 jam = 43–86 ribu permintaan/hari/perangkat, dengan jeda 1–2 dtk.                                                                                               |
| Web Push                                 | ❌                               | Butuh layanan push internet (FCM/APNs) dan HTTPS tepercaya. Data tidak perlu keluar LAN.                                                                                       |
| WebRTC                                   | ❌                               | Tetap butuh kanal sinyal. Tidak ada manfaat untuk satu PNG kecil.                                                                                                              |

**Batasan satu proses.** Hub disimpan di memori proses (`globalThis`). Produksi = satu container, satu proses Node (`docker-compose.yml`). Bila kelak lebih dari satu instance, hub pindah ke Redis pub/sub. Ini dicatat di §14.

## 4. Peran dan istilah

| Istilah                 | Arti                                                                                                                         |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| **Petugas**             | Pengguna login dengan hak `update` atas kategori form isian yang sedang diisi.                                                |
| **Pengelola perangkat** | Pengguna dengan modul `form-rm.perangkat` (view/create/update/delete), atau superadmin.                                       |
| **Perangkat siaga**     | Tablet/HP RS yang sudah dipasangkan. Memegang **kredensial perangkat**, bukan sesi pengguna.                                  |
| **Penanda tangan**      | Pasien, keluarga, saksi, dll. yang menggambar di kanvas. Tidak login.                                                        |
| **Permintaan**          | Satu permintaan TTD dari satu petugas ke satu perangkat untuk satu slot isian. Disimpan di memori, berumur menit.            |
| **Kode pasang**         | Kode sekali pakai (8 karakter, 10 menit) untuk memasangkan tablet. Satu-satunya titik yang memakai QR.                        |

## 5. Alur pengguna

### 5.1 Memasang perangkat (sekali per tablet)

1. Pengelola membuka **Form RM › Perangkat TTD** dan memilih **Tambah perangkat**: nama (mis. "Tablet TTD IGD 1") dan lokasi (ruangan).
2. Pengelola memilih **Buat kode pasang**. Kode 8 karakter tampil (mis. `K7Q4-MZ2T`) bersama QR, berlaku 10 menit.
3. Di tablet, buka `https://<server>/ttd-siaga` lalu ketik kode, atau pindai QR.
   - QR berisi `…/ttd-siaga#kode=…`. Kode ada di **fragmen URL**, jadi tidak terkirim ke server atau log nginx.
   - Halaman membaca fragmen, mengirimnya lewat `POST`, lalu menghapusnya dari URL (`history.replaceState`).
4. Server menerbitkan kredensial perangkat lewat cookie (§7.6). Tablet masuk ke layar siaga.
5. Membuat kode pasang baru untuk perangkat yang sudah terpasang = **pasang ulang**.
   - Kode lama perangkat itu langsung batal.
   - Kredensial yang terpasang tetap berlaku sampai kode baru **dipakai**, supaya salah klik tidak mematikan tablet yang sedang bekerja.
   - Untuk menghentikan tablet seketika, pakai **Cabut** (§5.7).

### 5.2 Siaga

- **Layar siaga** hanya berisi logo RS, nama perangkat, titik status ("Siap" hijau / "Menyambung…" kuning / "Terputus" merah), dan jam. Tanpa data pasien.
- **Koneksi.** Tablet lebih dulu memanggil `POST /api/ttd-siaga/segarkan` (memastikan masih terpasang + rotasi kredensial), lalu membuka `EventSource("/api/ttd-siaga/aliran")`. Server mengirim `retry: 3000`, event `siap`, lalu event `detak` tiap 20 dtk.
  - Detak berupa **event**, bukan komentar `: ping`, karena EventSource tidak meneruskan komentar ke JavaScript. Tanpa itu, watchdog klien tidak bisa melihat detak.
- **Sambung ulang.**
  - Tidak ada detak > 45 dtk, aliran galat, halaman kembali terlihat, atau jaringan pulih → klien menutup lalu menyambung ulang manual dengan jeda bertahap 3 → 30 dtk. EventSource sendiri berhenti setelah respons non-200.
  - `segarkan` 401 → layar pasang.
  - Event `dicabut` → layar pasang dengan pesan.
  - Event `diganti` (tab lain mengambil alih) → layar "dibuka di tempat lain" dengan tombol **Pakai di layar ini**, tanpa sambung ulang otomatis, supaya dua tab tidak saling rebut.
- **Permintaan aktif tidak hilang.** Setiap kali tersambung, server mengirim ulang permintaan aktif perangkat itu (bila ada).
- **Layar tetap menyala:** pengaturan browser kiosk (§10), ditambah Screen Wake Lock API bila konteksnya aman.

### 5.3 Meminta TTD (PC)

1. Di slot TTD Form RM, petugas memilih metode **"Perangkat"** (di samping Gambar / Unggah / Kamera / Via HP). Metode ini hanya muncul di halaman isian Form RM yang masih DRAF dan bisa diubah.
2. Daftar perangkat aktif tampil dengan status **Siap / Sedang dipakai / Terputus**, diurutkan menurut lokasi. **Perangkat terakhir diingat per browser** (localStorage, hanya ID perangkat), jadi biasanya cukup satu klik **"Kirim ke Tablet IGD 1"**.
3. Kartu tunggu di PC: "Menunggu di Tablet IGD 1" → "Kanvas tampil" → "Tanda tangan diterima". Ada hitung mundur 3 menit dan tombol **Batalkan**.

### 5.4 Menggambar (tablet: hanya kanvas)

- Kanvas memenuhi layar dengan garis bantu tipis, plus dua tombol besar: **Ulangi** dan **Kirim**. Tidak ada teks lain (K2).
- **Kirim** mengirim PNG. Tablet menampilkan tanda centang sesaat lalu kembali ke layar siaga. Kanvas dan PNG dibuang dari memori halaman.
- Kode gambar memakai `MobileSignView` (event touch/mouse native, sudah terbukti di Chrome Android), diekstrak menjadi komponen bersama untuk `/sign` dan `/ttd-siaga`.

### 5.5 Menerima di PC

- PC menampilkan pratinjau TTD dengan pilihan **"Pakai tanda tangan ini"** atau **"Minta ulang"**.
  - **Minta ulang:** kanvas kosong muncul lagi di tablet untuk permintaan yang sama, dengan tenggat baru.
- **Pakai:** `commit(png)` mengisi slot, dan simpan otomatis isian berjalan seperti biasa. Normalisasi PNG di server, `form_rm_ttd` + sha256, `cekPerubahan`, dan segel HMAC saat FINAL tidak berubah.
- **Kenapa ada langkah terima:**
  - petugas, yang hadir di depan pasien, menegaskan bahwa TTD dibuat oleh orang yang benar;
  - TTD palsu yang disuntikkan tidak bisa masuk diam-diam (pertahanan berlapis, §8);
  - petugas sekaligus memeriksa kualitas goresan.

### 5.6 Batal, tenggat, putus

- **Batalkan** (PC) → tablet langsung kembali siaga.
- **Tenggat:**
  - 3 menit tanpa TTD → KEDALUWARSA;
  - TTD sudah masuk tetapi tidak diterima/diminta ulang dalam 2 menit → KEDALUWARSA, PNG dibuang.
- **Aliran PC putus** (tab ditutup, pindah halaman): server menunggu sambung ulang 10 dtk. Bila PC tidak kembali → DIBATALKAN.
  - PC yang tidak pernah membuka aliran setelah membuat permintaan → DIBATALKAN setelah 20 dtk.
  - Halaman juga mencoba membatalkan seketika (`pagehide` → DELETE keepalive). Ini **upaya terbaik**: peramban tidak menjamin permintaan saat halaman dibongkar terkirim. Jaminannya tetap grasi 10 dtk di server.
- **Tablet putus** saat permintaan aktif: permintaan tetap hidup sampai tenggat. Saat tablet tersambung lagi, kanvas tampil kembali.
- **Server restart:** semua permintaan hilang. Tablet tersambung ulang otomatis, dan PC menampilkan "Permintaan terputus, kirim ulang".

### 5.7 Mencabut perangkat

Pengelola memilih **Cabut**:
- kredensial dihapus;
- aliran tablet **langsung ditutup**;
- permintaan aktif DIBATALKAN;
- tablet kembali ke layar pasang.

Tablet hilang atau rusak = cukup dicabut. Tablet tidak pernah menyimpan data pasien (K2).

## 6. Mesin status permintaan

```
            ┌────────── minta ulang (PC) ───────────┐
            ▼                                        │
DIKIRIM ─► TAMPIL ─► DITANDATANGANI ─► DITERIMA (PC, akhir)
   │          │            │
   ├──────────┴────────────┴──► DIBATALKAN   (PC batal / aliran PC putus > 10 dtk / perangkat dicabut)
   └──────────┴────────────┴──► KEDALUWARSA  (3 mnt tanpa TTD / 2 mnt tanpa keputusan PC)
```

**Aturan:**
1. Satu perangkat punya maksimal **satu** permintaan tak-akhir. Permintaan kedua → 409 "Sedang dipakai".
2. Satu petugas punya maksimal **3** permintaan tak-akhir (mis. beberapa tab). Lebih dari itu → 429.
3. Transisi bersifat **compare-and-set** di hub, tidak pernah ditimpa buta. Kirim TTD kedua untuk permintaan yang sama → 409.
4. Status akhir dihapus dari memori setelah 30 dtk. PNG dibuang **segera** saat DITERIMA, DIBATALKAN, atau KEDALUWARSA.
5. Server tidak pernah menulis PNG ke DB di jalur ini. PNG baru tersimpan ketika isian disimpan lewat jalur yang ada.

## 7. Arsitektur teknis

### 7.1 Berkas (rencana)

| Lapisan                | Berkas                                                                                                                                                                       |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Murni (teruji unit)    | `src/features/form-rm/ttd-siaga/status.ts` (mesin status, tenggat), `kode-pasang.ts` (alfabet, format, normalisasi), `sse.ts` (penyusun frame SSE aman)                      |
| Skema                  | `src/server/modules/ttd-siaga/ttd-siaga.schema.ts` (Zod `strictObject` untuk semua input)                                                                                    |
| Server                 | `perangkat.dal.ts`, `perangkat.service.ts` (registri, kode pasang, kredensial, rotasi), `hub.ts` (koneksi + permintaan, singleton `globalThis`), `permintaan.service.ts`     |
| Rute tablet (publik + penjaga sendiri) | `src/app/ttd-siaga/page.tsx`, `src/app/api/ttd-siaga/{pasang,aliran}/route.ts`, `src/app/api/ttd-siaga/permintaan/[id]/route.ts`, `…/[id]/tampil/route.ts`     |
| Rute petugas           | `src/app/api/form-rm/ttd-siaga/perangkat/route.ts`, `…/permintaan/route.ts`, `…/permintaan/[id]/{route,aliran,terima,ulang}/route.ts`                                         |
| Rute pengelola         | `src/app/(dashboard)/form-rm/perangkat/page.tsx`, `src/app/api/form-rm/perangkat/route.ts`, `…/[id]/route.ts`, `…/[id]/kode-pasang/route.ts`                                  |
| UI                     | `SignaturePad` (metode "Perangkat"), `features/form-rm/ttd-siaga/{PilihPerangkat,KartuTunggu,LayarSiaga,KanvasSiaga}.tsx`, ekstraksi kanvas dari `MobileSignView`            |
| Data                   | DDL di `scripts/db/form-rm.sql` + runner migrasi Form RM; model Prisma `FormRmPerangkatTtd`                                                                                   |

### 7.2 Hub SSE (memori, satu proses)

- Singleton `globalThis.__ttdSiagaHub`, berisi:
  - `perangkat: Map<perangkatId, Koneksi>` — **satu koneksi per perangkat**. Koneksi baru menutup koneksi lama (§8.3 A07);
  - `permintaan: Map<id, Permintaan>`;
  - `pengamat: Map<permintaanId, Set<KoneksiPc>>`.
- **Batas keras:**
  - ≤ 200 koneksi perangkat;
  - ≤ 500 koneksi PC;
  - ≤ 12 aliran baru per IP per menit untuk tablet. `EventSource` berhenti menyambung ulang sendiri bila menerima status non-200, jadi klien tablet menyambung ulang manual dengan jeda bertahap 3 → 30 dtk;
  - ≤ 1000 permintaan tak-akhir.
  Melewati batas → 503/429, tidak pernah memperbesar memori tanpa batas.
- **Pembersihan.** Penghitung waktu tenggat memakai `unref()`. `req.signal` (abort) melepas koneksi dari hub. Penulisan yang gagal = koneksi dianggap mati dan dibersihkan.

### 7.3 Protokol SSE

| Aliran               | Event                                                                           | Isi `data` (JSON)                                    |
| -------------------- | ------------------------------------------------------------------------------- | ---------------------------------------------------- |
| Tablet               | `siap`                                                                          | `{ "permintaan": { "id", "putaran" } \| null }` — permintaan yang masih menunggu kanvas (tablet sempat putus); null = tutup kanvas |
| Tablet               | `diganti`                                                                       | `{}` — aliran lain dengan kredensial sama mengambil alih; koneksi ini ditutup |
| Tablet               | `permintaan`                                                                    | `{ "id": "<id>", "putaran": n }` — **tanpa data lain** (K2). Putaran naik saat "Minta ulang" → kanvas dikosongkan |
| Tablet               | `selesai`                                                                       | `{ "id": "<id>" }` (diterima/batal/kedaluwarsa → kembali siaga) |
| Tablet               | `dicabut`                                                                       | `{}` lalu koneksi ditutup                             |
| PC                   | `status`                                                                        | `{ "status", "sisaMs", "putaran", "terhubung", "alasan" }` — semua transisi + tablet putus/sambung. `sisaMs` dihitung server (bebas selisih jam PC). Status akhir → aliran ditutup |
| PC                   | `ttd`                                                                           | `{ "png": "data:image/png;base64,…", "sha256": "…" }` (PNG sudah dinormalkan server) |
| PC                   | `diganti`                                                                       | `{}` — aliran PC lain (pemilik yang sama) untuk permintaan ini mengambil alih |
| Keduanya             | `detak`                                                                         | `{}` tiap 20 dtk (event, bukan komentar — lihat §5.2) |

- **Frame disusun lewat satu fungsi** `frameSse(event, obj)`: nama event dari daftar tetap, `data` = `JSON.stringify` satu baris. **String mentah tidak pernah disisipkan** ke frame. Ini mencegah injeksi frame SSE lewat `\n`.
- **Header aliran:**
  - `Content-Type: text/event-stream; charset=utf-8`;
  - `Cache-Control: no-store, no-transform` (`no-transform` mencegah kompresi menahan event);
  - `X-Accel-Buffering: no`;
  - `X-Content-Type-Options: nosniff`;
  - **tanpa** header CORS.
- **Route handler mengembalikan `Response` segera**, lalu menulis lewat `ReadableStream`.

### 7.4 API dan penjaga

| Endpoint                                                   | Penjaga (semua: skema strict, galat seragam lewat `fail()`, `no-store`)                                                                                                                    |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `POST /api/ttd-siaga/pasang` `{kode}`                       | Publik. Cek asal-sama (`permintaanLintasSitus`). Laju per IP 5/mnt + global 30/mnt. Kode sekali pakai. Set cookie perangkat.                                                               |
| `POST /api/ttd-siaga/segarkan`                              | Cookie perangkat + asal-sama. Periksa pemasangan + rotasi kredensial (§7.6); cookie dipasang ulang (umur bergulir). 401 → cookie dihapus.                                                   |
| `GET /api/ttd-siaga/aliran`                                 | Cookie perangkat sah + asal-sama. SSE tablet (tanpa rotasi). Satu aliran per perangkat; kapasitas 200 aliran.                                                                              |
| Halaman `GET /ttd-siaga`                                    | Publik, CSP ber-nonce. Cookie perangkat sah → layar siaga (hanya nama perangkat), selain itu layar pasang.                                                                                 |
| `POST /api/ttd-siaga/permintaan/[id]/tampil`                | Cookie perangkat + asal-sama + `permintaan.perangkatId === perangkat.id` (selain itu 404 seragam).                                                                                          |
| `POST /api/ttd-siaga/permintaan/[id]` `{png}`               | Sama seperti di atas, ditambah status DIKIRIM/TAMPIL dan belum lewat tenggat. Body dibaca dengan batas 512 KB **sebelum** parse. `normalkanPng` → gagal = 422.                             |
| `GET /api/form-rm/perangkat`                                | `authorize("form-rm.perangkat","view")`. DTO tanpa hash/kredensial.                                                                                                                       |
| `POST /api/form-rm/perangkat`                               | `form-rm.perangkat:create` + asal-sama. `{nama, ruanganId?}`.                                                                                                                              |
| `PATCH /api/form-rm/perangkat/[id]`                         | `form-rm.perangkat:update` + asal-sama. Hanya `{nama?, ruanganId?}`.                                                                                                                       |
| `DELETE /api/form-rm/perangkat/[id]`                        | `form-rm.perangkat:delete` + asal-sama. Cabut: `aktif=0`, hash dikosongkan, aliran ditutup.                                                                                                |
| `POST /api/form-rm/perangkat/[id]/kode-pasang`              | `form-rm.perangkat:update` + asal-sama. Kode lama untuk perangkat itu langsung batal.                                                                                                      |
| `GET /api/form-rm/ttd-siaga/perangkat`                      | Login + `authorizeAny(MODUL_AKSES_FORM_RM,"update")`. Hanya `{id, nama, lokasi, status}` perangkat aktif.                                                                                  |
| `POST /api/form-rm/ttd-siaga/permintaan` `{perangkatId, isianId, slot}` | Sama seperti di atas, ditambah: asal-sama; laju per pengguna 20/mnt; `cariIsianBoleh(isianId, hak, "update")` (kategori lain → 404 seragam); isian **DRAF**; perangkat aktif, terhubung, bebas; ≤ 3 permintaan aktif per pengguna. |
| `GET /api/form-rm/ttd-siaga/permintaan/[id]/aliran`         | Login + asal-sama + **`permintaan.userId === user.id`**. Selain itu 404 seragam. **Tanpa jalan pintas superadmin.**                                                                        |
| `POST …/permintaan/[id]/terima` · `POST …/[id]/ulang` · `DELETE …/[id]` | Login + asal-sama + pemilik. Status harus sesuai mesin §6.                                                                                                                    |

**Prefiks.**
- `/ttd-siaga` dan `/api/ttd-siaga` masuk daftar publik `proxy.ts` dengan **penjaga khusus**: daftar metode yang diizinkan per jalur, pembatas laju, CSP ber-nonce, dan `HEADER_PUBLIK`. Pola ini sama dengan `/ruang`.
- Rute petugas dan pengelola tetap di bawah `/api/form-rm/...`, dilindungi sesi oleh proxy. Pemetaan modul `/api/form-rm/perangkat` → `form-rm.perangkat` memakai prefiks terpanjang.

### 7.5 Model data (satu tabel baru, K3)

DDL final (Langkah 1, `scripts/db/form-rm.sql`):

```sql
CREATE TABLE IF NOT EXISTS form_rm_perangkat_ttd (
  id                 VARCHAR(30)  NOT NULL PRIMARY KEY,
  nama               VARCHAR(80)  NOT NULL,
  ruangan_id         VARCHAR(10)  NULL,          -- master.ruangan SIMGOS, referensi lunak (tanpa FK lintas DB)
  token_hash         CHAR(64)     NULL,          -- sha256 kredensial aktif; NULL = belum/tidak terpasang
  token_hash_lama    CHAR(64)     NULL,          -- kredensial sebelum rotasi terakhir (jendela grasi)
  token_diputar_at   DATETIME(3)  NULL,
  aktif              TINYINT(1)   NOT NULL DEFAULT 1,
  dipasang_at        DATETIME(3)  NULL,
  terakhir_aktif_at  DATETIME(3)  NULL,          -- ditulis saat sambung/putus, bukan tiap detak
  dicabut_at         DATETIME(3)  NULL,
  dibuat_oleh_id     VARCHAR(191) NULL,
  created_at         DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at         DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  UNIQUE KEY uq_form_rm_perangkat_ttd_nama (nama),
  UNIQUE KEY uq_form_rm_perangkat_ttd_token (token_hash),
  KEY idx_form_rm_perangkat_ttd_lama (token_hash_lama)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

Perbedaan dari sketsa v1.0:
- tipe waktu `DATETIME(3)` dan `*_oleh_id VARCHAR(191)`, mengikuti tabel Form RM lain;
- tambahan `dicabut_at`;
- **nama unik** (tanpa membedakan huruf besar/kecil, dari collation), supaya daftar pilihan perangkat tidak ambigu.

- **Kode pasang dan permintaan tidak disimpan di DB** (memori, berumur menit).
- DDL manual + runner migrasi. **Jangan `prisma db push`** (ada drift di tabel lama).
- Waktu disimpan sebagai UTC (konvensi reporthub).
- `sql_mode` reporthub non-strict, jadi **panjang `nama` divalidasi Zod** (≤ 80) supaya tidak terpotong diam-diam.

### 7.6 Kredensial perangkat

- **Dibuat server:** `randomBytes(32)` (256 bit) → base64url. Klien tidak pernah memilih nilainya, sehingga *session fixation* tidak mungkin.
- **Disimpan:** hanya `sha256(token)`, yang juga menjadi kunci pencarian (indeks unik). Token mentah tidak pernah dibandingkan langsung, tidak pernah dicatat di log, dan tidak pernah dikirim balik setelah diset.
- **Cookie:**
  - nama `__Host-rh_perangkat` di HTTPS (Secure, `Path=/`, tanpa `Domain`); `rh_perangkat` hanya di HTTP dev;
  - `HttpOnly`, `SameSite=Strict`, `Max-Age` 30 hari, bergulir saat rotasi.
- **Rotasi lewat `POST /api/ttd-siaga/segarkan`** (paling sering 1×/24 jam). Klien memanggilnya setiap akan menyambung dan tiap 6 jam selama tersambung. Rotasi tidak dilakukan lewat respons aliran SSE, karena `Set-Cookie` di respons JSON biasa lebih pasti diproses peramban sebelum klien melanjutkan.
  - Token baru diset di cookie; hash token yang dipakai klien disimpan di `token_hash_lama`. Rotasi bersifat compare-and-set, sehingga dua segarkan bersamaan tidak saling menimpa.
  - Token lama dipakai **dalam grasi 2 menit** (respons rotasi kemungkinan tak sampai) → diterima dan dirotasi ulang.
  - Token lama dipakai **setelah** grasi → indikasi kredensial disalin → perangkat **dicabut otomatis** + audit `form-rm.ttd-siaga.indikasi-salin`. Pola ini sama dengan deteksi pakai-ulang refresh token yang sudah ada.
  - Sisa risiko: penyalin yang memakai token lama *di dalam* jendela grasi bisa merebut pemasangan. Tablet asli lalu menampilkan layar pasang, dan memasang ulang akan menyingkirkan penyalin.
- **Kedaluwarsa diam:** token yang tidak dirotasi 30 hari (`token_diputar_at`) ditolak, sehingga tablet yang lama mati harus dipasang ulang. Cookie juga habis dalam 30 hari.
- **Koneksi ganda:** aliran baru menggantikan aliran lama (event `diganti`).
  - Wi-Fi yang putus-sambung juga memicu penggantian, jadi penggantian dari **IP yang sama tidak pernah dicurigai**.
  - Penggantian dari IP berbeda → audit peringatan `koneksi-ganda`.
  - ≥ 5 penggantian dalam 5 menit yang melibatkan ≥ 2 IP → pola dua salinan saling merebut → perangkat **dicabut otomatis** + audit.
- **Lingkup:** cookie ini hanya dibaca endpoint `/api/ttd-siaga/*` dan halaman `/ttd-siaga`. Untuk API lain cookie ini tidak bermakna, karena proxy dan guard hanya mengenal `rh_access`/`rh_refresh`.
- **Kode pasang:**
  - alfabet 31 karakter tanpa yang mirip (0/O, 1/I/L), 8 karakter ≈ 39,6 bit;
  - disimpan sebagai `sha256` di memori, berumur 10 menit, sekali pakai, satu kode aktif per perangkat;
  - dengan batas 30 percobaan global/menit, peluang tebakan benar dalam 10 menit ≈ 3×10⁻¹⁰.

### 7.7 RBAC

| Modul                       | Aksi                              | Dipakai untuk                                                               |
| --------------------------- | --------------------------------- | --------------------------------------------------------------------------- |
| `form-rm.perangkat` (baru)  | view, create, update, delete      | Halaman dan API pengelola perangkat. Menu "Perangkat TTD" di ruang kerja Form RM. |
| `form-rm` / `form-rm.<kategori>` | update                       | Meminta TTD ke perangkat, dicek **per kategori isian** lewat `cariIsianBoleh`. |

- Superadmin melewati RBAC **hanya untuk fungsi pengelola**.
- **Tidak ada pengecualian** atas aturan pemilik permintaan: siapa pun, termasuk superadmin, tidak bisa membaca aliran atau PNG permintaan milik orang lain.

## 8. Keamanan — penilaian kerentanan OWASP

### 8.1 Prinsip

1. **Tolak secara bawaan, gagal tertutup.** Galat DB atau hub saat cek akses = tolak (503/401). Tidak pernah "lolos karena error".
2. **Hak minimum.** Kredensial perangkat hanya bisa: menerima ID permintaan untuk dirinya, menandai tampil, dan mengirim satu PNG. Tidak lebih.
3. **Minimisasi data (K2).** Tablet tidak pernah menerima data pasien. Tablet yang dibobol tidak membocorkan apa pun.
4. **Masukan tablet = tidak tepercaya.** PNG divalidasi dan disusun ulang server (`normalkanPng`), lalu dinormalkan lagi saat isian disimpan.
5. **Tanpa dependensi baru.** `EventSource`, `ReadableStream`, dan `node:crypto` bawaan. QR memakai `qrSvgDataUri` yang sudah ada. `package-lock.json` tidak berubah.
6. **Tanpa jalan pintas.** Tidak ada flag env "lewati cek", endpoint debug, kunci induk, atau perilaku khusus `NODE_ENV=test`.

### 8.2 Model ancaman

- **Aset:**
  - gambar TTD (bukti persetujuan);
  - integritas isian Form RM;
  - kredensial perangkat;
  - sesi petugas;
  - ketersediaan layanan TTD.
- **Aktor:**
  - pengunjung/pasien di depan tablet (akses fisik ke layar);
  - pengguna LAN tanpa akun;
  - petugas login yang usil (punya sesi, mencoba objek milik orang lain);
  - situs berbahaya yang dibuka petugas (CSRF/serangan lintas situs);
  - orang yang mencuri atau menyalin tablet.
- **Batas kepercayaan:**
  - Browser ↔ nginx (TLS).
  - nginx ↔ container (127.0.0.1).
  - Tablet (kredensial perangkat) ≠ PC (sesi pengguna). Keduanya **tidak pernah saling menggantikan**.

### 8.3 OWASP Top 10:2025

| Kategori                                        | Risiko pada fitur ini                                                                                       | Kontrol                                                                                                                                                                                                                                                                                                  |
| ----------------------------------------------- | ----------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **A01 Broken Access Control** (termasuk IDOR, SSRF) | Membaca PNG permintaan orang lain; mengirim TTD ke permintaan perangkat lain; meminta TTD untuk isian kategori lain; memakai kredensial perangkat untuk API lain; pengguna tanpa hak mengelola perangkat | Kepemilikan dicek di **setiap** endpoint berbasis ID: `userId` peminta, `perangkatId` tujuan, kategori isian (`cariIsianBoleh`), **404 seragam**. ID acak 128 bit tetap dicek kepemilikannya (tidak mengandalkan rahasia ID). Modul `form-rm.perangkat` untuk fungsi pengelola. Kredensial perangkat ≠ sesi. Tanpa CORS. Tidak ada permintaan keluar dari server (SSRF tidak berlaku). |
| **A02 Security Misconfiguration**               | Buffering/kompresi yang menahan SSE; header hilang; prefiks publik terlalu luas                             | Header §7.3. CSP ber-nonce + `frame-ancestors 'none'` + `noindex` + `no-referrer` di halaman tablet. Prefiks publik dicocokkan **persis** (`p` atau `p/…`). Daftar metode per jalur. Blok nginx khusus aliran (§10) tidak membuka rute lain. Uji di build produksi.                                                                          |
| **A03 Software Supply Chain Failures**          | Pustaka SSE/realtime pihak ketiga                                                                           | **Nol dependensi baru** (§8.1-5). `npm audit` + cek advisory Next (lihat catatan patch keamanan) sebelum rilis.                                                                                                                                                                                             |
| **A04 Cryptographic Failures**                  | Token lemah atau tersimpan mentah; cookie bocor lewat HTTP                                                  | CSPRNG `randomBytes`. Token 256 bit. Hanya sha256 yang disimpan (cukup untuk token berentropi tinggi). Cookie `__Host-` + Secure + HttpOnly + SameSite=Strict. TLS di nginx. Tidak ada kriptografi buatan sendiri.                                                                                       |
| **A05 Injection**                               | SQL; injeksi frame SSE; XSS lewat nama perangkat                                                            | Prisma terparameter. Bacaan nama ruangan SIMGOS lewat DAL terparameter yang ada. Zod `strictObject`. Frame SSE lewat `frameSse` (JSON satu baris, event dari daftar tetap). React meng-escape. Tanpa `dangerouslySetInnerHTML`. Nama perangkat dibatasi karakter dan panjang.                              |
| **A06 Insecure Design**                         | Pembajakan TTD yang sedang berjalan; TTD salah orang; data pasien di layar publik                           | Mesin status compare-and-set. Satu permintaan aktif per perangkat. **Langkah terima oleh petugas.** Tablet hanya kanvas. Tenggat pendek. Batal otomatis saat PC pergi. Kasus penyalahgunaan diuji (§8.6).                                                                                                  |
| **A07 Authentication Failures**                 | Tebak kode pasang; kredensial dicuri/disalin; sesi petugas                                                  | Kode sekali pakai 10 menit + laju per IP/global. Rotasi kredensial + grasi + cabut otomatis bila dipakai ulang. Deteksi koneksi ganda. Kedaluwarsa diam 30 hari. Sesi petugas memakai auth yang sudah diperkeras (rotasi refresh, batas mutlak 12 jam).                                                     |
| **A08 Software or Data Integrity Failures**     | PNG palsu atau polyglot; TTD diganti setelah ditandatangani                                                 | `normalkanPng` (validasi signature/CRC/IHDR, disusun ulang hanya dari chunk aman, batas dimensi/ukuran). sha256 PNG tercatat di audit saat diterima dan tetap sama di `form_rm_ttd` (normalisasi idempoten, **diverifikasi di Langkah 3**). Segel HMAC isian saat FINAL. JSON hanya diparse lewat skema.     |
| **A09 Security Logging & Alerting Failures**    | Penyalahgunaan tidak terlihat                                                                               | Audit `form-rm.ttd-siaga.*` (§8.5) tanpa PHI, PNG, maupun token. Peristiwa berbahaya (`indikasi-salin`, `koneksi-ganda`, laju kode pasang terlampaui, cabut) diberi tingkat **peringatan**.                                                                                                                         |
| **A10 Mishandling of Exceptional Conditions**   | Gagal terbuka saat error; kebocoran sumber daya; status menggantung                                         | Gagal tertutup di semua guard. `fail()` memberi pesan seragam tanpa stack. Abort/tulis-gagal membersihkan hub. Tenggat untuk setiap status tak-akhir. Restart = semua permintaan hilang dengan aman. Galat pada satu koneksi tidak merusak koneksi lain.                                                    |

### 8.4 OWASP API Security Top 10:2023

| Kategori                                                | Kontrol                                                                                                                                                                                                |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **API1 BOLA (IDOR)**                                    | Setiap objek (perangkat, permintaan, isian) diotorisasi terhadap aktor: pengelola, pemilik permintaan, perangkat tujuan, atau hak kategori isian. Respons 404 seragam sehingga keberadaan objek tidak bisa diraba. |
| **API2 Broken Authentication**                          | Kredensial perangkat dan kode pasang (§7.6). Endpoint tablet menolak sesi pengguna sebagai pengganti kredensial perangkat, dan sebaliknya.                                                              |
| **API3 BOPLA**                                          | Input `strictObject`: kolom tak dikenal → 422, jadi tidak bisa menyetel `aktif`, `token_hash`, `userId`. DTO keluaran ditulis eksplisit: tanpa hash, tanpa ID pembuat, tanpa data isian ke tablet.     |
| **API4 Unrestricted Resource Consumption**              | Laju per IP/pengguna/global. Batas koneksi (§7.2). Batas body 512 KB dibaca sebelum parse. Tenggat. Pembersihan memori. Maks 3 permintaan per pengguna, 1 per perangkat.                                 |
| **API5 BFLA**                                           | Fungsi pengelola butuh `form-rm.perangkat:<aksi>`. Petugas tidak bisa memanggil fungsi tablet (butuh cookie perangkat). Tablet tidak bisa memanggil fungsi petugas atau pengelola (butuh sesi + hak).    |
| **API6 Unrestricted Access to Sensitive Business Flows** | Spam permintaan ke tablet (laju + audit + perangkat sibuk = 409). Pasang massal (laju kode pasang).                                                                                                     |
| **API7 SSRF**                                           | Tidak berlaku: server tidak pernah mengambil URL dari masukan pengguna.                                                                                                                                |
| **API8 Security Misconfiguration**                      | Seperti A02. Tanpa CORS. Metode di luar daftar → 405.                                                                                                                                                  |
| **API9 Improper Inventory Management**                  | Semua endpoint tercatat di §7.4 dan `docs/rbac`. Tanpa endpoint uji atau debug di build produksi. Tidak ada versi API lama.                                                                            |
| **API10 Unsafe Consumption of APIs**                    | Data dari tablet diperlakukan sebagai masukan tak tepercaya (normalisasi PNG, skema). Tidak memanggil API pihak ketiga.                                                                                |

### 8.5 Audit dan anti-backdoor

**Peristiwa audit** (`writeAudit`; metadata hanya ID, sha256, dan status — tanpa nama pasien, PNG, maupun token). Awalan `form-rm.ttd-siaga.`, mengikuti gaya nama audit Form RM yang ada:
- `perangkat-buat`, `perangkat-ubah`, `kode-pasang`, `perangkat-cabut` (Langkah 1), `pasang` (Langkah 2);
- `minta`, `tampil`, `ttd`, `terima`, `ulang`, `batal`, `kedaluwarsa` (Langkah 3);
- `indikasi-salin`, `koneksi-ganda`, `laju-pasang` (tingkat peringatan, Langkah 2).

**Anti-backdoor dan integritas kode:**
- Tanpa env atau parameter rahasia yang melewati cek, tanpa kredensial bawaan, tanpa endpoint tersembunyi.
- Tidak ada percabangan `NODE_ENV === "test"` di jalur keamanan.
- Uji berjalan terhadap **build produksi** (port 3100) memakai data uji yang dibersihkan terarah.
- Tinjauan wajib sebelum selesai: `/security-review`, plus pemeriksaan otomatis berikut, yang semuanya harus 0 di kode fitur ini:
  - `rg` `dangerouslySetInnerHTML`, `eval(`, `new Function`, `Access-Control-Allow-Origin`;
  - cookie tanpa `HttpOnly`;
  - log yang memuat `png`/`token`/`kode`.
- Semua rute baru terdaftar di §7.4. Uji memastikan **tidak ada rute `/api/ttd-siaga/*` lain** yang menjawab selain yang terdaftar (404).

### 8.6 Uji keamanan wajib (lulus di build produksi)

**Kredensial dan pemasangan**
1. Kode pasang: salah → 401 seragam; sekali pakai (pakai kedua → 401); lewat 10 menit → 401; kode baru membatalkan yang lama.
2. Laju kode pasang: percobaan ke-6/menit dari satu IP → 429; batas global tercapai → 429 + audit peringatan.
3. Cookie perangkat: `HttpOnly`, `SameSite=Strict`, `__Host-`/Secure di HTTPS; nilainya tidak pernah muncul di body respons.
4. Rotasi: token lama dalam grasi → diterima; setelah grasi → perangkat dicabut + audit `indikasi_salin`.
5. Cabut → aliran tablet tertutup ≤ 1 dtk; kredensial lama → 401; permintaan aktif → DIBATALKAN.

**Pemisahan tablet ↔ petugas**
6. Cookie perangkat ke API petugas, pengelola, atau API lain (`/api/form-rm/...`, `/api/master/...`) → 401.
7. Sesi petugas (tanpa cookie perangkat) ke `/api/ttd-siaga/aliran` dan kirim TTD → 401.

**IDOR / BOLA**
8. Pengguna B membuka aliran, terima, ulang, atau batal permintaan pengguna A → 404. Superadmin B juga → 404.
9. Perangkat X mengirim TTD atau tampil untuk permintaan perangkat Y → 404.
10. Permintaan untuk isian kategori yang tidak boleh dilihat → 404. Boleh lihat tanpa `update` → 403. Isian FINAL/BATAL → 409.
11. Pengguna tanpa `form-rm.perangkat` → 403 di semua API pengelola. DTO pengelola tidak memuat `token_hash`/`token_hash_lama`.

**Masukan**
12. Kolom tambahan di body (mis. `aktif`, `userId`) → 422.
13. PNG: non-PNG, SVG, polyglot PNG+HTML, chunk tak dikenal, dimensi raksasa, > 512 KB → ditolak. PNG sah keluar dalam bentuk ternormalisasi.
14. Nama perangkat berisi `<script>`, baris baru, atau sangat panjang → ditolak atau tampil ter-escape. Event SSE tetap satu frame.

**Lintas situs**
15. `Sec-Fetch-Site: cross-site` / `Origin` asing ke semua POST/DELETE dan ke kedua aliran SSE → 403.
16. Respons tanpa `Access-Control-Allow-Origin`.

**Status dan kondisi luar biasa**
17. Permintaan kedua ke perangkat sibuk → 409. Permintaan ke-4 milik satu pengguna → 429.
18. Kirim TTD dua kali → yang kedua 409.
19. Tenggat 3 menit dan 2 menit → KEDALUWARSA di kedua sisi, PNG dibuang.
20. Aliran PC putus > 10 dtk → DIBATALKAN, tablet kembali siaga.
21. Galat DB tiruan saat validasi kredensial → 503 (bukan lolos).

**Data dan header**
22. Event tablet tidak memuat nama pasien, No. RM, judul form, maupun nama petugas (diperiksa per byte aliran).
23. Audit tidak memuat PNG, token, maupun kode. Log server bersih dari PHI.
24. Halaman `/ttd-siaga`: CSP ber-nonce, `X-Frame-Options: DENY`, `noindex`, `no-referrer`.

**Sumber daya dan inventaris**
25. Batas koneksi per IP/global → 429/503, memori tidak tumbuh tanpa batas (uji 300 koneksi).
26. Jalur `/api/ttd-siaga/<tak-terdaftar>` → 404. Metode tak diizinkan → 405.

## 9. Kinerja

- **Latensi:** dorongan lewat aliran yang sudah terbuka = satu tulis memori → target < 200 ms di server, < 1 dtk ujung-ke-ujung di LAN.
- **Biaya siaga:** satu koneksi + satu detak 20 dtk per tablet (≈ 4.300 detak/hari, beberapa byte masing-masing). DB hanya ditulis saat sambung/putus dan saat rotasi (≤ 1×/24 jam).
- **Per permintaan:** ±5 baris audit. PNG hanya di memori, maksimal beberapa menit.
- **Bukti event tidak ditahan:** uji di build produksi mengukur jeda antar-event (detak tiba sendiri-sendiri, bukan menumpuk).

## 10. Infrastruktur dan perangkat

**nginx produksi** (`https://10.202.1.103:8444`, di luar repo):
- Header `X-Accel-Buffering: no` + detak 20 dtk umumnya cukup.
- Bila uji di server menunjukkan event tertahan atau terputus tiap 60 dtk, tambahkan blok ini:

```nginx
location ~ ^/api/(ttd-siaga/aliran|form-rm/ttd-siaga/permintaan/[A-Za-z0-9_-]+/aliran)$ {
    proxy_pass http://127.0.0.1:3003;
    proxy_http_version 1.1;
    proxy_set_header Connection "";
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_buffering off;
    proxy_cache off;
    proxy_read_timeout 1h;
}
```

**HTTP/2** (`listen … ssl http2`) dianjurkan. Pada HTTP/1.1 browser membatasi 6 koneksi per origin, tetapi aliran PC hanya hidup selama permintaan berjalan, jadi tetap aman.

**Sertifikat self-signed:** pasang sebagai **CA tepercaya di tablet** (Android: Keamanan → Enkripsi & kredensial → Pasang sertifikat → Sertifikat CA). Hasilnya:
- tanpa halaman peringatan setelah tablet dinyalakan ulang;
- konteks aman, sehingga Screen Wake Lock API berjalan.

**Tablet:**
- Android 8–10 inci, **selalu tersambung pengisi daya**, Wi-Fi LAN yang sama dengan server.
- **Browser kiosk** (mis. Fully Kiosk Browser): kunci ke `/ttd-siaga`, "Keep screen on", mulai otomatis saat tablet menyala, alat pengembang dan navigasi lain dinonaktifkan.
- Alternatif: Chrome + Sematkan aplikasi + "Tetap aktif saat mengisi daya" (kurang kokoh).
- Matikan optimasi baterai untuk browser. Stylus kapasitif opsional.
- **HP** boleh dipakai dengan pengaturan yang sama.

## 11. Hukum dan bukti

- TTD yang digambar di tablet adalah **tanda tangan elektronik tidak tersertifikasi**. Sah, dengan kekuatan pembuktian yang bergantung pada keterkaitan dan keutuhan.
- Jejak yang dimiliki:
  - audit permintaan (petugas peminta, perangkat, waktu tampil, waktu TTD, waktu diterima, sha256);
  - sha256 per gambar di `form_rm_ttd`;
  - segel HMAC saat FINAL.
- Isi dokumen dijelaskan petugas secara langsung, karena tablet hanya kanvas (K2).
- Permenkes 24/2022 membuka penggunaan tanda tangan elektronik pada RME. Teks pasalnya dicek di JDIH Kemenkes sebelum dijadikan rujukan resmi.

## 12. Kualitas kode dan definisi selesai (setiap langkah)

- `tsc` + ESLint 0 galat.
- Uji unit untuk semua modul murni.
- E2E dan UI di **build produksi port 3100**. Server dev port 3000 milik pemilik, tidak dimatikan.
- Uji keamanan §8.6 yang relevan dengan langkah itu.
- `/security-review` tanpa temuan.
- Data uji dibersihkan terarah. Pengaturan global yang disentuh uji di-*snapshot* lalu dipulihkan persis.
- Dokumentasi:
  - PRD ini (§15);
  - `docs/rbac/03-katalog-modul.md`;
  - panduan nginx/tablet di Langkah 4.
- Pemilik yang melakukan commit. Saya mengusulkan pesan commit.

## 13. Rencana bertahap

| Langkah                                         | Isi                                                                                                                                                                                                                                                                                                                                                                                                      | Selesai bila                                                                                                                                                                       |
| ----------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **1 — Fondasi: data, RBAC, registri perangkat** | DDL `form_rm_perangkat_ttd` + runner migrasi + model Prisma. Modul `form-rm.perangkat` + menu. Modul murni (kode pasang, mesin status, `frameSse`). Service + API pengelola (daftar, tambah, ubah, cabut, kode pasang). Halaman **Form RM › Perangkat TTD** (daftar, tambah, kode pasang + QR, cabut).                                                                                            | Unit; E2E API pengelola (RBAC 403, IDOR, strict 422, DTO tanpa hash, asal-sama); UI halaman pengelola; uji §8.6 no. 1 (bagian kode), 11, 12, 14                                     |
| **2 — Tablet siaga: pasang + aliran**           | Halaman `/ttd-siaga` (pasang via kode/fragmen QR, layar siaga, sambung ulang). `POST /api/ttd-siaga/pasang`. Cookie perangkat + rotasi. Hub SSE + `GET /api/ttd-siaga/aliran` (detak, satu koneksi per perangkat, koneksi ganda). Cabut menutup aliran. Status online di halaman pengelola. Penjaga khusus di `proxy.ts`.                                                                          | E2E: pasang, aliran, detak tiba sendiri-sendiri di build produksi, cabut ≤ 1 dtk, rotasi/indikasi salin, batas koneksi; UI tablet emulasi; uji §8.6 no. 1–7, 15, 16, 21, 24–26        |
| **3 — Permintaan TTD ujung ke ujung**           | API petugas (daftar perangkat, buat permintaan terikat isian DRAF, aliran pemilik, terima/ulang/batal). Endpoint tablet tampil/kirim. Mesin status + tenggat + batal saat PC pergi. Audit. Metode **"Perangkat"** di `SignaturePad` (pilih perangkat, kartu tunggu, pratinjau terima/minta ulang). **Kanvas siaga** (ekstraksi `MobileSignView`). Verifikasi sha256 audit = `form_rm_ttd`.          | E2E alur penuh + semua status; UI dua halaman (PC + tablet emulasi) termasuk form nyata (RM.22 / consent); uji §8.6 no. 8–10, 13, 17–20, 22, 23                                    |
| **4 — Pengerasan dan kesiapan produksi**        | Jalankan ulang seluruh suite §8.6. Uji beban koneksi. Pemeriksaan anti-backdoor §8.5. `/security-review`. Panduan nginx + pemasangan tablet (`docs/ttd-perangkat-siaga.md`). Catatan deploy (**perlu migrasi**). Pengerasan kecil alur "Via HP": PNG hanya bisa diambil sesi pembuat, bukan siapa pun pemegang token.                                                                            | Semua uji lulus di build produksi; panduan siap untuk IT                                                                                                                           |
| **T2 — Goresan langsung (nanti, K5)**           | Tablet mengirim potongan goresan tiap ±200 ms → aliran PC menggambar langsung                                                                                                                                                                                                                                                                                                                           | Uji beban goresan + uji keamanan yang sama                                                                                                                                         |

## 14. Risiko dan mitigasi

| Risiko                                                  | Mitigasi                                                                                                                                              |
| ------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| nginx menahan SSE / memutus tiap 60 dtk                 | Header + detak 20 dtk; blok nginx §10 siap; diuji di server sebelum dipakai.                                                                           |
| Tablet tertidur atau Wi-Fi putus                        | Browser kiosk "Keep screen on"; sambung ulang otomatis + kirim ulang permintaan aktif; indikator merah di tablet; status "Terputus" di PC.              |
| TTD oleh orang yang salah (tablet hanya kanvas)         | Petugas hadir dan **wajib menerima** setiap TTD; minta ulang tersedia; audit lengkap.                                                                  |
| Lebih dari satu instance aplikasi kelak                 | Hub dipindah ke Redis pub/sub. Antarmuka hub dibuat terpisah agar penggantiannya lokal.                                                                |
| Restart server saat permintaan berjalan                 | Permintaan hilang dengan aman. PC menampilkan "kirim ulang". Tablet tersambung ulang otomatis.                                                          |
| Normalisasi PNG ternyata tidak idempoten                | Diverifikasi di Langkah 3. Bila tidak, audit mencatat sha256 PNG final saat isian disimpan (hook simpan), bukan saat diterima.                         |

## 15. Status implementasi

### Langkah 1 — Fondasi: data, RBAC, registri perangkat ✅ (9 Nov 2026)

**Data.**
- Tabel `form_rm_perangkat_ttd` (DDL §7.5) ditambahkan ke `scripts/db/form-rm.sql`.
- Runner `scripts/db/migrate-form-rm.mjs` (idempoten, hanya `CREATE TABLE IF NOT EXISTS`) sudah dijalankan di DB dev.
- Model Prisma `FormRmPerangkatTtd`.
- **Deploy produksi wajib migrasi:** `docker compose run --rm migrate scripts/db/migrate-form-rm.mjs`.

**RBAC.**
- Modul `form-rm.perangkat` (view/create/update/delete), menu **Form RM › Perangkat TTD**.
- Modul ini sengaja **di luar** `MODUL_AKSES_FORM_RM`.
- Gerbang layout Form RM menerima modul ini. Setiap halaman tetap menjaga dirinya, sehingga pengelola perangkat tidak bisa membuka formulir. "Tanda tangan saya" hanya dipasang bila pengguna punya akses formulir.

**Modul murni** (`src/features/form-rm/ttd-siaga/`):
- `kode-pasang.ts`:
  - alfabet 31 simbol, *rejection sampling* tanpa bias modulo;
  - penyimpanan berkunci hash, sekali pakai, 10 menit, satu kode per perangkat;
  - masukan salah ketik ditolak utuh, tidak ditebak;
- `status.ts`: mesin status §6, untuk Langkah 3;
- `sse.ts`: `frameSse` (event dari daftar tetap, JSON satu baris, anti injeksi frame), detak, `retry`;
- `types.ts`: DTO eksplisit tanpa kolom kredensial.

**Server** (`src/server/modules/ttd-siaga/`):
- skema `strictObject`: nama 3–80 karakter dengan huruf yang dibatasi, ruangan 9 digit;
- penyimpanan kode `globalThis` (sha256);
- service: daftar, tambah, ubah, cabut (idempoten), kode pasang.
  - Lokasi **wajib ada** di daftar ruangan SIMGOS (baca saja). SIMGOS tak terjangkau saat menyimpan lokasi → 503 (gagal tertutup).
  - URL/QR pasang hanya dari origin publik terkonfigurasi, bukan header Host.
  - Kode mentah hanya ada di respons pembuatannya.

**API** (§7.4):
- `GET/POST /api/form-rm/perangkat`;
- `PATCH/DELETE /api/form-rm/perangkat/[id]`;
- `POST /api/form-rm/perangkat/[id]/kode-pasang`.

Semua `no-store` + `nosniff`, tanpa CORS. Penulisan memakai `jagaTulis`: cek lintas situs `Sec-Fetch-Site`/`Origin` + laju 60/menit/pengguna. Body maks 4 KB. ID salah format → 404.

**UI** — halaman **Perangkat TTD**:
- keadaan kosong dengan 3 langkah cara kerja;
- daftar bersaring status (Semua / Terpasang / Belum dipasang / Dicabut);
- modal tambah/ubah (lokasi berkelompok per jenis layanan, galat per kolom);
- modal kode pasang: kode besar + salin + QR + hitung mundur dari jam peramban + 3 langkah, kode baru bila kedaluwarsa;
- konfirmasi cabut yang menyebut akibatnya;
- responsif 390 px tanpa gulir menyamping.

**Uji (build produksi :3100):**
- unit 614/614 (25 baru: kode pasang, mesin status, frame SSE, skema);
- `tsc` + ESLint 0;
- E2E `scratchpad/ttd-perangkat-e2e.mjs` **93/93**:
  - pemisahan hak halaman/API: pengelola perangkat → `/403` di katalog/per pasien/riwayat dan 403 di API isian; petugas Form RM → `/403` di halaman perangkat;
  - BFLA per aksi, superadmin untuk fungsi pengelola;
  - strict 422: `<script>`, baris baru, kolom asing `aktif`/`tokenHash`/`dibuatOlehId`, injeksi `ruanganId`;
  - ruangan tak ada → 422; body > 4 KB → 413; nama kembar (beda huruf) → 409; ID salah → 404;
  - DTO persis tanpa kredensial/pembuat;
  - kode: format, umur, `no-store`, tak muncul di daftar/halaman/audit, kode baru membatalkan lama;
  - CSRF 403 (cross-site, Origin asing, same-site);
  - cabut idempoten + batalkan kode + kredensial kosong di DB; urutan daftar;
  - audit lengkap tanpa token/hash; metode lain 405;
- UI `scratchpad/ttd-perangkat-ui.mjs` **29/29**: keadaan kosong, tambah dengan lokasi, galat kembar/karakter terlarang di bawah kolom (`aria-invalid`), Escape, modal kode (QR, langkah, hitung mundur berjalan, kode hilang dari halaman setelah ditutup), ubah, cabut, saring, ponsel 390 px tanpa gulir menyamping, tanpa galat konsol;
- data uji bersih (0 sisa).

**Uji keamanan §8.6 yang sudah tercakup:** no. 1 (bagian kode: format/sekali pakai/kedaluwarsa/kode baru membatalkan, unit), 11, 12, 14, 15 (API pengelola), 16, 26 (sebagian: metode 405).

### Langkah 2 — Tablet siaga: pasang + aliran ✅ (10 Nov 2026)

**Rute publik tablet** (penjaga khusus di `src/proxy.ts`, daftar tertutup di `server/modules/ttd-siaga/rute.ts`):
- halaman `/ttd-siaga`;
- `POST /api/ttd-siaga/pasang`;
- `POST /api/ttd-siaga/segarkan`;
- `GET /api/ttd-siaga/aliran`.

Jalur lain di bawah prefiks itu → 404, metode lain → 405. Laju per IP per rute: halaman 60, pasang 20, segarkan 30, aliran 12 per menit, ditambah batas global. Halaman memakai CSP ber-nonce + header publik + `Permissions-Policy: screen-wake-lock=(self)`.

**Kredensial perangkat** (`kredensial.aturan.ts` murni + `kredensial.ts` + `perangkat.sesi.ts`):
- token 256 bit; DB hanya menyimpan sha256;
- cookie `__Host-rh_perangkat` (HTTPS) / `rh_perangkat` (HTTP), HttpOnly, SameSite=Strict, 30 hari bergulir. Nama cookie terikat skema koneksi;
- pasang menukar kode sekali pakai: laju 5/menit/IP + 30/menit global dengan audit `laju-pasang`. Tablet lama perangkat itu diputus;
- rotasi 24 jam lewat `segarkan` (compare-and-set), grasi 2 menit, token lama setelah grasi → dicabut otomatis + audit `indikasi-salin`;
- kedaluwarsa 30 hari tanpa rotasi;
- galat DB saat memeriksa kredensial → 503 (gagal tertutup).

**Hub SSE** (`hub.ts`, `globalThis`):
- satu aliran per perangkat (yang lama menerima `diganti`), kapasitas 200 aliran;
- detak global 20 dtk sebagai event `detak`;
- antrean > 64 KB = klien macet → putus;
- cabut atau pasang ulang → event `dicabut` + aliran ditutup;
- `terakhir_aktif_at` dicatat saat sambung/putus.

**Koneksi ganda** (`ganda.ts`): IP sama tidak pernah dicurigai; IP berbeda → audit peringatan; ≥ 5 penggantian dari ≥ 2 IP dalam 5 menit → dicabut otomatis.

**Layar tablet** (`LayarTtdSiaga.tsx`, tanpa `style` inline dan tanpa pustaka animasi, demi CSP):
- **Pasang:** kode dirapikan otomatis (huruf besar + tanda hubung). Fragmen QR `#kode=` dipakai otomatis lalu dihapus dari URL, juga lewat `hashchange`.
- **Siaga:** jam WITA, ikon status dengan cincin "bernapas" (motion-safe), nama perangkat, titik status. Tanpa data pasien dan tanpa localStorage.
- **Diganti:** "Pakai di layar ini", tanpa sambung ulang otomatis.
- **Koneksi:** watchdog 45 dtk; sambung ulang bertahap 3 → 30 dtk; segera saat terlihat/online; segarkan tiap 6 jam; Screen Wake Lock bila didukung.

**Pengelola:**
- DTO + `terhubung`;
- baris menampilkan Terhubung / Terputus + terakhir aktif;
- daftar disegarkan tiap 15 dtk saat tab terlihat (3 dtk saat modal kode terbuka);
- modal kode otomatis menampilkan **"Tablet terpasang"** begitu kode dipakai.

**Penyesuaian desain dari v1.0** (sudah tercatat di §5.2, §7.3, §7.4, §7.6):
- detak = event, bukan komentar;
- rotasi lewat `segarkan`, bukan respons aliran;
- koneksi ganda berbasis IP;
- pasang ulang baru mematikan tablet lama saat kode dipakai.

**Uji (build produksi :3100):**
- unit 626/626 (12 baru: aturan kredensial, rute tertutup, koneksi ganda, skema pasang);
- `tsc` + ESLint 0;
- E2E `scratchpad/ttd-siaga-e2e.mjs` **70/70**:
  - halaman: CSP nonce, header, Permissions-Policy;
  - 404/405 rute tertutup;
  - pasang: 403 lintas situs, 422 strict, 401 seragam, cookie HttpOnly/Strict/30 hari, `__Host-`+Secure di HTTPS, nama cookie biasa ditolak di HTTPS, token tak di body, hash di DB, kode sekali pakai, audit;
  - pemisahan kredensial ↔ sesi pengguna dua arah;
  - rotasi / grasi / token perantara / indikasi salin → dicabut + audit;
  - aliran: 401/403, header, `retry`+`siap`, `diganti`, detak tiba sendiri dalam ±20 dtk saat aliran terbuka, event tanpa PHI, cabut → `dicabut` dalam **52 ms**, terakhir aktif;
  - pasang ulang memindahkan pemasangan;
  - koneksi ganda (IP sama aman, 2 IP → dicabut + audit);
  - laju pasang per IP, aliran per IP, Retry-After, pasang global + audit;
  - tanpa token di audit;
- UI `scratchpad/ttd-siaga-ui.mjs` **28/28** (tablet potret 800 px & lanskap, beberapa tab):
  - pasang lewat ketik kode;
  - modal pengelola otomatis "Tablet terpasang" + baris Terhubung;
  - muat ulang langsung siaga;
  - dua tab tidak saling rebut;
  - aliran mati diam-diam → watchdog Terputus (50 dtk) → sambung ulang otomatis;
  - cabut → layar pasang berpesan;
  - QR fragmen (termasuk `hashchange`) → terpasang otomatis + fragmen terhapus;
  - cookie tak terbaca JS, tanpa localStorage, tanpa pelanggaran CSP, tanpa galat konsol;
- regresi Langkah 1: E2E 93/93, UI 29/29;
- rute publik lama (`/ruang`, `/sign`, `/api/sign`, `/api/desktop`) berperilaku sama;
- data uji bersih (0 sisa).

**Uji keamanan §8.6 yang sudah tercakup:** no. 1–7, 15, 16, 24, 25 (sebagian: kapasitas hub + laju per IP; uji 300 koneksi di Langkah 4), 26. Untuk no. 21 (galat DB → 503), jalurnya sudah ada di kode, tetapi uji dengan galat DB tiruan baru di Langkah 4.

### Langkah 3 — Permintaan TTD ujung ke ujung ✅ (10 Nov 2026)

**Server** (`src/server/modules/ttd-siaga/`):
- `permintaan.inti.ts` (murni, jam & timer disuntikkan):
  - penyimpanan memori + mesin status §6 lewat `transisi` (compare-and-set);
  - tenggat 3 mnt (menggambar) dan 2 mnt (keputusan);
  - grasi PC 10 dtk (20 dtk bila aliran PC tak pernah dibuka);
  - satu permintaan per perangkat, ≤ 3 per pengguna, ≤ 1000 total;
  - PNG dibuang saat status akhir; entri dihapus 30 dtk kemudian.
- `permintaan.hub.ts` (`globalThis`): menghubungkan inti dengan aliran tablet dan aliran PC pemilik (satu per permintaan, maks. 500, detak 20 dtk, yang lama menerima `diganti`), menulis audit `minta/tampil/ttd/ulang/terima/batal/kedaluwarsa`. Tablet putus/sambung → PC diberi tahu (`terhubung`).
- `permintaan.service.ts` (petugas):
  - pemilih perangkat (`{id, nama, lokasi, status}`, lokasi SIMGOS disinggahkan 5 mnt);
  - minta: hak `update` per kategori lewat `cariIsianBoleh`, isian DRAF, perangkat terpasang + tersambung + bebas, laju 20/mnt/pengguna;
  - terima/ulang/batal hanya untuk pemilik (404 seragam, tanpa jalan pintas superadmin).
- `permintaan.tablet.ts`: tampil (idempoten) dan kirim PNG untuk perangkat tujuan saja; body dibaca bertahap dan dihentikan begitu > 512 KB; `normalkanPng`; TTD kedua → 409.
- Cabut perangkat (manual atau otomatis) membatalkan permintaan aktifnya.
- Skema `permintaan.schema.ts` (`strictObject`, ID 22 karakter base64url, label slot dibatasi karakter).

**Rute:**
- tablet: `POST /api/ttd-siaga/permintaan/[id]` dan `…/[id]/tampil`, terdaftar di daftar tertutup proxy (laju 20 dan 30/mnt/IP);
- petugas: `GET /api/form-rm/ttd-siaga/perangkat`, `POST …/permintaan`, `DELETE …/permintaan/[id]`, `GET …/[id]/aliran`, `POST …/[id]/terima`, `POST …/[id]/ulang`.

**UI:**
- **Tablet** (`KanvasPermintaan.tsx`): hanya kanvas + garis bantu + Ulangi/Kirim (K2). Terkirim → centang "Terima kasih" lalu siaga. `selesai` menutup kanvas seketika. Sambung ulang tidak menghapus coretan bila permintaannya sama (id + putaran).
- **Kanvas bersama** `features/sign/KanvasTtd.tsx`, diekstrak dari `MobileSignView` (yang kini memakainya juga). Tanpa `style` inline. PNG diperkecil ke sisi ≤ 1200 px.
- **PC** (`TtdPerangkat.tsx`, `TtdPerangkatProvider.tsx` dipasang `IsianFrame`):
  - tombol "Kirim ke tablet siaga", atau satu klik "Kirim ke <tablet terakhir>" (localStorage hanya ID perangkat);
  - pemilih dengan status Siap / Sedang dipakai / Terputus;
  - kartu tunggu dengan tahap, hitung mundur dari `sisaMs`, peringatan tablet terputus, dan Batalkan;
  - pratinjau "Pakai tanda tangan ini" / "Minta ulang";
  - hanya di isian DRAF yang boleh diubah; Master, BCKH, dan Berkas Klaim tidak terpengaruh.

**Integritas (A08):** normalisasi PNG idempoten — sha256 di audit `terima` = `form_rm_ttd.sha256` setelah isian disimpan, dan byte PNG tersimpan identik (diverifikasi E2E dan UI). Risiko §14 "normalisasi tidak idempoten" tertutup.

**Penyesuaian dari v1.0:**
- event tablet `permintaan` = `{id, putaran}` (bukan `sampai`); `siap` membawa permintaan aktif;
- event PC `status` membawa `sisaMs`, `putaran`, `terhubung`, `alasan`; PC juga bisa menerima `diganti`;
- grasi awal 20 dtk;
- batal saat halaman dibongkar bersifat upaya terbaik (§5.6).

**Uji (build produksi :3100):**
- unit 640/640 (14 baru: inti mesin status dengan jam tiruan — alur, CAS, ulang, tenggat, grasi PC, batas, cabut — serta skema dan rute tertutup);
- `tsc` + ESLint 0;
- E2E `scratchpad/ttd-permintaan-e2e.mjs` **117/117**:
  - pemilih (401/403, DTO persis);
  - minta (lintas situs, strict 422, injeksi slot, kategori 404/403, FINAL/BATAL 409, sibuk 409, terputus);
  - kanvas tiba di tablet dalam **11 ms**;
  - aliran PC (bukan pemilik & superadmin → 404);
  - tablet lain 404; PNG SVG/HTML/CRC/dimensi/chunk kritis → 422, > 512 KB → 413, polyglot dinormalkan, TTD kedua 409;
  - sinkron ulang + `diganti`; IDOR terima/ulang/batal;
  - minta ulang putaran 2; terima; sha256 audit = `form_rm_ttd`;
  - batal, PC pergi ±10 dtk, batas 3/pengguna 429, laju ke-21 429;
  - cabut saat berjalan; tablet putus/sambung;
  - proxy 404/405;
  - tenggat 2 & 3 menit nyata;
  - aliran tablet tanpa nama pasien / No. RM / judul form / slot / petugas / ID isian / PNG;
  - audit lengkap tanpa PNG/token/PHI;
- UI `scratchpad/ttd-permintaan-ui.mjs` **39/39** — form **RM.22 nyata** + tablet emulasi:
  - metode lama tetap ada; pemilih Siap/Terputus;
  - kanvas tampil dalam ±0,2 dtk dan layar tablet hanya "× Ulangi Kirim";
  - kanvas kosong ditolak; centang lalu siaga;
  - pratinjau → minta ulang → pakai → simpan otomatis, sha256 cocok;
  - tombol cepat perangkat terakhir; Batalkan; Kirim lagi; pindah halaman;
  - isian FINAL tanpa opsi; ponsel 390 px;
  - regresi `/sign` dengan kanvas bersama;
  - tanpa pelanggaran CSP dan galat konsol;
- regresi:
  - Langkah 2: E2E 70/70 (ekspektasi `siap` diperbarui ke `{permintaan:null}`), UI 28/28 tiga kali berturut-turut. Uji S9 kini menunggu hidrasi: fragmen yang diubah saat halaman masih berhidrasi ditimpa URL kanonik router Next. Ini hanya terjadi di uji; QR sungguhan selalu membuka navigasi baru;
  - Langkah 1: E2E 93/93, UI 28/28 (cek "keadaan kosong" dilewati karena sudah ada perangkat nyata di DB);
- data uji bersih (0 sisa).

**Uji keamanan §8.6 yang tercakup di langkah ini:** no. 5 (permintaan aktif dibatalkan saat cabut), 8, 9, 10, 12, 13, 15 (rute petugas & tablet baru), 17, 18, 19, 20, 22, 23, 26 (rute baru).

## 16. Sumber

- MDN — Screen Wake Lock API: https://developer.mozilla.org/docs/Web/API/Screen_Wake_Lock_API
- OWASP Top 10:2025: https://owasp.org/Top10/2025/0x00_2025-Introduction/
- OWASP HTML5 Security Cheat Sheet (SSE): https://cheatsheetseries.owasp.org/cheatsheets/HTML5_Security_Cheat_Sheet.html
- OWASP CSRF Prevention Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html
- SSE melalui nginx: https://oneuptime.com/blog/post/2025-12-16-server-sent-events-nginx/view
- Fully Kiosk — known issues: https://www.fully-kiosk.com/docs/en/features/known-issues
- Permenkes 24/2022 (JDIH Kemenkes): https://jdih.kemkes.go.id/common/dokumen/2022permenkes024.pdf
- Next 16 lokal: `node_modules/next/dist/docs/01-app/02-guides/streaming.md` (Reverse proxies, `X-Accel-Buffering`), `…/03-file-conventions/route.md` (Streaming)

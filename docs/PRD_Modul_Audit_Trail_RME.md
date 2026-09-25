# Product Requirements Document (PRD) & Rencana Bertahap

## Modul Audit Trail RME (Rekam Medis Elektronik)

**Project:** ReportHub / AuditTrail
**Organisasi:** UPTD RSUD Bolaang Mongondow Timur
**Versi:** 0.1 (Draf — menunggu keputusan scoping)
**Tanggal:** 25 September 2026
**Sifat data:** **READ-ONLY** dari SIMGOS (produksi). Tidak ada DDL/DML apa pun ke SIMGOS.

---

## 1. Latar Belakang & Tujuan

Sistem RME wajib memiliki fungsi **audit trail** yang mencatat setiap aktivitas penggunaan secara otomatis (regulasi rekam medis elektronik). Kebutuhan minimal yang harus tampil:

- **Hari, tanggal, dan waktu** aktivitas.
- **Nama pengguna** yang melakukan aktivitas.
- **Jenis aktivitas**: Login, Logout, Akses Data, Perubahan Data, Penghapusan, Pembatalan, Penambahan.

SIMGOS **sudah mencatat** sebagian besar aktivitas ini di database `logs` dan `aplikasi`. Modul ini **tidak membuat pencatatan baru** — ia **membaca, menyajikan, dan menganalisis** log yang sudah ada dalam bentuk:

1. **Timeline interaktif** log aktivitas (filter, cari, telusuri diff sebelum→sesudah).
2. **Dashboard tren & kepatuhan** (compliance) untuk memantau kelengkapan/ketepatan pengisian RME.
3. **Ekspor** bukti audit (Excel/PDF) untuk keperluan akreditasi/pelaporan.

---

## 2. Temuan Analisis Sumber Data SIMGOS (25 Sep 2026)

Analisis dilakukan read-only (hanya `information_schema` + `SELECT` ber-`LIMIT`, koneksi tunggal, `MAX_EXECUTION_TIME(8000)`). SIMGOS = MySQL 8.0.46 di `10.202.1.5`.

### 2.1. Database `logs` (4 tabel)

| Tabel                   |     Baris | Ukuran   | Peran                                                              |
| ----------------------- | --------: | -------- | ----------------------------------------------------------------- |
| `bridge_log`            | 1.266.070 | 1.795 MB | Log interoperabilitas keluar (SATUSEHAT/Kemkes, BPJS). Sistem↔sistem, **tanpa user**. |
| `pengguna_akses_log`    |   301.703 | 652 MB   | **Audit trail CRUD utama** (per-record, dengan diff).             |
| `outbox`                |    16.516 | 3.5 MB   | Antrean pesan keluar (tidak dipakai modul ini).                   |
| `pengguna_request_log`  |         0 | —        | Kosong.                                                           |

### 2.2. Database `aplikasi` (relevan)

| Tabel               |   Baris | Peran                                                            |
| ------------------- | ------: | --------------------------------------------------------------- |
| `pengguna_log`      |  25.249 | **Log login/akses sesi** (user, waktu, IP asal, browser).       |
| `pengguna`          |     171 | Master pengguna (resolver `PENGGUNA` → nama).                   |
| `objek`             |     312 | Resolver `OBJEK` → nama tabel/entity yang diaudit.               |
| `pengguna_akses`    |  49.130 | Hak akses modul per user (bukan timeline aktivitas).            |
| `modules`           |     572 | Katalog menu SIMGOS.                                             |

### 2.3. Struktur tabel inti

**`logs.pengguna_akses_log`** — audit CRUD per-record:

| Kolom     | Tipe                    | Index | Catatan                                                                  |
| --------- | ----------------------- | ----- | ------------------------------------------------------------------------ |
| `ID`      | char(15)                | idx   | **`YYMMDD` + 9 digit urut** → **kronologis**. `260925000000261` = 25 Sep 2026. |
| `TANGGAL` | datetime                | —     | **TIDAK ter-index** → jangan filter langsung ke sini (lihat §6).         |
| `PENGGUNA`| smallint                | idx   | → `aplikasi.pengguna.ID`                                                  |
| `AKSI`    | enum('C','R','U','D')   | idx   | **Hanya `C` & `U` terisi** (lihat §2.4).                                  |
| `OBJEK`   | char(5)                 | idx   | → `aplikasi.objek.ID` (`TABEL` = tabel nyata, mis. `medicalrecord.cppt`) |
| `REF`     | varchar(250)            | idx   | ID record yang terpengaruh (mis. NORM/NOPEN/ID record).                  |
| `SEBELUM` | mediumtext (JSON)       | —     | Snapshot nilai lama. **Berat + berisi data klinis (PHI)**.               |
| `SESUDAH` | mediumtext (JSON)       | —     | Snapshot nilai baru. **Berat + PHI**.                                    |

Rentang data: **2024-11-12 → 2026-09-25** (± 2 tahun).

**`aplikasi.pengguna_log`** — log login:

| Kolom           | Tipe          | Index | Catatan                                        |
| --------------- | ------------- | ----- | ---------------------------------------------- |
| `ID`            | bigint        | PK    | Auto increment.                                |
| `PENGGUNA`      | smallint      | idx   | → `pengguna.ID`                                |
| `TANGGAL_AKSES` | datetime      | idx   | **Ter-index** → aman untuk filter rentang.     |
| `LOKASI_AKSES`  | char(15)      | idx   | IP asal (mis. `10.202.1.1`).                   |
| `TUJUAN_AKSES`  | char(15)      | idx   | IP tujuan (server).                            |
| `AGENT`         | varchar(250)  | —     | User-agent browser.                            |

Rentang: **2023-09-11 → sekarang**, ± 100–160 login/hari, 30–50 pengguna aktif/hari.

**`aplikasi.pengguna`** — resolver user. **`PASSWORD` (bcrypt) HARAM di-`SELECT`.** Ambil hanya: `ID, LOGIN, NAMA, NIP, JENIS, STATUS`.

**`aplikasi.objek`** — resolver: `ID` char(5) → `TABEL` (mis. `medicalrecord.cppt`), `ENTITY`, `SERVICE`, `DESKRIPSI`.

### 2.4. Temuan kunci — distribusi `AKSI`

| AKSI | Arti     | Jumlah  |
| ---- | -------- | ------: |
| `C`  | Create   | 10.228  |
| `U`  | Update   | 388.972 |
| `R`  | Read     | **0**   |
| `D`  | Delete   | **0**   |

**Implikasi desain (penting):**

- SIMGOS **tidak mencatat akses baca (Read)** dan **tidak mencatat hapus keras (Delete)** di tabel ini.
- **Penghapusan/pembatalan dilakukan sebagai soft-delete** — yaitu `UPDATE` yang mengubah kolom status/aktif record menjadi non-aktif. Jadi "Penghapusan" & "Pembatalan" **diturunkan dari `AKSI='U'`** yang diff-nya menandakan perubahan status (divalidasi per-objek saat implementasi).
- Karena Read tak tercatat, sinyal **"Akses Data"** paling jujur adalah **login** (`pengguna_log`) + **pertukaran data interoperabilitas** (`bridge_log`). Modul **tidak akan memalsukan** event Read.

### 2.5. Objek paling banyak diaudit

Top volume (semua objek): `layanan.farmasi` (112k), `medicalrecord.rencana_terapi` (77k), `medicalrecord.cppt` (62k), `pendaftaran.kunjungan` (44k), `medicalrecord.edukasi_pasien_keluarga` (35k), `layanan.tindakan_medis` (24k).

`medicalrecord` memiliki **37 objek** teraudit. Top-3 by volume (kandidat scope awal): **`cppt`** (catatan perkembangan/CPPT — inti RME), **`rencana_terapi`**, **`edukasi_pasien_keluarga`**.

### 2.6. Bentuk diff

- **Create (`C`)**: `SEBELUM`/`SESUDAH` kosong — hanya menandai record baru dibuat (`REF` = id record baru).
- **Update (`U`)**: `SEBELUM` = JSON nilai lama, `SESUDAH` = JSON nilai baru (union kunci; `SESUDAH` bisa punya kunci ekstra). Berisi teks klinis kaya (HTML) → **PHI, wajib RBAC**.

---

## 3. Pemetaan Jenis Aktivitas → Sumber Data

| Jenis aktivitas (kebutuhan) | Sumber                              | Cara                                                                 |
| --------------------------- | ----------------------------------- | ------------------------------------------------------------------- |
| **Login**                   | `aplikasi.pengguna_log`             | Tiap baris = 1 event login (user, waktu, IP, agent).                |
| **Logout**                  | — (tidak dicatat SIMGOS)            | **Gap**. Ditandai transparan di UI ("tidak tersedia di sumber").    |
| **Akses Data (Read)**       | login + `bridge_log` (opsional)     | Read per-record tak dicatat; sajikan sinyal akses sesi & pertukaran data. |
| **Penambahan (Create)**     | `pengguna_akses_log` `AKSI='C'`     | Langsung.                                                           |
| **Perubahan (Update)**      | `pengguna_akses_log` `AKSI='U'`     | + diff `SEBELUM`→`SESUDAH`.                                          |
| **Penghapusan**             | `AKSI='U'` (soft-delete)            | Heuristik: diff menandai status/aktif → non-aktif.                  |
| **Pembatalan**              | `AKSI='U'` (status → batal)         | Heuristik domain-spesifik per objek.                                |

> Modul menyajikan pemetaan ini **apa adanya** dan menandai keterbatasan sumber secara transparan (bukan mengarang data).

---

## 4. Ruang Lingkup — **Keputusan terkunci (25 Sep 2026)**

**Milestone awal difokuskan pada RME**, lalu diperluas:

- **`medicalrecord` (3 tabel awal, TERKUNCI):** **`cppt`** (OBJEK `21002`), **`diagnosa`** (`21003`), **`tanda_vital`** (`21032`).
- **Login:** seluruh `pengguna_log`, **digabung ke timeline utama** (filter sumber: RME / Login / Semua).
- **Interoperabilitas (`bridge_log`):** **ditunda ke Stage 5** (opsional).
- **Nama modul:** **"Audit Trail RME"**, **key izin `audit-rme`** (aksi `view` & `export`, hanya peran compliance/admin).
- **Perluasan bertahap (stage lanjutan):** `layanan` (`farmasi`, `tindakan_medis`), `pendaftaran` (`kunjungan`, `surat_rujukan_pasien`), `master` (`pasien`), lalu sisa objek `medicalrecord`.

Daftar objek dalam scope disimpan sebagai **allow-list konstanta** di kode (bukan hardcode tersebar), sehingga menambah objek = menambah satu entri.

---

## 5. Arsitektur & Keamanan

- **Akses SIMGOS read-only** lewat klien singleton yang sudah ada (`getSimgos`, `connectionLimit` di-cap) — **tidak** membuat pool per-request (mencegah `ER_CON_COUNT_ERROR`/freeze). Query berat diberi `MAX_EXECUTION_TIME`.
- **State aplikasi** (preferensi, cache resolver) di DB `reporthub` terpisah — **bukan** di SIMGOS.
- **RBAC ketat.** Audit trail berisi PHI (data klinis, identitas pasien di `REF`/diff). Modul digerbang izin khusus (mis. `audit-rme` dengan aksi `view`/`export`), diberikan hanya ke peran compliance/admin. Halaman + API dijaga (`requireModule`/`withPermission`/`authorize`).
- **Larangan data sensitif:** `pengguna.PASSWORD` tidak pernah di-`SELECT`. Diff (`SEBELUM`/`SESUDAH`) hanya diambil di **detail view** (bukan list), dan opsi masking field sensitif dipertimbangkan.
- **Meta-audit:** akses ke modul audit sendiri dicatat lewat `audit_log` aplikasi (`writeAudit`) — siapa melihat/ekspor log.
- **Clean code:** layering konsisten proyek (schema Zod → service DAL → route `ok/fail` → client → view), reuse helper Excel/PDF & kit chart yang ada.

---

## 6. Optimasi Query (wajib)

`pengguna_akses_log` besar (300k+) & `bridge_log` sangat besar (1.2jt). Aturan:

1. **Filter tanggal via prefix `ID`, bukan `TANGGAL`** (TANGGAL tak ter-index). Tanggal `YYYY-MM-DD` → `ID BETWEEN 'YYMMDD000000000' AND 'YYMMDD999999999'` (range scan index `ID`).
2. **Paginasi keyset** by `ID` (`WHERE ID < :cursor ORDER BY ID DESC LIMIT n`) — hindari `OFFSET` besar.
3. **List tidak mengambil `SEBELUM`/`SESUDAH`** (mediumtext) — hanya `ID, TANGGAL, PENGGUNA, AKSI, OBJEK, REF`. Diff diambil per-baris di detail.
4. **Filter objek** pakai `OBJEK IN (<allow-list>)` (index `OBJEK`, selektif).
5. **Resolver** `PENGGUNA`→nama & `OBJEK`→tabel di-cache (jumlah kecil: 171 & 312) — 1 query batch, bukan N+1.
6. **Agregasi dashboard** dibatasi rentang tanggal (via `ID` prefix) + `MAX_EXECUTION_TIME`; hindari `COUNT(*)` global tanpa batas.
7. **`bridge_log`**: filter via `ID`/`JENIS`/`ACCESS_FROM_IP` (ter-index); `TGL_REQUEST` tak ter-index. Format `ID` berbeda (13 char) — helper terpisah.

---

## 7. Rencana Bertahap (Build Flow)

> Dikerjakan **bertahap**, satu stage per iterasi: petakan → eksekusi → validasi E2E → lapor → (user yang commit). Tidak sekaligus.

### Stage 0 — Fondasi & kontrak data
- Konstanta allow-list objek + peta `AKSI`→label + peta jenis aktivitas.
- Klien SIMGOS read-only (reuse), resolver `pengguna`/`objek` (cache).
- Schema Zod query, tipe TS bersama (list/detail/dashboard).
- Entri modul RBAC (`audit-rme`), nav, halaman kosong ber-guard.
- **Keluaran:** kerangka + izin + 1 endpoint "ping" teruji.

### Stage 1 — Timeline Audit Log (interaktif)
- API list keyset-paginated: filter **rentang tanggal** (via `ID`), **pengguna**, **jenis aksi** (C/U + turunan hapus), **objek** (scope MR 3 tabel), **cari `REF`**.
- Gabungkan **event login** (`pengguna_log`) ke timeline (opsi sumber: RME / Login / Semua).
- UI: daftar/timeline modern (badge jenis aktivitas berwarna + ikon, avatar/inisial user, waktu WITA, chip objek), filter bar, empty/skeleton/error.
- **Validasi E2E** (read-only, seed dari data nyata).

### Stage 2 — Detail & Diff Viewer
- API detail per `ID` → ambil `SEBELUM`/`SESUDAH`, parse JSON, **diff field-level** (union kunci; tandai ubah/tambah/hapus nilai).
- UI panel diff sebelum→sesudah (sanitasi HTML klinis), metadata lengkap (user, waktu, objek, REF, IP bila ada).
- Deteksi & label **soft-delete/pembatalan** dari diff status.

### Stage 3 — Dashboard Tren & Kepatuhan
- Agregasi: volume aktivitas per hari/jam, per jenis aksi, per pengguna/ruangan, per objek RME.
- Indikator kepatuhan (lihat §8): ketepatan pengisian, edit terlambat, sebaran login.
- Kit chart SVG bespoke + token warna CVD-safe yang sudah ada; landing modul.

### Stage 4 — Ekspor
- Excel (`buildReportWorkbook`) + PDF (`buildReportPdf`) untuk laporan audit ber-filter (bukti akreditasi). Meta-audit ekspor.

### Stage 5 (opsional) — Log Interoperabilitas
- View `bridge_log` (SATUSEHAT/BPJS): status keberhasilan (2xx vs error), latensi, per endpoint — kepatuhan interoperabilitas Kemkes.

### Stage 6 (opsional) — Perluasan objek
- Tambah objek `layanan`/`pendaftaran`/`master` + sisa objek `medicalrecord` via allow-list.

---

## 8. Rekomendasi Tambahan

1. **Sajikan keterbatasan sumber secara transparan** (Read/Logout tak dicatat) — lebih baik jujur daripada mengarang event.
2. **Kepatuhan pengisian RME (timeliness):** jeda antara kunjungan dan pembuatan CPPT/rencana terapi — indikator mutu rekam medis.
3. **Integritas data:** tandai **edit setelah finalisasi** / edit jauh setelah pembuatan (potensi risiko integritas).
4. **Anomali pengguna:** pengguna dengan volume ubah/hapus tak wajar; login di luar jam kerja / IP tak biasa.
5. **Kepatuhan interoperabilitas:** rasio sukses `bridge_log` ke SATUSEHAT (kewajiban Kemkes).
6. **Retensi & performa:** log 2 tahun / 650 MB — paginasi + scoping tanggal wajib; jangan pernah muat semua.
7. **Meta-audit & least privilege:** batasi modul ke peran compliance; catat siapa mengakses/mengekspor audit.

---

## 9. Keputusan — **sudah disepakati (25 Sep 2026)**

1. **3 tabel `medicalrecord` awal:** ✅ **`cppt`, `diagnosa`, `tanda_vital`**.
2. **Login di timeline:** ✅ **digabung ke timeline utama** (filter sumber RME / Login / Semua).
3. **"Akses Data (Read)":** ✅ diwakili login + (nanti) interoperabilitas; Read per-record tak tersedia di sumber → ditandai transparan.
4. **Nama modul & izin:** ✅ **"Audit Trail RME"**, key `audit-rme` (view/export).
5. **`bridge_log`:** ✅ **ditunda ke Stage 5**.

---

_Keputusan §9 telah disepakati → implementasi dimulai dari **Stage 0**, bertahap (satu stage per iterasi). Tidak ada perubahan skema SIMGOS — modul murni membaca._

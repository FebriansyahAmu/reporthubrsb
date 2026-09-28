# PRD & Rencana Bertahap — Audit Trail RME **Fase 2**

## Kepatuhan Pengimputan Berbasis Kunjungan (Log + Data Aktual)

**Project:** ReportHub (`reporthubrsb`) · Modul **Audit Trail RME** (`audit-rme`)
**Organisasi:** UPTD RSUD Bolaang Mongondow Timur
**Versi:** 1.0 (Keputusan §10 terkunci)
**Tanggal:** 26 September 2026
**Dasar:** melanjutkan [PRD_Modul_Audit_Trail_RME.md](PRD_Modul_Audit_Trail_RME.md) (Fase 1: Stage 0–3 selesai).
**Sifat data:** **FULL READ-ONLY** dari SIMGOS. Hanya `SELECT` / `information_schema`. **Tidak ada DDL/DML, tidak menambah/mengubah tabel apa pun di SIMGOS.**

---

## 1. Latar Belakang & Tujuan

Fase 1 menyajikan **log** (`logs.pengguna_akses_log` + login). Tujuan audit trail sekarang dipertajam:

> **Menjadi landasan objektif _reward & punishment_ atas kepatuhan pengimputan RME** — siapa menginput apa, untuk pasien mana, di ruangan mana, kapan, dan seberapa tepat waktu.

Untuk itu log saja **tidak cukup** (lihat §2.1). Fase 2 menambah **data aktual** dari tabel RME, **ditarik lewat kunjungan** (`pendaftaran.kunjungan` → `master.ruangan`), sehingga setiap input terikat ke **pasien + ruangan + jenis layanan** (Rawat Jalan, IGD, Rawat Inap, Laboratorium, Radiologi, Farmasi, dst.).

Kebutuhan utama:

1. **Tracking per kunjungan & per ruangan** — RI, IGD, RJ, Lab, Radiologi, Farmasi, dll.
2. **Data aktual + log berdampingan** — aktual = apa yang benar-benar tersimpan; log = jejak perubahan/pembatalan.
3. **Status 0 = Batal/Dihapus** ditampilkan (bukan disembunyikan), lengkap dengan **siapa & kapan** membatalkan (dari log).
4. **Kepatuhan per 24 jam** — mis. pada satu pasien rawat inap dalam 24 jam: berapa perawat/dokter yang menginput, berapa CPPT/TTV, di shift mana.
5. **UI solid & interaktif** — bukan daftar log panjang yang harus di-scroll.
6. **Scope terbatas** — hanya 5 kategori: **Asesmen, CPPT, TTV, Diagnosis, Tindakan**.

---

## 2. Temuan Analisis SIMGOS (26 Sep 2026, read-only, koneksi tunggal)

### 2.1. Log **tidak lengkap** — temuan penentu

Perbandingan 7 hari terakhir (aktual vs log `AKSI='C'`):

| Kategori        | Baris aktual (7 hari) | Log Create (7 hari) | Log Update (REF unik) |
| --------------- | --------------------: | ------------------: | --------------------: |
| CPPT            |                 1.188 |               **0** |                   466 |
| Tanda Vital     |                   116 |               **0** |                     — |
| Tindakan medis  |                 3.351 |               **0** |                     — |

- SIMGOS **tidak lagi mencatat Create** ke log. Total historis pun jauh di bawah aktual (TTV: ±8.091 baris aktual vs 196 log C).
- **Kesimpulan:** "siapa menginput" **wajib** diambil dari kolom **`OLEH`** di tabel aktual. Log tetap dipakai untuk **perubahan & pembatalan**.

### 2.2. Kunci penghubung — semua kategori terikat ke kunjungan

| Kategori | Tabel SIMGOS | Kunci ke kunjungan | Waktu input | Penginput | Status | Log OBJEK |
| --- | --- | --- | --- | --- | --- | --- |
| **Asesmen** | `medicalrecord.anamnesis` | `KUNJUNGAN` (idx) | `TANGGAL` (idx) | `OLEH` | `STATUS` | 21001 |
|  | `medicalrecord.keluhan_utama` | `KUNJUNGAN` (uniq) | `TANGGAL` (idx) | `OLEH` | `STATUS` | 21009 |
|  | `medicalrecord.pemeriksaan_fisik` | `KUNJUNGAN` (idx) | `TANGGAL` | `OLEH` | `STATUS` | 21014 |
| **CPPT** | `medicalrecord.cppt` | `KUNJUNGAN` (idx) | `TANGGAL` (idx) | `OLEH` + `JENIS` (peran) | `STATUS` | 21002 |
| **TTV** | `medicalrecord.tanda_vital` | `KUNJUNGAN` (idx) | `WAKTU_PEMERIKSAAN` (idx) + `TANGGAL` (input) | `OLEH` (idx) | `STATUS` | 21032 |
| **Diagnosis** | `medicalrecord.diagnosa` (ICD-10) | **`NOPEN`** (idx) — per episode | `TANGGAL` (idx) | `OLEH` | `STATUS` | 21003 |
| **Tindakan** | `layanan.tindakan_medis` | `KUNJUNGAN` (idx) | `TANGGAL` (idx) | `OLEH` | `STATUS` | 18020 |

- `KUNJUNGAN` = `pendaftaran.kunjungan.NOMOR` (char 19). `kunjungan.RUANGAN` → `master.ruangan` (`JENIS_KUNJUNGAN` = jenis layanan).
- **`OLEH` → `aplikasi.pengguna.ID` cocok 100%** (uji 2.000 baris terakhir per tabel).
- **Diagnosis per episode (`NOPEN`)**, bukan per ruangan → ditampilkan sebagai "Diagnosis episode" di tiap kunjungan; atribusi ke petugas tetap via `OLEH`.

### 2.3. Status 0 = Batal / Dihapus — **dapat ditelusuri pelakunya**

| Tabel | STATUS=1 | STATUS=0 |
| --- | ---: | ---: |
| `cppt` | 59.804 | **2.536** |
| `tanda_vital` | 7.873 | **218** |
| `diagnosa` | 26.620 | **236** |
| `tindakan_medis` | 173.528 | **3.424** |
| `anamnesis` / `keluhan_utama` / `pemeriksaan_fisik` | semua 1 | 0 |

**Uji keterlacakan:** 20/20 CPPT dan 20/20 tindakan berstatus 0 terbaru **punya log `U` yang mengubah `STATUS`→0**, sehingga **siapa & kapan membatalkan** bisa ditampilkan (lookup `OBJEK=? AND REF IN (...)`, REF ter-index = ID record). Kolom `pendaftaran.kunjungan.STATUS` juga punya 0 (kunjungan batal) — ditampilkan sebagai status kunjungan.

### 2.4. Profesi / peran penginput

- **Profesi pegawai:** `aplikasi.pengguna.NIP` → `master.pegawai.NIP` (cocok 224/226, NIP unik) → `PROFESI` → `master.referensi JENIS=36`: 4 Dokter · **6 Perawat** · 3 Bidan · 5 Farmasi · 2 Analis · 8 Radiografer · 1 Administrasi · 7 Perekam Medis · 12 Dietisen …
- **Peran di CPPT:** `cppt.JENIS` → `referensi JENIS=32`: 1 Dokter · **3 Paramedis** · 4 Apoteker · 5 Bidan. (CPPT 90 hari: Perawat 7.810 · Dokter 3.265 · Bidan 406.)
- `cppt.TENAGA_MEDIS` ≠ `OLEH` (0%) → **`OLEH` = penginput** yang dipakai untuk akuntabilitas.

### 2.5. Sinyal kepatuhan yang sudah terbukti ada di data

- **Keterlambatan input TTV:** `tanda_vital.TANGGAL` (waktu simpan) − `WAKTU_PEMERIKSAAN` (waktu periksa). 30 hari: rata-rata **±8 jam**, **225/430 (52%) diinput > 60 menit** setelah pemeriksaan → indikator ketepatan waktu yang kuat.
- **Petugas per pasien per hari (RI):** CPPT per kunjungan RI per hari mencapai **6–7 penginput berbeda** → metrik "berapa petugas per pasien per 24 jam" layak.
- **RI aktif saat ini:** 17 kunjungan; rata-rata lama rawat per ruangan ±3,5 hari (maks 11).
- **Volume kunjungan 90 hari per jenis:** Farmasi 4.174 · Lab 1.283 · IGD 697 · RI 586 · RJ 438.
- **Kategori di kunjungan Farmasi/Lab:** Lab memakai **Tindakan** (pemeriksaan lab = `tindakan_medis`, 886/30 hari). Farmasi hampir tidak punya 5 kategori ini — aktivitasnya di `layanan.farmasi` (di luar scope, lihat §10).

### 2.6. Performa (uji nyata)

| Query | Waktu |
| --- | ---: |
| Halaman 24 kunjungan (7 hari, RJ/IGD/RI) | 46 ms |
| Hitung per kategori untuk 24 kunjungan (`KUNJUNGAN IN (...)`) — tiap kategori | 53–73 ms |
| Agregasi CPPT RI 30 hari per ruangan (distinct petugas & pasien) | 147 ms |
| Agregasi tindakan 30 hari per jenis kunjungan (+ batal) | 107 ms |

---

## 3. Model Data: **Kunjungan-sentris**

```
master.ruangan (JENIS_KUNJUNGAN, prefiks 7/9 digit)
        │
pendaftaran.kunjungan  (NOMOR, NOPEN, RUANGAN, MASUK, KELUAR, STATUS)
        │        └── pendaftaran.pendaftaran (NOPEN → NORM) → master.pasien (nama/RM)
        ├── Asesmen   : anamnesis / keluhan_utama / pemeriksaan_fisik   (KUNJUNGAN)
        ├── CPPT      : medicalrecord.cppt                              (KUNJUNGAN)
        ├── TTV       : medicalrecord.tanda_vital                       (KUNJUNGAN)
        ├── Tindakan  : layanan.tindakan_medis                          (KUNJUNGAN)
        └── Diagnosis : medicalrecord.diagnosa                          (NOPEN / episode)

Setiap baris aktual ── REF ──► logs.pengguna_akses_log (OBJEK + REF)  → riwayat ubah & pembatalan
Setiap OLEH        ──────────► aplikasi.pengguna → master.pegawai (PROFESI)
```

**Unit analisis:**

| Unit | Definisi | Dipakai untuk |
| --- | --- | --- |
| **Kunjungan** | 1 baris `pendaftaran.kunjungan` (1 pasien × 1 ruangan) | Papan kunjungan, kelengkapan per kunjungan |
| **Hari rawat** | Kunjungan RI × tanggal kalender WITA (00:00–23:59) | "Dalam 24 jam berapa perawat/CPPT/TTV" |
| **Shift** | Pagi / Siang / Malam (jam dikonfigurasi, §10) | Matriks petugas per shift |
| **Petugas** | `OLEH` → pengguna + profesi | Skor reward & punishment |

**Aturan status:** `STATUS=1` → **Aktif**; `STATUS=0` → **Batal/Dihapus** (ditampilkan dicoret + badge, pelaku & waktu dari log bila ada; bila log tak ada → "Batal (pelaku tidak tercatat)"). Kunjungan batal (`kunjungan.STATUS=0` / `pendaftaran.STATUS=0`) disembunyikan secara default, bisa dimunculkan lewat filter.

---

## 4. Indikator Kepatuhan (usulan — target final menunggu §10)

Semua indikator **dihitung on-the-fly dari data aktual**, tanpa tabel baru di SIMGOS. Target disimpan sebagai **konstanta di kode** (Fase 2 awal), dan bisa dipindah ke pengaturan di DB `reporthub` nanti.

### 4.1. Kelengkapan per kunjungan (RJ / IGD)

| Indikator | Aturan usulan |
| --- | --- |
| Asesmen terisi | ≥ 1 dari anamnesis/keluhan utama/pemeriksaan fisik aktif |
| TTV terisi | ≥ 1 TTV aktif |
| CPPT terisi | ≥ 1 CPPT aktif |
| Diagnosis terisi | ≥ 1 diagnosa aktif pada episode |
| Tindakan tercatat | ≥ 1 tindakan aktif |

→ **Skor kelengkapan kunjungan** = kategori terpenuhi / kategori wajib (per jenis ruangan; mis. Lab hanya wajib Tindakan).

### 4.2. Kepatuhan per hari rawat (RI)

| Indikator | Target usulan (default) |
| --- | --- |
| CPPT oleh Perawat/Paramedis | ≥ 1 per shift (≥ 3 / 24 jam) |
| CPPT oleh Dokter (visite) | ≥ 1 / 24 jam |
| TTV | ≥ 3 / 24 jam |
| Petugas penginput unik | ditampilkan (bukan target) — per profesi |

### 4.3. Ketepatan waktu & integritas

| Indikator | Aturan |
| --- | --- |
| Keterlambatan input TTV | `TANGGAL − WAKTU_PEMERIKSAAN` > 60 menit → terlambat |
| Rasio pembatalan per petugas | baris STATUS=0 / total input petugas |
| Edit setelah input | jumlah log `U` per record (dari log) |

### 4.4. Skor Petugas (dasar reward & punishment)

Skor transparan per petugas dalam rentang tanggal:
- **Volume** input per kategori (dinormalisasi per profesi — perawat dibandingkan dengan perawat).
- **Ketepatan waktu** (% TTV tepat waktu).
- **Kontribusi kepatuhan** (hari rawat/shift yang dipenuhi oleh input petugas tsb.).
- **Rasio pembatalan** (penalti ringan).

Ditampilkan sebagai **papan peringkat per profesi** (Teladan ↔ Perlu Pembinaan) **dengan rincian yang bisa ditelusuri** ke record aktualnya — tidak ada angka tanpa bukti.

> ⚠️ Skor adalah **alat bantu** penilaian, bukan keputusan otomatis. Rumus & bobot ditampilkan terbuka di UI.

---

## 5. Strategi Query (optimasi wajib)

1. **Kunjungan-first, halaman-terbatas.** Ambil 1 halaman kunjungan (≤ 24–48) memakai index `kunjungan.MASUK`/`RUANGAN`, lalu hitung kategori dengan **`KUNJUNGAN IN (<nomor halaman>)`** (index `KUNJUNGAN`) — biaya **terbatas oleh ukuran halaman**, bukan besar tabel.
2. **Kunjungan aktif dalam rentang** (penting untuk RI yang masuk sebelum rentang): `MASUK <= :akhir AND (KELUAR IS NULL OR KELUAR >= :awal) AND MASUK >= :awal − 60 hari` (batas bawah agar tetap memakai index `MASUK`).
3. **Agregasi rentang pakai kolom waktu ter-index tiap tabel** (`cppt.TANGGAL`, `tanda_vital.WAKTU_PEMERIKSAAN`, `tindakan_medis.TANGGAL`, `diagnosa.TANGGAL`, `anamnesis.TANGGAL`), di-join ke kunjungan→ruangan, + `MAX_EXECUTION_TIME(8000)`.
4. **List tidak pernah mengambil kolom teks berat** (`cppt.SUBYEKTIF/OBYEKTIF/…`, `anamnesis.*`, `pemeriksaan_fisik.DESKRIPSI`) — hanya ID/waktu/OLEH/STATUS/JENIS. Isi klinis diambil **per record** di panel detail.
5. **Pelaku pembatalan** dari log dengan `OBJEK=? AND REF IN (...)` hanya untuk record STATUS=0 yang sedang tampil (REF ter-index), bukan scan log.
6. **Resolver cache** (pengguna+profesi, ruangan, referensi) di `globalThis` TTL 5 menit — tanpa N+1. `PASSWORD` tetap haram.
7. **Jam dinding WITA** via `DATE_FORMAT(...)` di SQL (hindari geser TZ adapter).
8. **Satu klien SIMGOS singleton** (`getSimgos`, `connectionLimit` 5); query per halaman dijalankan paralel terbatas (≤ 3) agar tidak menekan `max_connections` SIMGOS.
9. **Paginasi bernomor** (bukan infinite scroll) + total — sesuai kebutuhan UI "tidak scroll panjang".

---

## 6. Rancangan UI/UX

Prinsip: **padat, ringkas, bisa ditelusuri (drill-down)**, tidak ada daftar panjang tanpa akhir. Semua halaman memakai paginasi bernomor, drawer/panel samping, dan heatmap.

### 6.1. Struktur tab modul

```
Audit Trail RME
[ Papan Kunjungan ] [ Kepatuhan Petugas ] [ Peta Ruangan ] [ Log Aktivitas ] [ Tren ]
```

### 6.2. Papan Kunjungan (landing baru)

```
┌─ Filter: [Rentang tanggal] [Aktif sekarang] [Cari nama/RM]           [⤓ Ekspor] ─┐
├──────────────┬────────────────────────────────────────────────────────────────────┤
│ JENIS & RUANG│  Ringkasan: 142 kunjungan · Kelengkapan 78% · 9 batal · 31 petugas │
│ ● Semua  142 │ ┌──────────────────────────┐ ┌──────────────────────────┐          │
│ ▸ Rawat Inap │ │ Tn. A · RM 012345 · 67 th │ │ Ny. B · RM 023456 · 31 th │          │
│   Interna 12 │ │ RI · Interna Kls 3 · H+3  │ │ IGD · Non Bedah           │          │
│   Anak     6 │ │ ASM● CPPT 12 TTV 4 DX 3   │ │ ASM● CPPT 2  TTV 1 DX 2   │          │
│ ▸ IGD     31 │ │ TIN 18   ⊘ 1 batal        │ │ TIN 7                     │          │
│ ▸ Rawat Jln  │ │ 👥 7 petugas · ▰▰▰▱ 75%   │ │ 👥 3 petugas · ▰▰▰▰ 100%  │          │
│ ▸ Lab / Rad  │ └──────────────────────────┘ └──────────────────────────┘          │
│ ▸ Farmasi    │                          ‹ 1 2 3 … 6 ›                             │
└──────────────┴────────────────────────────────────────────────────────────────────┘
```

- **Rail kiri:** pohon jenis kunjungan → ruangan (prefiks 7/9 digit) dengan jumlah; klik = filter.
- **Kartu kunjungan:** 5 "pip" kategori (angka aktif, warna = terpenuhi/kurang/kosong), badge batal, jumlah petugas unik, bar kepatuhan.
- Klik kartu → **Drawer Jejak Kunjungan** (§6.3). Grid kartu + paginasi — tidak ada scroll tak berujung.

### 6.3. Drawer Jejak Kunjungan

Tab di dalam drawer:
1. **Matriks 24 jam** (RI): baris = hari rawat, kolom = shift × kategori; sel = jumlah + avatar petugas; sel merah = target tak terpenuhi.
2. **Petugas**: siapa saja yang menginput (dikelompokkan per profesi), jumlah per kategori, waktu pertama/terakhir.
3. **Data Aktual**: daftar record per kategori (aktif & **batal dicoret** + "dibatalkan oleh X, 25 Sep 14:02"); klik → isi klinis + riwayat edit (diff Fase 1).
4. **Log**: jejak perubahan record kunjungan ini dari `pengguna_akses_log`.

### 6.4. Kepatuhan Petugas (reward & punishment)

- Filter profesi (Perawat / Dokter / Bidan / …) + rentang + ruangan.
- **Papan peringkat** dua sisi: **Teladan** (atas) & **Perlu Pembinaan** (bawah), kartu skor dengan komponen (volume, tepat waktu, pembatalan).
- Klik petugas → **profil kepatuhan**: heatmap aktivitas harian (kalender), sebaran per kategori, daftar pasien yang ditangani, TTV terlambat, pembatalan — semuanya bisa ditelusuri ke record.

### 6.5. Peta Ruangan

- **Heatmap ruangan × hari** (warna = % kepatuhan), klik sel → daftar kunjungan ruangan tsb. pada hari itu.
- Ringkasan per ruangan: pasien, petugas unik, rasio perawat per pasien per hari, pembatalan.

### 6.6. Log Aktivitas (tab Fase 1, dirombak)

Timeline panjang diganti **tabel ringkas berpaginasi bernomor** (kepadatan tinggi, kolom: waktu · petugas · jenis · objek · pasien/ruangan bila dapat di-resolve), panel detail diff di samping (bukan modal yang menutupi).

---

## 7. Arsitektur & Keamanan

- Layering tetap: `*.schema.ts` (Zod) → `*.dal.ts` (satu-satunya pemakai `getSimgos`) → `*.service.ts` → route `withPermission("audit-rme", …)` + `ok/fail` → `*.client.ts` → view.
- **File baru terpisah** agar Fase 1 tetap bersih: `kunjungan-audit.constants.ts` (kategori, target, shift), `kunjungan-audit.dal.ts`, `kunjungan-audit.service.ts`, `kepatuhan.service.ts`, dst.
- **Kategori = allow-list konstanta** (tabel, kolom kunci, kolom waktu, OBJEK log) → menambah kategori = menambah satu entri; nama tabel/kolom **tidak pernah** berasal dari input pengguna (anti SQL-injection), nilai selalu di-bind `?`.
- **PHI:** nama pasien & isi klinis hanya untuk izin `audit-rme`; isi klinis hanya di detail per record.
- **Tidak ada write ke SIMGOS.** Target/pengaturan (bila perlu) disimpan di DB `reporthub`.

---

## 8. Rencana Bertahap Fase 2 (build flow)

> Satu stage per iterasi: **petakan → eksekusi → validasi E2E (cross-check SIMGOS) → lapor → user commit.**

### Stage K0 — Fondasi data kunjungan
- Konstanta kategori (allow-list tabel/kolom/OBJEK), jenis kunjungan (referensi 15), profesi (36), peran CPPT (32), shift & target.
- Resolver pengguna **+ profesi** (pengguna→pegawai), resolver ruangan (pohon prefiks).
- DAL: halaman kunjungan (aktif-dalam-rentang) + hitung kategori `IN (...)` + diagnosa per NOPEN.
- Endpoint `GET /api/audit-rme/kunjungan` + `/kunjungan/ruangan` (pohon + jumlah).
- **E2E:** jumlah per kategori == hitung langsung SIMGOS untuk sampel kunjungan.
- ✅ **SELESAI (26 Sep 2026)** — E2E 32/32. File: `kunjungan.constants.ts`, `kunjungan.schema.ts`, `kunjungan.dal.ts` (allow-list `KATEGORI_SOURCES`), `kunjungan.service.ts`, resolver pengguna+profesi & ruangan; route `/api/audit-rme/kunjungan` & `/api/audit-rme/ruangan`. Latensi warm 335–420 ms per halaman.

### Stage K1 — Papan Kunjungan (UI)
- Tab baru jadi landing; rail ruangan, kartu kunjungan dengan pip kategori, ringkasan, paginasi bernomor, pencarian nama/RM, filter "aktif sekarang".
- ✅ **SELESAI (26 Sep 2026)** — E2E 21/21 (API + interaksi UI nyata di Chrome headless) + K0 ulang 32/32. Tambahan hasil review visual: default **Layanan klinis (RI·IGD·RJ)** (param `kelompok=KLINIS`; Farmasi 340/617 kunjungan tanpa kategori RME tak lagi menenggelamkan papan), mode **Kartu | Ringkas** (tabel 1 baris/kunjungan), `NumberedPagination` (komponen UI generik baru), rail dengan label ruangan yang dapat turun baris, chip lokasi di mobile.
- ⚠️ **Koreksi data (penting):** Diagnosis kini menghitung SEMUA baris `diagnosa` aktif. `INA_GROUPER=1` ternyata diinput **dokter** (70% dari seluruh diagnosis, 30 hari) — bukan injeksi grouper. Filter `INA_GROUPER=0` sebelumnya membuat IGD tampak tanpa diagnosis (21/61 → kini 61/61).

### Stage K2 — Drawer Jejak Kunjungan
- Data aktual per kategori (aktif + batal), pelaku pembatalan dari log, petugas per profesi, **matriks 24 jam × shift** (RI), isi klinis per record + riwayat edit (reuse diff Fase 1).
- ✅ **SELESAI (28 Sep 2026)** — E2E 27/27 (API vs SIMGOS independen + UI nyata) + regresi Stage 2 14/14, K0 32/32, K1 21/21.
  - **Hari dinas** dimulai 07.00 (Pagi 07–14 · Siang 14–21 · Malam 21–07) agar shift Malam tak terbelah tanggal. Target dinilai hanya pada shift/hari yang **utuh** dalam masa rawat & sudah lewat; sebagian → "tidak dinilai", belum berjalan → "belum".
  - CPPT keperawatan = peran Paramedis + Bidan (`cppt.JENIS` 3, 5); dokter = 1. Diagnosis (per episode) tidak masuk matriks.
  - **Pelaku pembatalan** = log `U` terbaru yang menyetel `STATUS` **level atas** → 0 (parse JSON; snapshot tindakan memuat `STATUS` bersarang milik petugas → regex teks akan salah).
  - Tanda **nilai TTV tak wajar** (rentang fisiologis ekstrem, mis. suhu "374") & **keterlambatan input TTV** (semantik `TIMESTAMPDIFF`).
  - **Optimasi partisi log:** `logs.pengguna_akses_log` dipartisi `RANGE COLUMNS(TANGGAL)` per bulan (140 partisi); index `(OBJEK, REF)` lokal per partisi → lookup log per record diberi jendela `TANGGAL` (H-1 tanggal daftar episode s/d besok). Aman: 0 log sebelum tanggal daftar (0/5000 cppt, 0/5000 tindakan, 0/1191 diagnosa). Detail kunjungan warm 1.773 → ~66–190 ms (median).
  - Cakupan **detail diff** diperluas ke 7 sumber (timeline/dashboard Fase 1 tetap 3 objek).

### Stage K3 — Kepatuhan Petugas
- Skor per petugas per profesi, papan Teladan ↔ Perlu Pembinaan, profil petugas (heatmap kalender, TTV terlambat, pembatalan) dengan drill-down.

### Stage K4 — Peta Ruangan + rombak Log Aktivitas
- Heatmap ruangan × hari; tab Log jadi tabel berpaginasi + panel detail samping.

### Stage K5 — Ekspor (menggantikan Stage 4 Fase 1)
- Excel/PDF: rekap kepatuhan per petugas, per ruangan, dan rincian per kunjungan (bukti pembinaan/penghargaan). Meta-audit ekspor.

Opsional setelahnya: Stage 5 `bridge_log`, kategori tambahan (Farmasi `layanan.farmasi`, hasil lab `layanan.hasil_lab`, `diagnosis` teks, triage IGD), target yang dapat diatur dari UI.

---

## 9. Risiko & Mitigasi

| Risiko | Mitigasi |
| --- | --- |
| Beban ke SIMGOS produksi | Kunjungan-first + `IN` per halaman, `MAX_EXECUTION_TIME`, singleton + paralel ≤ 3, tanpa kolom teks di list |
| Salah atribusi diagnosis (per episode) | Ditandai "Diagnosis episode"; skor petugas via `OLEH`, bukan via ruangan |
| Target kepatuhan tak sesuai kebijakan RS | Target di konstanta + ditampilkan terbuka; dikonfirmasi komite mutu/keperawatan |
| Skor dianggap final untuk sanksi | Label "alat bantu", rumus terbuka, semua angka dapat ditelusuri ke record |
| Pembatalan tanpa jejak log | Ditampilkan jujur: "Batal (pelaku tidak tercatat)" |

---

## 10. Keputusan — **sudah disepakati (26 Sep 2026)**

1. **Target RI & shift:** ✅ **default §4.2** — CPPT perawat ≥ 1/shift (≥ 3/24 jam), CPPT dokter ≥ 1/24 jam, TTV ≥ 3/24 jam; shift **Pagi 07–14, Siang 14–21, Malam 21–07** (WITA). Disimpan di konstanta, bisa diubah nanti.
2. **Asesmen:** ✅ **3 tabel inti** — `anamnesis` + `keluhan_utama` + `pemeriksaan_fisik`.
3. **Farmasi & Lab:** ✅ **lewat kategori Tindakan dulu**; kategori Farmasi (`layanan.farmasi`) jadi stage opsional.
4. **Urutan:** ✅ **K0 → K1 Papan Kunjungan** → K2 Drawer → K3 Kepatuhan Petugas → K4 → K5.

---

_Keputusan §10 disepakati → implementasi dimulai dari **Stage K0**, bertahap. Tidak ada perubahan skema SIMGOS — modul murni membaca._

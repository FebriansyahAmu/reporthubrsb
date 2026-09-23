# Product Requirements Document (PRD)

## Modul Rekapitulasi Dana Klaim INA-CBG's & Rujukan Ambulans

**Project:** ReportHub / AuditTrail  
**Organisasi:** UPTD RSUD Bolaang Mongondow Timur  
**Versi:** 1.0  
**Tanggal:** 22 September 2026  
**PIC Referensi:** dr. Rendi N. J. Sewow (NIP. 19870421 202012 1 002)

---

## 1. Latar Belakang

UPTD RSUD Bolaang Mongondow Timur saat ini mengelola rekapitulasi dana klaim INA-CBG's dari BPJS Kesehatan menggunakan spreadsheet Excel secara manual. Data mencakup periode 2023 hingga 2026 dengan beberapa kategori klaim yang berbeda. Pengelolaan manual ini menimbulkan risiko inkonsistensi data, kesulitan pelacakan (audit trail), dan lambatnya proses pelaporan.

Modul baru pada ReportHub/AuditTrail ini dirancang untuk mendigitalisasi seluruh proses pencatatan, pelacakan, dan pelaporan klaim BPJS, sehingga meningkatkan akurasi, transparansi, dan efisiensi operasional.

---

## 2. Tujuan

1. Menyediakan sistem pencatatan klaim INA-CBG's yang terstruktur dan terpusat, menggantikan spreadsheet manual.
2. Memisahkan dan melacak klaim berdasarkan jenis: Reguler, Pending, dan Rujukan Ambulans.
3. Memberikan audit trail lengkap untuk setiap transaksi klaim.
4. Menghasilkan laporan rekapitulasi otomatis per periode (bulanan/tahunan).
5. Mendeteksi dan mencatat potongan, selisih bayar, kelebihan transfer, serta klaim yang expired.

---

## 3. Analisis Data Sumber (8 Sheet Excel)

### 3.1. Sheet "KLAIM 2023" — Rekapitulasi Klaim Tahun 2023

| Aspek             | Detail                                                                                                 |
| ----------------- | ------------------------------------------------------------------------------------------------------ |
| Periode pelayanan | Mei – November 2023                                                                                    |
| Jumlah entri      | 9 transaksi                                                                                            |
| Jenis klaim       | Reguler (RJTL & RITL) dan Pending (RJTL & RITL)                                                        |
| Total dana        | Rp 908.268.800                                                                                         |
| Breakdown         | Reguler RJTL: Rp 71.339.700; Reguler RITL: Rp 808.170.000; Pending RITL: Rp 28.759.100                 |
| Catatan khusus    | Terdapat "Klaim Pending dan Susulan" (entri Juli), menunjukkan adanya klaim susulan yang perlu dilacak |

### 3.2. Sheet "KLAIM 2024" — Rekapitulasi Klaim Tahun 2024

| Aspek             | Detail                                                                                                                                                                                                                                                        |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Periode pelayanan | Agustus 2023 – Oktober 2024 (termasuk pending tahun sebelumnya)                                                                                                                                                                                               |
| Jumlah entri      | 23 transaksi                                                                                                                                                                                                                                                  |
| Total dana        | Rp 2.199.179.900                                                                                                                                                                                                                                              |
| Breakdown         | Reguler RJTL: Rp 206.185.900; Reguler RITL: Rp 1.877.428.600; Pending RJTL: Rp 372.700; Pending RITL: Rp 115.192.700                                                                                                                                          |
| Catatan khusus    | **Kelebihan transfer BPJS** sebesar Rp 268.342.300 karena error sistem (sudah dikembalikan); Potongan AAK (Ambulatory Adjustment Klaster) pada beberapa bulan; Klaim pending Desember 2023 "belum terealisasi karena tidak terinput pada data review piutang" |

### 3.3. Sheet "KLAIM 2025" — Rekapitulasi Klaim Tahun 2025

| Aspek              | Detail                                                                                                                                                                                                                                                |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Periode pelayanan  | November 2024 – September 2025 (termasuk pending 2024)                                                                                                                                                                                                |
| Jumlah entri       | 24 transaksi                                                                                                                                                                                                                                          |
| Total dana         | Rp 2.526.131.100                                                                                                                                                                                                                                      |
| Breakdown          | Reguler RITL: Rp 1.980.641.800; Reguler RJTL: Rp 160.381.100; Pending RITL: Rp 365.378.200; Pending RJTL: Rp 19.730.000                                                                                                                               |
| Catatan khusus     | **Selisih bayar** pada klaim Mei 2025: pengajuan Rp 152.868.600 vs masuk rekening Rp 150.421.100 (selisih Rp 2.447.500 akibat temuan kelebihan bayar Feb 2024 – Apr 2025 sejumlah 39 kasus); Sisa potongan Rp 243.700 dijadwalkan di klaim berikutnya |
| Perubahan struktur | Kolom RITL dan RJTL **posisinya bertukar** dibanding tahun 2023–2024 (RITL=E, RJTL=F pada reguler)                                                                                                                                                    |

### 3.4. Sheet "KLAIM 2026 (2)" — Rekapitulasi Klaim Tahun 2026 (Versi Terbaru)

| Aspek             | Detail                                                                                                                                                                                                                                                                         |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Periode pelayanan | Juli 2025 – Juni 2026                                                                                                                                                                                                                                                          |
| Jumlah entri      | 18 transaksi                                                                                                                                                                                                                                                                   |
| Total dana        | Rp 2.415.129.000                                                                                                                                                                                                                                                               |
| Breakdown         | Reguler RITL: Rp 2.051.573.100; Reguler RJTL: Rp 131.023.000; Pending RITL: Rp 214.108.100; Pending RJTL: Rp 18.424.800                                                                                                                                                        |
| Catatan khusus    | **Potongan bertahap** (Ke-I, II, III) kelebihan bayar & AAK sesuai BA Kesepakatan: masing-masing Rp 18.071.300 (RITL Rp 9.615.100 + RJTL Rp 8.456.200); Klaim pending Januari 2026 sudah diajukan tapi **expired**; Terdapat klaim pending yang dirincikan per bulan pelayanan |

### 3.5. Sheet "KLAIM 2026" — Rekapitulasi Klaim Tahun 2026 (Versi Awal/Parsial)

| Aspek             | Detail                                                                                                                                       |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Periode pelayanan | Juli 2025 – Maret 2026                                                                                                                       |
| Jumlah entri      | 12 transaksi (lebih sedikit dari versi terbaru)                                                                                              |
| Total dana        | Rp 1.490.255.900                                                                                                                             |
| Catatan khusus    | Versi awal sebelum penambahan data April–Juni 2026. Menunjukkan bahwa spreadsheet dikelola dalam **multiple versi** yang rawan inkonsistensi |

### 3.6. Sheet "KLAIM PENDING 2026 (2)" — Rekapan Klaim Pending 2026 (Versi Terbaru)

| Aspek         | Detail                                                                                                      |
| ------------- | ----------------------------------------------------------------------------------------------------------- |
| Periode       | Januari – April 2026                                                                                        |
| Total kasus   | 86 kasus (75 Rawat Inap + 11 Rawat Jalan)                                                                   |
| Total biaya   | Rp 168.478.900 (RI: Rp 166.122.600; RJ: Rp 2.356.300)                                                       |
| Struktur data | Berbeda dari sheet klaim utama — menggunakan jumlah kasus dan biaya per bulan, bukan tanggal masuk rekening |

### 3.7. Sheet "KLAIM PENDING 2026" — Rekapan Klaim Pending 2026 (Versi Awal)

| Aspek   | Detail                                                |
| ------- | ----------------------------------------------------- |
| Isi     | Identik dengan sheet "KLAIM PENDING 2026 (2)"         |
| Catatan | Duplikasi data, menunjukkan kebutuhan version control |

### 3.8. Sheet "KLAIM RUJUKAN 2025-2026" — Rekapitulasi Klaim Rujukan Ambulans

| Aspek         | Detail                                                                                                                     |
| ------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Periode       | Juli 2025 – Maret 2026                                                                                                     |
| Dua bagian    | **Pelayanan 2025:** 7 entri, 37 kasus, total Rp 22.489.600; **Pelayanan 2026:** 3 entri, 25 kasus, total Rp 21.093.800     |
| Karakteristik | Semua biaya ada di kolom RJTL (bukan RITL); Mencatat jumlah kasus per entri; Merupakan jenis klaim terpisah dari INA-CBG's |

---

## 4. Temuan Kritis dari Analisis Data

### 4.1. Masalah yang Harus Diselesaikan Modul Baru

| No  | Masalah                                                                                                            | Dampak                                          | Solusi di Modul Baru                               |
| --- | ------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------- | -------------------------------------------------- |
| 1   | **Duplikasi sheet** (KLAIM 2026 vs KLAIM 2026 (2), PENDING 2026 vs PENDING 2026 (2))                               | Data tidak konsisten, risiko salah lapor        | Single source of truth dengan version history      |
| 2   | **Inkonsistensi struktur kolom** (posisi RITL/RJTL bertukar antar tahun)                                           | Sulit membandingkan data lintas tahun           | Skema database tetap dengan mapping yang konsisten |
| 3   | **Format tanggal tidak seragam** (ada yang "20 SEPTEMBER 2023", "2025-01-24 00:00:00", "05/01/2026", "02/06/2025") | Parsing error, kesulitan sorting                | Standarisasi format tanggal (ISO 8601)             |
| 4   | **Potongan & selisih bayar** tersebar di kolom keterangan sebagai teks bebas                                       | Sulit diaudit dan direkap otomatis              | Entitas terpisah untuk potongan/adjustment         |
| 5   | **Klaim expired** (Pending Januari 2026) hanya tercatat di keterangan                                              | Tidak ada mekanisme alert/tracking              | Status tracking dengan notifikasi                  |
| 6   | **Tidak ada audit trail** perubahan data                                                                           | Tidak bisa melacak siapa mengubah apa dan kapan | Logging setiap create/update/delete                |

---

## 5. Spesifikasi Fungsional

### 5.1. Entitas Data Utama

#### 5.1.1. Klaim (tabel: `claims`)

| Field                  | Tipe                  | Deskripsi                                                                   |
| ---------------------- | --------------------- | --------------------------------------------------------------------------- |
| `id`                   | UUID / Auto-increment | Primary key                                                                 |
| `claim_number`         | VARCHAR               | Nomor klaim unik                                                            |
| `claim_type`           | ENUM                  | `REGULER`, `PENDING`, `SUSULAN`                                             |
| `service_type`         | ENUM                  | `RITL` (Rawat Inap Tingkat Lanjutan), `RJTL` (Rawat Jalan Tingkat Lanjutan) |
| `service_category`     | ENUM                  | `INA_CBGS`, `RUJUKAN_AMBULANS`                                              |
| `service_period_month` | INT                   | Bulan pelayanan (1–12)                                                      |
| `service_period_year`  | INT                   | Tahun pelayanan                                                             |
| `amount`               | DECIMAL(15,2)         | Jumlah biaya klaim                                                          |
| `case_count`           | INT                   | Jumlah kasus (khusus pending & rujukan)                                     |
| `date_received`        | DATE                  | Tanggal masuk rekening                                                      |
| `status`               | ENUM                  | `SUBMITTED`, `APPROVED`, `RECEIVED`, `PARTIAL`, `EXPIRED`, `REJECTED`       |
| `notes`                | TEXT                  | Keterangan tambahan                                                         |
| `reference_ba`         | VARCHAR               | Nomor BA Kesepakatan (jika ada)                                             |
| `created_by`           | VARCHAR               | User yang membuat entri                                                     |
| `created_at`           | TIMESTAMP             | Waktu pembuatan                                                             |
| `updated_by`           | VARCHAR               | User yang terakhir mengubah                                                 |
| `updated_at`           | TIMESTAMP             | Waktu perubahan terakhir                                                    |

#### 5.1.2. Potongan / Adjustment (tabel: `claim_adjustments`)

| Field                | Tipe                  | Deskripsi                                                           |
| -------------------- | --------------------- | ------------------------------------------------------------------- |
| `id`                 | UUID / Auto-increment | Primary key                                                         |
| `claim_id`           | FK → claims           | Klaim yang dikenai potongan                                         |
| `adjustment_type`    | ENUM                  | `AAK`, `KELEBIHAN_BAYAR`, `VPK`, `POTONGAN_BERKALA`, `PENGEMBALIAN` |
| `amount`             | DECIMAL(15,2)         | Jumlah potongan (nilai negatif)                                     |
| `installment_number` | INT                   | Potongan ke-berapa (untuk cicilan)                                  |
| `total_installments` | INT                   | Total rencana cicilan                                               |
| `ba_reference`       | VARCHAR               | Nomor BA Kesepakatan                                                |
| `description`        | TEXT                  | Penjelasan potongan                                                 |
| `applied_date`       | DATE                  | Tanggal potongan diterapkan                                         |
| `created_at`         | TIMESTAMP             | Waktu pencatatan                                                    |

#### 5.1.3. Audit Trail (tabel: `audit_logs`)

| Field         | Tipe                  | Deskripsi                                                    |
| ------------- | --------------------- | ------------------------------------------------------------ |
| `id`          | UUID / Auto-increment | Primary key                                                  |
| `entity_type` | VARCHAR               | Nama tabel yang diubah (`claims`, `claim_adjustments`, dll.) |
| `entity_id`   | VARCHAR               | ID entitas yang diubah                                       |
| `action`      | ENUM                  | `CREATE`, `UPDATE`, `DELETE`                                 |
| `field_name`  | VARCHAR               | Nama field yang berubah                                      |
| `old_value`   | TEXT                  | Nilai lama                                                   |
| `new_value`   | TEXT                  | Nilai baru                                                   |
| `changed_by`  | VARCHAR               | User yang melakukan perubahan                                |
| `changed_at`  | TIMESTAMP             | Waktu perubahan                                              |
| `ip_address`  | VARCHAR               | IP address user                                              |
| `session_id`  | VARCHAR               | Session identifier                                           |

#### 5.1.4. Rekapitulasi Tahunan (tabel: `annual_summaries`) — _generated/materialized view_

| Field                | Tipe          | Deskripsi                    |
| -------------------- | ------------- | ---------------------------- |
| `year`               | INT           | Tahun rekapitulasi           |
| `total_reguler_ritl` | DECIMAL(15,2) | Total klaim reguler RITL     |
| `total_reguler_rjtl` | DECIMAL(15,2) | Total klaim reguler RJTL     |
| `total_pending_ritl` | DECIMAL(15,2) | Total klaim pending RITL     |
| `total_pending_rjtl` | DECIMAL(15,2) | Total klaim pending RJTL     |
| `total_rujukan`      | DECIMAL(15,2) | Total klaim rujukan ambulans |
| `total_adjustments`  | DECIMAL(15,2) | Total potongan/adjustment    |
| `grand_total`        | DECIMAL(15,2) | Total keseluruhan            |

---

### 5.2. Fitur Utama

#### F-01: Manajemen Data Klaim

- **F-01.1** — Input klaim baru dengan validasi field wajib (jenis klaim, jenis layanan, periode pelayanan, jumlah, tanggal masuk rekening).
- **F-01.2** — Edit data klaim dengan pencatatan otomatis setiap perubahan di audit trail.
- **F-01.3** — Import data dari file Excel (migrasi data historis 2023–2026).
- **F-01.4** — Pembedaan otomatis antara klaim Reguler dan Pending berdasarkan input.
- **F-01.5** — Pencatatan klaim Rujukan Ambulans sebagai kategori terpisah dengan field jumlah kasus.
- **F-01.6** — Penandaan klaim Susulan yang terkait dengan periode pelayanan sebelumnya.

#### F-02: Pencatatan Potongan & Adjustment

- **F-02.1** — Input potongan dengan link ke klaim yang terdampak.
- **F-02.2** — Tracking potongan bertahap/cicilan (misal: Potongan Ke-I, II, III berdasarkan BA Kesepakatan).
- **F-02.3** — Pencatatan kelebihan bayar, pengembalian dana, dan error transfer.
- **F-02.4** — Alert otomatis untuk sisa potongan yang belum dilunasi.
- **F-02.5** — Rekap total potongan per bulan dan per tahun.

#### F-03: Status Tracking & Notifikasi

- **F-03.1** — Status lifecycle klaim: Submitted → Approved → Received → Closed (atau Expired/Rejected).
- **F-03.2** — Alert untuk klaim pending yang mendekati batas waktu (risiko expired).
- **F-03.3** — Notifikasi selisih antara jumlah pengajuan dan jumlah yang diterima.
- **F-03.4** — Dashboard status klaim pending yang belum cair per bulan pelayanan.

#### F-04: Laporan & Rekapitulasi

- **F-04.1** — Rekapitulasi per tahun dalam format tabel sesuai struktur Excel saat ini (kompatibilitas visual).
- **F-04.2** — Laporan perbandingan antar tahun (trend analysis).
- **F-04.3** — Laporan klaim pending: jumlah kasus dan biaya per bulan, dikelompokkan Rawat Inap vs Rawat Jalan.
- **F-04.4** — Laporan rujukan ambulans: per bulan pelayanan dengan jumlah kasus.
- **F-04.5** — Export laporan ke Excel (.xlsx) dan PDF sesuai format resmi RSUD.
- **F-04.6** — Dashboard ringkasan: total klaim YTD, pending belum cair, potongan berjalan, tren bulanan.

#### F-05: Audit Trail

- **F-05.1** — Pencatatan otomatis setiap operasi CREATE, UPDATE, DELETE pada semua entitas.
- **F-05.2** — Riwayat perubahan field-level (old value → new value).
- **F-05.3** — Filter dan pencarian audit log berdasarkan tanggal, user, entitas, dan jenis aksi.
- **F-05.4** — Laporan audit trail per periode untuk keperluan inspeksi dan akuntabilitas.
- **F-05.5** — Immutable log — data audit trail tidak dapat diedit atau dihapus oleh user biasa.

---

### 5.3. User Roles & Permissions

| Role                   | Hak Akses                                                                                        |
| ---------------------- | ------------------------------------------------------------------------------------------------ |
| **Admin**              | Full access: CRUD semua data, kelola user, akses audit trail, export laporan, konfigurasi sistem |
| **PIC JKN**            | Input/edit klaim, input potongan, lihat laporan, export laporan                                  |
| **Viewer / Manajemen** | Lihat dashboard, lihat laporan, export laporan (read-only)                                       |
| **Auditor**            | Lihat semua data termasuk audit trail (read-only)                                                |

---

## 6. Data Migration Plan

### 6.1. Data yang Akan Dimigrasikan

| Sumber Sheet            | Target              | Jumlah Record                | Catatan                                         |
| ----------------------- | ------------------- | ---------------------------- | ----------------------------------------------- |
| KLAIM 2023              | `claims`            | 9                            | Tahun paling awal                               |
| KLAIM 2024              | `claims`            | 23                           | Termasuk pending dari 2023                      |
| KLAIM 2025              | `claims`            | 24                           | Perhatikan posisi kolom RITL/RJTL yang bertukar |
| KLAIM 2026 (2)          | `claims`            | 18                           | Gunakan versi "(2)" sebagai versi final         |
| KLAIM PENDING 2026 (2)  | `claims`            | 4 agregat / detail per kasus | Gunakan versi "(2)" sebagai versi final         |
| KLAIM RUJUKAN 2025-2026 | `claims`            | 10                           | Dua bagian: pelayanan 2025 dan 2026             |
| Keterangan potongan     | `claim_adjustments` | ±10                          | Diextract dari kolom KET                        |

### 6.2. Aturan Migrasi

1. Sheet "KLAIM 2026" (tanpa "(2)") dan "KLAIM PENDING 2026" (tanpa "(2)") **diabaikan** — data sudah tercakup dalam versi "(2)".
2. Format tanggal dinormalisasi ke ISO 8601 (`YYYY-MM-DD`).
3. Keterangan potongan (AAK, kelebihan bayar, VPK) diparsing menjadi entri terpisah di tabel `claim_adjustments`.
4. Klaim susulan ditandai dengan `claim_type = 'SUSULAN'`.
5. Semua amount disimpan dalam satuan Rupiah penuh (tanpa desimal pada data existing, tetapi field menggunakan DECIMAL untuk antisipasi).

---

## 7. Referensi Ringkasan Keuangan per Tahun

Data berikut diambil dari analisis spreadsheet sebagai baseline validasi migrasi:

| Tahun  | Reguler RITL  | Reguler RJTL | Pending RITL | Pending RJTL | Total         |
| ------ | ------------- | ------------ | ------------ | ------------ | ------------- |
| 2023   | 808.170.000   | 71.339.700   | 28.759.100   | —            | 908.268.800   |
| 2024   | 1.877.428.600 | 206.185.900  | 115.192.700  | 372.700      | 2.199.179.900 |
| 2025   | 1.980.641.800 | 160.381.100  | 365.378.200  | 19.730.000   | 2.526.131.100 |
| 2026\* | 2.051.573.100 | 131.023.000  | 214.108.100  | 18.424.800   | 2.415.129.000 |

\* Data 2026 per Juni 2026 (belum tutup tahun). Rujukan Ambulans 2025–2026 total: Rp 43.583.400.

---

## 8. Non-Functional Requirements

| Aspek                | Requirement                                                                 |
| -------------------- | --------------------------------------------------------------------------- |
| **Keamanan**         | Autentikasi user, role-based access control, enkripsi data sensitif         |
| **Performa**         | Query rekapitulasi tahunan < 3 detik untuk dataset 4 tahun                  |
| **Ketersediaan**     | Uptime target 99.5% pada jam kerja (08:00–17:00 WITA)                       |
| **Backup**           | Daily backup database dengan retensi 90 hari                                |
| **Kompatibilitas**   | Export Excel kompatibel dengan format template RSUD saat ini                |
| **Audit compliance** | Audit log tidak dapat di-tamper, retensi minimal 5 tahun                    |
| **Scalability**      | Mendukung penambahan data hingga 10 tahun ke depan tanpa degradasi performa |

---

## 9. Acceptance Criteria

1. Seluruh data dari 8 sheet Excel berhasil dimigrasikan dan dapat ditampilkan ulang dalam format yang sama.
2. Total rekapitulasi per tahun setelah migrasi **cocok persis** dengan total pada spreadsheet sumber.
3. Setiap perubahan data tercatat di audit trail dengan informasi user, timestamp, dan detail perubahan.
4. Laporan dapat di-export ke Excel dengan format sesuai template resmi RSUD.
5. Klaim pending menampilkan alert minimal 7 hari sebelum batas waktu expired.
6. Potongan bertahap dapat dilacak progresnya (sudah cicilan ke-berapa dari total berapa).
7. Dashboard menampilkan ringkasan real-time: total klaim YTD, pending belum cair, dan tren bulanan.

---

## 10. Risiko & Mitigasi

| Risiko                                                                      | Dampak                                | Mitigasi                                                                                   |
| --------------------------------------------------------------------------- | ------------------------------------- | ------------------------------------------------------------------------------------------ |
| Inkonsistensi data pada migrasi karena perbedaan struktur kolom antar tahun | Data salah masuk (RITL tertukar RJTL) | Mapping kolom per sheet, validasi total per tahun terhadap angka di spreadsheet            |
| User resistance terhadap sistem baru                                        | Rendahnya adopsi, kembali ke Excel    | Training, UI mirip tampilan Excel yang familiar, dual-run period                           |
| Keterangan potongan sulit diparsing otomatis (teks bebas)                   | Adjustment tidak terekam lengkap      | Manual review + semi-automated extraction, verifikasi oleh PIC JKN                         |
| Perubahan aturan BPJS (struktur klaim, jenis potongan baru)                 | Skema database perlu diubah           | Desain extensible: field enum yang bisa ditambah, tabel konfigurasi untuk jenis adjustment |

---

## 11. Lampiran

### A. Glosarium

| Istilah            | Penjelasan                                                                                       |
| ------------------ | ------------------------------------------------------------------------------------------------ |
| **INA-CBG's**      | Indonesia Case Base Groups — sistem tarif pelayanan kesehatan yang digunakan oleh BPJS Kesehatan |
| **RITL**           | Rawat Inap Tingkat Lanjutan                                                                      |
| **RJTL**           | Rawat Jalan Tingkat Lanjutan                                                                     |
| **AAK**            | Ambulatory Adjustment Klaster — penyesuaian tarif oleh BPJS                                      |
| **VPK**            | Verifikasi Penjaminan Klaim                                                                      |
| **BA Kesepakatan** | Berita Acara Kesepakatan — dokumen formal persetujuan antara RSUD dan BPJS                       |
| **Klaim Reguler**  | Klaim yang diajukan pada periode pelayanan normal (sesuai jadwal)                                |
| **Klaim Pending**  | Klaim yang belum dibayarkan atau tertunda dari periode sebelumnya                                |
| **Klaim Susulan**  | Klaim tambahan yang diajukan setelah klaim reguler periode tersebut sudah diproses               |
| **Expired**        | Klaim pending yang melewati batas waktu pengajuan sehingga tidak dapat dicairkan                 |

### B. Referensi Dokumen BA Kesepakatan

- NO.477/BA/X-06/0226 — BA Kesepakatan kelebihan bayar & AAK
- 445/RSUD.01/077/II/2026 — BA Kesepakatan terkait potongan bertahap (3 kali × Rp 18.071.300)

# Audit Surat Kontrol

Menu baru di workspace **Audit Trail RME** (`/audit-rme/surat-kontrol`). Fitur ini membandingkan Surat Kontrol dan SPRI yang **terbit di BPJS** dengan **jadwal di SIMRS**. Tujuannya menemukan tanggal rencana yang tidak sama, jadwal yang hilang atau batal, poli yang berbeda, dan jam yang menumpuk.

Fitur ini **read-only**: tidak ada data SIMGOS yang diubah. Perbaikan jadwal (mis. jam yang sama) direncanakan sebagai tahap terpisah.

## 1. Sumber data

| Sumber | Peran | Kunci |
|---|---|---|
| Webservice SIMGOS `GET /webservice/plugins/bpjs/rencanaKontrol` (diteruskan ke VClaim BPJS) | **Sumber utama**, real-time: semua surat dengan tanggal rencana di rentang | `noSuratKontrol` |
| `medicalrecord.jadwal_kontrol` | Jadwal kontrol di SIMRS (Surat Kontrol, `jnsKontrol = 2`) | `NOMOR_REFERENSI` = nomor surat BPJS |
| `medicalrecord.perencanaan_rawat_inap` | Perencanaan rawat inap di SIMRS (SPRI, `jnsKontrol = 1`) | `NOMOR_REFERENSI` = nomor surat BPJS |
| `bpjs.rencana_kontrol` | Catatan penerbitan lokal SIMGOS. Juga **cadangan** bila webservice gagal | `noSurat` |
| `pendaftaran.kunjungan`, `pendaftaran.penjamin`, `master.ruangan`, `master.dokter`, `master.penjamin_ruangan`, `aplikasi.pengguna` | Pasien, kunjungan asal, penjamin, nama poli & dokter, pemetaan poli BPJS, petugas pembuat | — |

Catatan:
- `jadwal_kontrol` berada di database **`medicalrecord`**, bukan `layanan`.
- `jnsKontrol`: **1 = SPRI**, **2 = Surat Kontrol**.

### Perilaku webservice (teruji 12 Okt 2026)

- **Rentang maksimal 30 hari.** Rentang lebih lebar dibalas `412` dengan pesan *"Range tanggal awal dan akhir tidak boleh lebih dari 30 hari(201)"*. Aplikasi memecah rentang per 30 hari secara berurutan lalu menggabungkannya. Layar mengizinkan sampai 31 hari, cukup untuk satu bulan penuh.
- **Rentang tanpa surat dibalas `412`** dengan pesan *"Data Tidak Ditemukan(201)"*. Ini dianggap daftar kosong, bukan galat.
- Parameter `filter`, `page`, `start`, dan `limit` tidak berpengaruh. Respons selalu memuat seluruh surat dengan tanggal **rencana** di rentang itu.
- ⚠️ **Efek samping di SIMGOS (disetujui user):** setiap panggilan, plugin SIMGOS menyimpan hasilnya ke tabel cache **`bpjs.monitoring_rencana_kontrol`**, sama seperti layar Monitoring Rencana Kontrol SIMGOS. Tabel yang diaudit tidak tersentuh. Untuk menekan jumlah panggilan:
  - cache 5 menit per rentang, dengan *single-flight*;
  - maksimal 2 panggilan bersamaan;
  - "Segarkan dari BPJS" paling cepat tiap 30 detik per rentang;
  - batas 30 permintaan per menit per pengguna (`429`).
- Bila webservice gagal (jaringan, timeout 30 detik, atau galat BPJS), layar memakai **catatan lokal** `bpjs.rencana_kontrol` dan menampilkan peringatan. Dalam mode ini, temuan *Catatan lokal beda* dan *Belum dipakai* tidak bisa dinilai.

## 2. Temuan

Status baris diambil dari temuan terberat. Temuan bertingkat **info** tidak mengubah status.

| Temuan | Tingkat | Aturan |
|---|---|---|
| Tanggal beda | Bermasalah | Tanggal jadwal SIMRS ≠ tanggal rencana BPJS. Selisih ditampilkan dalam hari (jadwal − rencana). |
| Tak ada di BPJS | Bermasalah | Jadwal SIMRS aktif merujuk nomor surat yang tidak ada di respons BPJS, dan catatan lokalnya tidak ada atau dihapus. |
| Tanpa jadwal SIMRS | Perlu ditinjau | Surat terbit di BPJS tanpa jadwal kontrol (atau SPRI) di SIMRS yang merujuknya. |
| Jadwal dibatalkan | Perlu ditinjau | Jadwal SIMRS berstatus batal, tetapi surat BPJS masih aktif. |
| Poli beda | Perlu ditinjau | Ruangan tujuan jadwal SIMRS, setelah dipetakan ke kode BPJS lewat `master.penjamin_ruangan`, ≠ poli kontrol BPJS. Tidak dinilai bila ruangan belum dipetakan. |
| Belum terbit di BPJS | Perlu ditinjau | Jadwal SIMRS pasien BPJS tanpa nomor surat BPJS. Pasien non-BPJS tidak diaudit, hanya dihitung. |
| Catatan lokal beda | Info | `bpjs.rencana_kontrol` tidak ada, dihapus, atau tanggalnya ≠ BPJS. Kemungkinan surat diubah langsung di VClaim. |
| Jam bentrok | Info | ≥ 2 jadwal aktif pada **dokter + tanggal + jam** yang sama. Ini bahan perbaikan pembagian jam tahap berikutnya. |
| Belum dipakai | Info | Tanggal rencana sudah lewat, tetapi SEP kontrol belum terbit (`terbitSEP = Belum`). |

**Jadwal yang suratnya bertanggal di luar rentang.** Jadwal SIMRS di rentang yang merujuk surat dengan tanggal rencana di luar rentang tidak muncul di respons BPJS. Untuk kasus ini, aplikasi memakai catatan lokal sebagai pembanding (ditandai "Data BPJS dari catatan lokal") lalu memberi temuan *Tanggal beda*.

## 3. Tampilan

- **Saringan:** tanggal rencana (Bulan ini / 7 hari ke depan / 7 hari terakhir / Bulan lalu / Dari–Sampai, maks. 31 hari dan maks. 90 hari ke depan), jenis (Surat Kontrol / SPRI / Semua), dan pencarian (nomor surat, SEP, kartu, RM, NOPEN, nama pasien atau dokter).
- **Ubin ringkasan:** Total, Kesesuaian %, Bermasalah, Perlu ditinjau, dan Jam bentrok. Klik ubin untuk menyaring. **Cip temuan** bisa diklik untuk menyaring per temuan.
- **Sebaran per tanggal rencana:** batang bertumpuk per status. Klik batang untuk menyaring ke tanggal itu. **Per poli tujuan:** klik untuk menyaring ke poli itu.
- **Daftar surat:** tabel lebar penuh, 25 baris per halaman, ↑/↓ untuk berpindah baris. Klik atau Enter membuka **drawer perbandingan** BPJS | SIMRS | Catatan lokal; sel yang berbeda disorot. Drawer memuat temuan beserta saran tindak lanjut, jadwal lain di jam yang sama, rincian, dan navigasi Sebelumnya/Berikutnya.
- **Jam bentrok:** slot terpadat lebih dulu. Buka slot untuk melihat pasiennya, lalu klik pasien untuk membuka perbandingan.
- Data satu rentang diambil sekali. Saringan, pencarian, urutan, dan paginasi diproses di klien (instan, tanpa memanggil BPJS ulang).

## 4. Ekspor Excel

Tombol **Ekspor Excel** (izin `print`) memakai saringan yang sama dengan layar. Isinya 4 lembar:
- **Audit Surat Kontrol:** semua kolom BPJS, SIMRS, dan catatan lokal, beserta temuan dan selisih.
- **Ringkasan:** jumlah per status dan per temuan, dengan keterangan.
- **Per Poli.**
- **Jam Bentrok.**

Nomor surat, kartu, dan RM disimpan sebagai teks. Setiap ekspor dicatat di `audit_log` dengan aksi `audit-rme.surat-kontrol.ekspor`:
- memakai kode `SKT-YYMMDD-XXXXXX`, yang juga tercetak di berkas dan dikirim di header `X-Ekspor-Kode`;
- tanpa data pasien; kata kunci pencarian disamarkan;
- *fail-closed*: berkas tidak diserahkan bila jejak gagal dicatat.

## 5. Akses (RBAC)

Modul **`audit-rme.surat-kontrol`** dengan aksi `view` (lihat) dan `print` (ekspor). Modul ini terpisah dari `audit-rme` (least privilege), sehingga pemegang Audit Trail RME tidak otomatis bisa membukanya. Superadmin lolos otomatis. Peran lain perlu diberi izin lewat **Master › Peran & Hak Akses**.

## 6. Berkas

| Lapisan | Berkas |
|---|---|
| Konstanta & tipe (bersama klien) | `src/server/modules/surat-kontrol/surat-kontrol.constants.ts`, `surat-kontrol.types.ts` |
| Mesin audit (murni) | `surat-kontrol.audit.ts` (+ `.test.ts`) |
| Saringan, ringkasan, rentang (murni) | `surat-kontrol.filter.ts`, `surat-kontrol.schema.ts` (+ `.test.ts`) |
| Webservice BPJS | `surat-kontrol.bpjs.ts` |
| SIMGOS (SELECT saja) | `surat-kontrol.dal.ts` |
| Layanan & ekspor | `surat-kontrol.service.ts`, `surat-kontrol.ekspor.ts` |
| API | `src/app/api/audit-rme/surat-kontrol/route.ts`, `…/ekspor/route.ts` |
| Halaman & UI | `src/app/(dashboard)/audit-rme/surat-kontrol/page.tsx`, `src/features/surat-kontrol/*` |
| Bersama (diubah, kompatibel) | `src/server/lib/excel.ts`: `buildMultiSheetWorkbook` / `reportSheet`; `buildReportWorkbook` tetap |
| RBAC & menu | `src/server/rbac/modules.ts`, `src/components/layout/workspaces.ts` |

**Konfigurasi:** tidak ada variabel baru. Alamat webservice = `SIMGOS_REPORT_URL`, atau `http://<host DATABASE_URL_SIMGOS>/webservice` bila tidak diisi.

## 7. Kinerja

- Panggilan BPJS untuk satu bulan ±1,5–3 detik (2 potongan). Dari cache ±50 ms.
- Query SIMGOS memakai indeks:
  - `jadwal_kontrol.NOMOR_REFERENSI` dan `.TANGGAL`;
  - PK `rencana_kontrol` dan `kunjungan`;
  - `perencanaan_rawat_inap.NOMOR_REFERENSI` tanpa indeks, tetapi tabelnya ±3,7 ribu baris (5 ms).
- Daftar `IN (…)` dipotong per 500 dan dijalankan berurutan (maks. satu koneksi pool per langkah). Setiap query diberi `MAX_EXECUTION_TIME`.
- Master dokter dan pemetaan poli di-cache 10 menit. Resolver ruangan dan pengguna memakai cache Audit Trail RME (5 menit, tanpa kolom `PASSWORD`).

## 8. Validasi (12 Okt 2026, data nyata)

| Uji | Hasil |
|---|---|
| Unit | 30 uji (mesin audit, saringan, rentang, pemecah 30 hari, RBAC); seluruh suite 427 ✓ |
| E2E API (`sk-e2e.mjs`) | 35/35 |
| UI Chrome headless (`sk-ui.mjs`) | 19/19 |
| Regresi helper Excel bersama | ekspor Laporan Pendapatan ✓ |

Cakupan E2E API:
- temuan setiap baris = perhitungan ulang **SQL independen** untuk Okt 2026, Agu 2026, dan SPRI;
- kasus nyata jadwal 19 Agu vs BPJS 18 Agu → *Tanggal beda* +1;
- jam bentrok = `GROUP BY` independen (Okt: 29 slot / 113 jadwal; terpadat 12 pasien pukul 08.00 pada 13 Okt);
- validasi `422`;
- RBAC `403`/`401`/redirect `/403`;
- batas laju `429`;
- isi berkas Excel = layar;
- meta-audit tanpa PHI;
- DAL tanpa kata kunci tulis.

Cakupan UI: tabel lebar penuh, drawer perbandingan dan navigasinya, saringan temuan/tanggal/cari, tab jam bentrok, SPRI, ponsel 390 px tanpa luapan, tanpa galat JS.

## 9. Tahap berikutnya (belum dikerjakan)

- Perbaikan jam yang sama (pembagian jam per dokter). Perlu keputusan karena **menulis** ke SIMGOS, yang saat ini dilarang.
- Pemetaan dokter SIMRS ↔ kode DPJP BPJS: `bpjs.dpjp` kosong, sehingga dokter belum dibandingkan otomatis.

# Audit Surat Kontrol

Menu di workspace **Audit Trail RME** (`/audit-rme/surat-kontrol`) dengan dua tab:

- **Terbit saat pulang** (bawaan, sejak 24 Nov 2026) — apakah Surat Kontrol pasien BPJS terbit di BPJS **pada tanggal yang sama dengan tanggal pasien pulang** (rawat inap & rawat jalan). Pasien yang belum punya Surat Kontrol disorot. Lihat §10.
- **Jadwal BPJS ↔ SIMRS** (`?tampilan=bpjs`) — Surat Kontrol dan SPRI yang **terbit di BPJS** dibandingkan dengan **jadwal di SIMRS**: tanggal rencana yang tidak sama, jadwal yang hilang atau batal, poli yang berbeda, dan jam yang menumpuk (§1–§9).

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

## 10. Terbit saat pulang (24 Nov 2026)

**Aturan RS:** Surat Kontrol pasien BPJS harus terbit di BPJS pada **tanggal yang sama** dengan tanggal pasien pulang. Berlaku untuk rawat inap dan rawat jalan.

### Populasi

| Layanan | Episode | Tanggal pulang | Wajib Surat Kontrol |
|---|---|---|---|
| Rawat Inap | `layanan.pasien_pulang` aktif, kunjungan pulang di ruangan `JENIS_KUNJUNGAN = 3`, penjamin terbaru BPJS (`penjamin.JENIS = 2`) | `pasien_pulang.TANGGAL` | Cara keluar **1 Diizinkan pulang** (ref. 45). Pulang paksa, dirujuk, lari, pindah RS, meninggal, DOA = tidak wajib. |
| Rawat Jalan | Kunjungan poli `JENIS_KUNJUNGAN = 1` (leg utama, `REF IS NULL`), penjamin BPJS | `DATE(kunjungan.MASUK)` | Ya, kecuali **lanjut rawat inap** (SPRI dari kunjungan / leg RI di NOPEN sama), **kontrol pasca rawat inap** (lihat di bawah), atau **dirujuk** (`pendaftaran.rujukan_keluar` / `bpjs.rujukan`). |

**Kontrol pasca rawat inap.** Pasien pulang rawat inap diberi Surat Kontrol dari SEP rawat inapnya. Saat datang kontrol ke poli, SEP rawat jalannya memakai surat itu, dengan rujukan = SEP rawat inap. Dari kunjungan seperti ini **BPJS tidak menerbitkan Surat Kontrol baru**. Kontrol berikutnya memerlukan rujukan baru dari FKTP. Karena itu kunjungan ini berstatus **Tidak wajib kontrol** (alasan "Kontrol pasca rawat inap"), bukan Belum terbit.
- **Deteksi:** `pendaftaran.penjamin.NO_SURAT` (surat yang dipakai) dirunut ke SEP asal lewat `bpjs.rencana_kontrol.nomor`. Bila SEP itu milik episode dengan leg rawat inap, atau cache BPJS mencatat `jnsPelayanan = 'Rawat Inap'`, kunjungan dianggap kontrol pasca rawat inap.
- **Indeks:** jalur ini berindeks (± 10 ms). Penanda VClaim `bpjs.kunjungan.noRujukan` → SEP RI memberi hasil yang sama (Okt 37/37), tetapi memerlukan pindai penuh (± 500 ms).
- **Tanpa SEP:** jalur ini juga menangkap kunjungan yang SEP-nya tidak tercatat di `penjamin`.
- **Contoh:** NOPEN 2611200018, poli Interna. SEP V000262 memakai Surat Kontrol K000239 dari SEP rawat inap V000148 (NOPEN 2611120039).

Rawat jalan tidak punya catatan "rujuk balik ke FKTP" di SIMGOS (`bpjs.prb` kosong). Pasien rawat jalan biasa yang memang dikembalikan ke FKTP tetap tampil sebagai **Belum terbit**, dan petugas memutuskannya dari daftar.

### Tanggal terbit & penautan surat

- **Tanggal terbit = `tglTerbitKontrol` BPJS.** Sumbernya webservice BPJS (live) atau cache SIMGOS `bpjs.monitoring_rencana_kontrol` (hanya dibaca).
- ⚠️ **Bukan `jadwal_kontrol.DIBUAT_TANGGAL`.** Kolom itu `ON UPDATE CURRENT_TIMESTAMP`, sehingga ikut berubah setiap kali baris diperbarui (mis. saat surat dipakai). Okt 2026: 56 dari 173 jadwal punya `DIBUAT_TANGGAL` lebih lambat daripada tanggal terbit BPJS.
- **Surat ↔ episode ditautkan lewat:**
  - SEP asal = SEP episode (`pendaftaran.penjamin.NOMOR`);
  - jadwal SIMRS (`jadwal_kontrol.KUNJUNGAN` = kunjungan pulang);
  - catatan lokal (`bpjs.rencana_kontrol.nomor`).
- **Surat dianggap terhapus** hanya bila catatan lokalnya berstatus hapus.
- **Acuan penilaian** = surat aktif dengan tanggal terbit **paling awal**. Satu SEP bisa punya lebih dari satu surat (19 SEP sejak Agu 2026).
- **Webservice BPJS hanya dipanggil bila perlu:**
  - ada surat yang tanggal terbitnya belum ada di cache (jendela tanggal rencana surat-surat itu, maks. 60 hari);
  - pengguna menekan **Segarkan dari BPJS** (rencana `from` s.d. 60 hari).

  Pemanggilan memakai klien yang sama dengan tab BPJS ↔ SIMRS (cache 5 menit, maks. 2 panggilan bersamaan, segar ≥ 30 detik). Webservice menulis cache `bpjs.monitoring_rencana_kontrol`; perilaku ini sudah disetujui (§1). Cakupan cache sangat tinggi (Nov 2026: 168 dari 169 surat RI), jadi umumnya tidak ada panggilan sama sekali. Bila webservice gagal, data tetap dari cache dan layar menampilkan peringatan.

### Status

| Status | Dinilai | Aturan |
|---|---|---|
| Terbit di hari pulang | ✓ | tanggal terbit = tanggal pulang |
| Terbit sebelum pulang | ✓ | tanggal terbit < tanggal pulang |
| Terbit setelah pulang | ✓ | tanggal terbit > tanggal pulang |
| Belum terbit | ✓ | tanpa surat aktif, dan wajib kontrol. Disorot merah; ditandai bila sudah ada jadwal SIMRS tanpa nomor BPJS (belum di-bridging). |
| Tanggal terbit belum terbaca | — | surat aktif tanpa tanggal terbit dari BPJS/cache |
| Tidak wajib kontrol | — | tanpa surat dan tidak wajib (cara pulang / kontrol pasca rawat inap / dirujuk / lanjut RI). Bila punya surat, tanggalnya tetap dinilai. Ringkasan menyebut berapa yang merupakan kontrol pasca rawat inap. |

**Kepatuhan** = terbit di hari pulang ÷ (empat status yang dinilai).

### Tampilan

- **Saringan:**
  - tanggal pulang: Hari ini / Kemarin / 7 hari terakhir / Bulan ini (bawaan, s.d. hari ini) / Bulan lalu / Dari–Sampai, maks. 31 hari, tidak melewati hari ini;
  - cari: nama, RM, NOPEN, SEP, nomor surat, dokter, ruangan.
- **Ringkasan kepatuhan:**
  - persentase besar dan batang komposisi 100%;
  - empat tombol status (sekaligus saringan);
  - perbandingan Rawat Inap vs Rawat Jalan (klik = saring layanan).
- **Sorotan Belum terbit:** jumlah pasien, yang pulang hari ini (masih bisa tepat waktu), dan umur terlama. Tombol **Tampilkan pasien belum terbit** menyaring dan menggulir ke daftar.
- **Grafik:**
  - sebaran per tanggal pulang: batang bertumpuk, klik = saring tanggal;
  - per ruangan/poli: belum terbit terbanyak dulu, klik = saring.
- **Daftar pasien:**
  - `<table>` semantik (judul baris = pasien); di wadah < 48rem baris bertumpuk jadi kartu berlabel (container query);
  - baris belum terbit berlatar merah lembut;
  - kolom **Terbit vs pulang** berisi "jejak" hari −3…+3 (garis = hari pulang, titik = hari terbit, garis putus merah = belum terbit sampai hari ini) dan teks selisihnya;
  - ↑/↓ memindah baris, Enter membuka laci.
- **Laci rincian:**
  - urutan kejadian Pasien pulang → Surat Kontrol terbit → Rencana kontrol (poli, dokter, SEP kontrol, jadwal SIMRS);
  - semua surat episode;
  - saran tindak lanjut;
  - Sebelumnya/Berikutnya.
- **Tab halaman:** pilihan lewat aktivasi (panah memindah fokus, Enter/Spasi memilih) karena memilih tab mengubah URL dan memuat data. Panel tetap terpasang saat berpindah tab. Tab "Terbit saat pulang" menampilkan jumlah pasien belum terbit.

### Ekspor Excel

Tombol **Ekspor Excel** (izin `print`), `GET /api/audit-rme/surat-kontrol/pulang/ekspor`, dengan saringan sama dengan layar. Isinya 3 lembar:
- Terbit Saat Pulang;
- Ringkasan (per status & per layanan);
- Per Ruangan.

Meta-audit fail-closed tetap `audit-rme.surat-kontrol.ekspor`, dengan `metadata.tampilan = "terbit-saat-pulang"`; kata kunci cari disamarkan.

### Berkas

| Lapisan | Berkas |
|---|---|
| Konstanta & tipe | `surat-kontrol.pulang.constants.ts`, `surat-kontrol.pulang.types.ts` |
| Penilaian, saringan, ringkasan (murni, server & klien) | `surat-kontrol.pulang.ts` (+ `.test.ts`) |
| SIMGOS (SELECT saja) | `surat-kontrol.pulang.dal.ts` |
| Layanan | `surat-kontrol.pulang.service.ts` |
| Skema | `surat-kontrol.schema.ts` (`pulangQuerySchema`, `eksporPulangQuerySchema`, `tentukanRentangPulang`) |
| Ekspor | `surat-kontrol.ekspor.ts` (`buatEksporTerbitPulang`) |
| API | `src/app/api/audit-rme/surat-kontrol/pulang/route.ts`, `…/pulang/ekspor/route.ts` |
| UI | `src/features/surat-kontrol/SuratKontrolHalaman.tsx` (tab), `TerbitPulangView.tsx`, `TerbitPulangDetail.tsx`, `pulang.ui.tsx`; `SebaranHarianChart.tsx` kini menerima seri; tabel `AuditSuratKontrolView.tsx` kini bertumpuk di layar sempit |

### Validasi (24 Nov 2026, data nyata, dev :3000)

| Uji | Hasil |
|---|---|
| Unit | 23 uji baru (`surat-kontrol.pulang.test.ts`: aturan status, wajib/tidak wajib termasuk kontrol pasca RI, acuan surat terawal, saringan, ringkasan, rentang, skema); suite surat-kontrol 45 ✓ |
| API vs oracle SQL independen | Okt 2026: 268/268 episode (RI 165, RJ 103) status sama; Nov 2026 (s.d. 24): 279/279. Kontrol pasca RI aplikasi = oracle VClaim (`noRujukan` → SEP RI, + surat → SEP RI untuk kunjungan tanpa SEP): Okt 37/37. Kasus contoh NOPEN 2611200018 → Tidak wajib, surat K000239 dari SEP RI V000148 |
| Validasi & RBAC | 422 (rentang > 31 hari, tanggal tak sah, `segar` salah); 401 tanpa sesi; 403 modul lain; 403 ekspor tanpa `print`; halaman → `/403` |
| Ekspor | isi lembar = baris layar (44 belum terbit Okt); 3 lembar; meta-audit tercatat tanpa PHI, kata kunci disamarkan |
| UI Chrome headless | tab (aktivasi manual, garis bawah, `?tampilan=`), angka kepatuhan = API, sorotan & saringan belum terbit, layanan, ruangan, ↑/↓ + Enter → laci (urutan kejadian, Berikutnya, Escape), tab BPJS ↔ SIMRS (tabel semantik), 768/390/360 px (tabel bertumpuk, tanpa gulir-x, target sentuh ≥ 44 px), tanpa galat JS/CSP |

Setelah aturan kontrol pasca rawat inap:
- **Okt 2026:** kepatuhan 72,5% (137 dari 189 dinilai). 41 terbit **sebelum** pulang, 4 terbit setelah pulang, 7 belum terbit. Sebelum aturan ini: 60,6% dengan 44 belum terbit, karena 37 kunjungan pasca RI ikut terhitung.
- **Nov 2026 (s.d. 24):** kepatuhan 80,6% (162 dari 201). Belum terbit 6: 4 rawat inap, 2 rawat jalan. Kunjungan pasca RI ada 45.

Respons API ± 0,5 dtk dari cache. Bila perlu melengkapi dari BPJS, ± 2–6 dtk. Surat yang tanggalnya tetap tak ditemukan baru dicari ulang setelah 30 menit.

## 11. Kontrol = SEP (26 Nov 2026)

**Pertanyaan audit:** kapan surat yang **dipakai** sebuah SEP dientri di BPJS? Bila tanggal entri Surat Kontrol (`tglTerbitKontrol`) **sama** dengan tanggal SEP kunjungan kontrol, surat itu baru dibuat saat pasien datang kontrol. Contoh: pasien datang ke poli hari Kamis; rawat inap tidak menerbitkan Surat Kontrol saat pasien pulang; surat baru dibuat Kamis itu, bersamaan dengan SEP-nya. Tautan: `/audit-rme/surat-kontrol?tampilan=sep` (tab ketiga halaman Audit Surat Kontrol).

### Kode jenis surat BPJS (`jnsKontrol`)

| Kode | `namaJnsKontrol` | Dipakai oleh | Nomor asal |
|---|---|---|---|
| **2** | Surat Kontrol | SEP rawat jalan (kunjungan kontrol) | SEP kunjungan sebelumnya (`noSepAsalKontrol` / `rencana_kontrol.nomor`) |
| **1** | SPRI | SEP rawat inap | No. kartu (`rencana_kontrol.nomor`). ⚠️ Untuk SPRI, `noSepAsalKontrol` menunjuk SEP rawat inap **pemakainya**, bukan asal — tidak dipakai sebagai "SEP asal". |

Nomor surat kedua jenis berformat sama (19 karakter, huruf `K` di posisi 13); satu-satunya pembeda adalah `jnsKontrol`. Parameter `filter` pada webservice adalah jenis tanggal saringan VClaim: `2` = tanggal rencana (dipakai); `1` = tanggal entri **ditolak plugin SIMGOS (HTTP 500)**.

### Populasi = daftar VClaim

Satu baris = **satu surat** hasil webservice `plugins/bpjs/rencanaKontrol` (filter 2) untuk rentang **tanggal rencana** — sama dengan daftar Monitoring Rencana Kontrol VClaim (Nov 2026 s.d. 26: **451** surat = VClaim). Versi awal tab ini (SEP yang memakai surat menurut tanggal SEP) hanya 301, karena 150 Surat Kontrol yang **belum dipakai SEP** (`terbitSEP = Belum`) tidak ikut.

| Nov 2026 (rencana 1–26) | Jumlah |
|---|---|
| SPRI dipakai SEP | 231 |
| SPRI "sudah dipakai" menurut BPJS, SEP tak ada di SIMGOS | 1 |
| Surat Kontrol dipakai SEP | 69 |
| Surat Kontrol belum dipakai SEP | 150 |
| **Total** | **451** |

- **Sumber daftar:** webservice BPJS (live) lewat klien yang sama dengan tab BPJS ↔ SIMRS (cache 5 menit, maks. 2 panggilan bersamaan, segar ≥ 30 detik, **satu kali coba ulang** untuk 5xx/jaringan — plugin sesekali membalas 500 sesaat). Panggilan menulis cache `bpjs.monitoring_rencana_kontrol` — perilaku plugin yang sudah disetujui (§1). Bila webservice tetap gagal, daftar diambil dari cache itu menurut `tglRencanaKontrol` (hanya surat yang pernah diambil) dan layar menampilkan peringatan.
- **SEP pemakai:** `bpjs.kunjungan.noSuratSKDP IN (…)`, `batalSEP = 0`, **`FORCE INDEX (noSuratSKDP)`** (tanpa itu optimizer memindai penuh: ± 5 dtk → ± 0,5–1 dtk). Surat dipakai > 1 SEP → SEP pertama; jumlahnya ditampilkan.
- **Pasien:** dari SEP pemakai (`penjamin.NOMOR = noSEP`, JENIS 2, ID terbesar → `pendaftaran` → nama; ruangan = leg rawat inap atau `tujuan_pasien.RUANGAN`). Surat belum dipakai: lewat SEP asal (Surat Kontrol), selain itu nama dari BPJS.
- **SEP asal Surat Kontrol:** `bpjs.kunjungan` lewat PRIMARY `(noKartu, noSEP)` — jenis pelayanan asal dan `tglPlg` (tanggal pulang RI; sama dengan `pasien_pulang`, 93/93).
- **Catatan lokal** `bpjs.rencana_kontrol` (PRIMARY): penerbit (`user`) dan status hapus.

### Status

| Status | Aturan | Persentase |
|---|---|---|
| Terbit bersama SEP (**Surat = SEP**) | tanggal entri = tanggal SEP pemakai — temuan; Surat Kontrol disorot merah | dihitung |
| Terbit setelah SEP | tanggal entri > tanggal SEP (surat dientri belakangan) | dihitung |
| Terbit sebelum SEP | tanggal entri < tanggal SEP | dihitung |
| Tanggal entri belum terbaca | dipakai SEP tetapi tanggal entri tak ada | — |
| SEP tak tercatat di SIMGOS | BPJS `terbitSEP = Sudah`, tetapi SEP tak ada / batal di `bpjs.kunjungan` (mis. dibuat langsung di VClaim) | — |
| Belum dipakai SEP | tanpa SEP pemakai (pasien belum/tidak datang pada rencana) | — |

Persentase = surat = SEP ÷ surat yang sudah dipakai SEP dengan tanggal entri terbaca. Surat Kontrol = SEP dipecah menurut asal: **rawat inap** (tidak terbit saat pasien pulang) dan **rawat jalan**.

### Tampilan

- **Jenis surat** (kontrol segmen): **Surat Kontrol** (bawaan, kode 2) / **Kontrol + SPRI** (= jumlah VClaim) / **SPRI saja** (kode 1) / **Summary** (lihat di bawah).
- **Saringan:** tanggal rencana (preset sama dengan §10, maks. 31 hari, tak melewati hari ini); cari nama, RM, NOPEN, no. kartu, SEP, SEP asal, nomor surat, dokter, ruangan, penerbit surat, pembuat SEP.
- **Ringkasan:** angka surat = SEP, jumlah surat di VClaim · dipakai SEP · **belum dipakai SEP** (klik = saring), batang komposisi, tiga tombol status; "SEP tak tercatat" & "belum terbaca" sebagai tautan saring; pada "Kontrol + SPRI" baris per jenis (klik = tampilkan satu jenis).
- **Sorotan:** "Kontrol = SEP" (asal RI/RJ, tombol tampilkan); pada "SPRI saja" berganti "SPRI = SEP" (+ SPRI dientri setelah SEP).
- **Grafik** sebaran per tanggal rencana (sebelum / setelah / bersama SEP / belum dipakai; klik = saring tanggal) & **per ruangan/poli** (surat belum dipakai → poli tujuan surat).
- **Daftar:** tabel semantik bertumpuk < 48rem; kolom SEP pemakai (atau "Belum dipakai"), Surat (jenis, tanggal entri, rencana), Entri vs SEP (jejak −3…+3), Asal surat, Status; ↑/↓ + Enter.
- **Laci rincian:** Kunjungan asal / Pasien pulang RI → Surat dientri (penerbit SIMGOS, rencana, poli, dokter, sumber tanggal) → SEP dibuat, atau **Rencana kontrol** bila belum dipakai; saran tindak lanjut (mis. rencana sudah lewat N hari).

### Summary (rekap format audit BPJS)

Pilihan **Summary** menggabungkan Surat Kontrol & SPRI tanpa saringan layar (kolom cari disembunyikan):

- **Angka utama:** surat di BPJS (VClaim, per jenis) · **Surat Kontrol dipakai SEP** ("63 dari 203", % dipakai, belum dipakai klik = daftar; SPRI cukup di rincian "225 dari 226 dipakai" karena SPRI dibuat bersama SEP rawat inap) · **Dibuat setelah selesai pelayanan** (% audit BPJS, per jenis) · **Surat = SEP** (per jenis, + > SEP).
- **Rekap format audit BPJS** — tabel seperti tarikan audit BPJS: baris Surat Kontrol / SPRI / Total; kolom **Surkon < SEP**, **= SEP**, **> SEP**, **Grand total**, dan **% dibuat setelah selesai pelayanan** (= Surkon < SEP ÷ Grand total, 2 desimal; batang hijau ≥ 80%, kuning ≥ 50%, merah < 50%, angka selalu tampil). Angka diklik → daftar jenis & status itu.
- **Pemakaian surat (VClaim):** batang 100% per jenis — sebelum / setelah / bersama SEP, belum terbaca, SEP tak tercatat, belum dipakai (legenda berangka, klik = daftar).
- **Sebaran per tanggal SEP:** batang bertumpuk Surkon < / > / = SEP.
- **Rekap per ruangan/poli SEP:** Surat Kontrol (< = >) dan SPRI (< = >), total, % — tabel bergulir dengan judul baris lengket.

**Basis tanggal berbeda, sengaja:** angka VClaim & pemakaian surat memakai **tanggal rencana** (= daftar VClaim); rekap audit, grafik harian & per ruangan memakai **SEP tidak batal bertanggal SEP di rentang** (= tarikan audit BPJS). Server mengirim `rekap` (satu baris per SEP: tanggal SEP, jenis, status, layanan, ruangan — tanpa data pasien); SEP yang suratnya bertanggal rencana di luar rentang dilengkapi lewat `querySepRentang` (FORCE INDEX tglSEP) + cache per nomor.

**Rekonsiliasi dengan tabel audit BPJS (1–25 Nov 2026, RSUD Bolaang Mongondow Timur):** BPJS 132 / 420 / 26 = 578 (22,84%); SIMGOS 66 / 210 / 13 = **289** (22,84%) — setiap angka BPJS tepat 2× (semua angka di tabel BPJS genap untuk semua faskes → kemungkinan duplikasi pada tarikan BPJS; persentase tidak terpengaruh). Per jenis: Surat Kontrol 63 / 0 / 0 (**100%**), SPRI 3 / 210 / 13 (1,33%) — skor rendah berasal dari SPRI. Daftar VClaim 1–25 Nov = **430** surat (288 dipakai SEP, 141 belum dipakai, 1 SEP tak tercatat) — angka berbeda karena VClaim menghitung surat terbit, audit BPJS menghitung SEP yang memakai surat.

### Ekspor Excel

`GET /api/audit-rme/surat-kontrol/sep/ekspor?from&to&spri=1&jenis=1|2&status&ruangan&tanggal&q` (izin `print`), isi = layar, satu baris per surat: lembar **Kontrol = SEP** (termasuk "Dipakai SEP (BPJS)", SEP pemakai, no. kartu), **Ringkasan** (total VClaim, dipakai, per status, per jenis, asal RI/RJ), **Per Ruangan**, **Rekap Audit BPJS** (Surkon < / = / > SEP, Grand Total, % per jenis + total; basis tanggal SEP, tanpa saringan layar) dan **Rekap per Ruangan**. Summary mengekspor `spri=1` tanpa saringan. Tanpa `spri=1` hanya Surat Kontrol (`jenis=1` tanpa `spri=1` = kosong). Meta-audit fail-closed `audit-rme.surat-kontrol.ekspor`, `metadata.tampilan = "kontrol-sama-sep"`, kata kunci disamarkan.

### Berkas

| Lapisan | Berkas |
|---|---|
| Konstanta & tipe | `surat-kontrol.sep.constants.ts`, `surat-kontrol.sep.types.ts` |
| Penilaian, saringan, ringkasan (murni) | `surat-kontrol.sep.ts` (+ `.test.ts`) |
| SIMGOS (SELECT saja) | `surat-kontrol.sep.dal.ts` |
| Layanan | `surat-kontrol.sep.service.ts` (memakai `muatPoli` dari `surat-kontrol.pulang.service.ts`) |
| Webservice | `surat-kontrol.bpjs.ts` (bersama; + satu kali coba ulang 5xx/jaringan) |
| Skema | `surat-kontrol.schema.ts` (`sepQuerySchema`, `eksporSepQuerySchema`) |
| Ekspor | `surat-kontrol.ekspor.ts` (`buatEksporKontrolSep`) |
| API | `src/app/api/audit-rme/surat-kontrol/sep/route.ts`, `…/sep/ekspor/route.ts` |
| UI | `KontrolSepView.tsx`, `KontrolSepSummary.tsx` (Summary), `KontrolSepDetail.tsx`, `sep.ui.tsx`, `rentang.ts` (preset & penjepit rentang bersama `TerbitPulangView`); tab ketiga di `SuratKontrolHalaman.tsx`; `page.tsx` menerima `?tampilan=sep` |

### Validasi (26 Nov 2026, data nyata, dev :3000)

| Uji | Hasil |
|---|---|
| Unit | `surat-kontrol.sep.test.ts` (status termasuk belum dipakai & SEP tak tercatat, saringan jenis/SPRI tak bocor, tanggal rencana, urutan, ringkasan, per hari, per ruangan, rekap audit BPJS, skema); seluruh suite 843 ✓ |
| API vs webservice + oracle SQL independen | Okt 2026: **371/371** surat = webservice (nomor identik), status & jenis sama; Nov 2026 (s.d. 26): **451/451** (= VClaim). Belum dipakai Okt 136 = `terbitSEP Belum` 136 |
| Validasi & RBAC | 422 (rentang > 31 hari, tanggal tak sah, `segar`/`spri`/`jenis`/`status` salah); 401 tanpa sesi; 403 modul lain; 403 ekspor tanpa `print`; halaman → `/403` |
| Rekap audit BPJS (Summary) | 1–25 Nov: API `rekap` 289 SEP = 66 / 210 / 13 (Kontrol 63/0/0, SPRI 3/210/13) = tabel BPJS ÷ 2; lembar Excel "Rekap Audit BPJS" Total 66/210/13/289/22,84; daftar VClaim 430 = VClaim; uji unit rekap (persen 2 desimal, belum terbaca di luar total, per hari, per ruangan) |
| Ekspor | Kontrol = SEP Okt 3; belum dipakai Okt 133; `spri=1` 159; SPRI saja 173; `jenis=1` tanpa `spri` 0; 3 lembar; meta-audit tanpa PHI |
| UI | belum diuji otomatis (dev Turbopack basi: `ChunkLoadError` HMR); diuji manual oleh user |

Hasil:
- **Okt 2026 (rencana):** 371 surat. Surat Kontrol 198: **3 = SEP** (2 asal rawat inap, 1 asal rawat jalan), 62 sebelum SEP, 133 belum dipakai. SPRI 173: 156 = SEP, 12 dientri setelah SEP, 2 sebelum, 3 belum dipakai.
- **Nov 2026 (rencana 1–26):** 451 surat. Surat Kontrol 219: **0 = SEP**, 69 sebelum SEP, 150 belum dipakai. SPRI 232: 215 = SEP, 13 setelah SEP, 3 sebelum, 1 SEP tak tercatat di SIMGOS.

Kinerja: webservice ± 1,3 dtk (26 hari); kueri SIMGOS bila diukur langsung ± 1,5–2,5 dtk total. Di dev server (sedang basi) API 5–9 dtk; belum diukur di build produksi.

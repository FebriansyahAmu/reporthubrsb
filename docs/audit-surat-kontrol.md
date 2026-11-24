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

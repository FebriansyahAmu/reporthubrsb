# Laporan Klasifikasi Kunjungan per Domisili

Pusat Laporan › Kunjungan & Pelayanan › **Klasifikasi Kunjungan per Domisili** (`/laporan/domisili`). Dibuat 21 Okt 2026.

Laporan ini menghitung kunjungan IGD, rawat jalan, dan rawat inap sekaligus, lalu memilahnya menurut domisili pasien: **dalam** atau **luar** Kabupaten Bolaang Mongondow Timur. Ada rincian per kecamatan (dalam kabupaten) dan per kabupaten/kota asal (luar kabupaten). Setiap angka tersedia dalam dua satuan, kunjungan dan pasien unik. Hasilnya bisa diekspor ke Excel.

## Definisi

| Istilah | Arti |
| --- | --- |
| Kunjungan | Satu pendaftaran (NOPEN) per jenis layanan, menurut tanggal masuk kunjungan utama. Definisinya sama dengan Laporan Pengunjung dan Dasbor, sehingga total per layanan identik dengan Laporan Pengunjung. |
| Jenis layanan | `master.ruangan.JENIS_KUNJUNGAN` ruangan tujuan pendaftaran: 1 Rawat Jalan, 2 IGD, 3 Rawat Inap. |
| Pasien | No. RM (NORM) unik. Kolom **Semua** menghitung tiap pasien sekali walau ia berkunjung ke beberapa layanan, jadi angkanya bukan penjumlahan kolom per layanan. |
| Domisili | Alamat pasien **saat ini** di `master.pasien.WILAYAH` (kode desa Kemendagri 10 digit). Kabupaten = 4 digit pertama, kecamatan = 6 digit pertama, seperti fungsi SIMGOS `master.getAlamatPasien`. |
| Dalam kabupaten | Kode diawali `7110` (Bolaang Mongondow Timur). Kode kecamatan yang tak dikenal, atau kode yang hanya sampai kabupaten, masuk baris "Kecamatan tidak tercatat". |
| Luar kabupaten | 4 digit pertama adalah kabupaten/kota lain yang ada di `master.wilayah`. Digit ke-3–4 ≥ 71 berarti kota, sehingga "Kab. Gorontalo" (7501) dan "Kota Gorontalo" (7571) tetap terbedakan. |
| Domisili tidak tercatat | Wilayah kosong, atau kodenya tidak cocok dengan kabupaten mana pun. |

**Catatan pembacaan:**
- Pasien IGD yang lanjut rawat inap mendapat pendaftaran baru di SIMGOS, sehingga terhitung di IGD **dan** Rawat Inap.
- Pendaftaran atau kunjungan yang dibatalkan tidak dihitung.
- Domisili memakai alamat terkini. Pasien yang pindah alamat setelah berkunjung akan ikut wilayah barunya.

## Desain query (SIMGOS hanya dibaca)

Satu query per periode, tanpa prosedur baru dan tanpa perubahan tabel:

1. **Daftar episode:**
   - sumber: `pendaftaran.kunjungan FORCE INDEX (MASUK)` → `pendaftaran` → `tujuan_pasien` → `master.ruangan` → `master.pasien`;
   - hasil: satu baris per (NOPEN, jenis layanan) dengan kode kecamatan domisili.
2. **Agregasi:** `GROUP BY kecamatan, jenis WITH ROLLUP`, berisi `COUNT(*)` kunjungan dan `COUNT(DISTINCT NORM)` pasien. Subtotal ROLLUP memberi angka pasien unik "semua layanan" yang tepat.
3. **Nama wilayah:** nama kabupaten, kecamatan, dan provinsi di-join **setelah** agregasi, melalui primary key, atas beberapa puluh baris saja.
4. **Klasifikasi:** pengelompokan dalam / luar / tidak tercatat dikerjakan di modul murni `domisili.olah.ts`, yang diuji unit. Penjumlahan pasien antar-wilayah aman karena satu pasien hanya punya satu `WILAYAH`.

**Pengaman beban:**
- hanya tanggal yang di-bind (`?`);
- rentang maksimal 366 hari;
- `MAX_EXECUTION_TIME(15000)`;
- cache 60 detik dengan single-flight, dipakai bersama oleh tampilan dan ekspor;
- daftar kecamatan di-cache 10 menit.

**Mengapa `FORCE INDEX (MASUK)`:**
- tanpa itu, optimizer memindai indeks `REF` (semua kunjungan utama sepanjang masa), sehingga biayanya ikut tumbuh bersama tabel;
- dengan `MASUK`, biayanya sebanding panjang periode.

Waktu terukur di DB nyata:

| Periode | Dengan `FORCE INDEX (MASUK)` | Tanpa |
| --- | --- | --- |
| 1 bulan | ±10 ms | ±20 ms |
| 1 tahun | ±70 ms | ±45 ms (memindai indeks `REF`) |

**⚠️ Gotcha MySQL:** nama di `GROUP BY` diikat ke **kolom tabel lebih dulu**, baru ke alias. Contohnya, `GROUP BY jenis` terbaca `master.ruangan.JENIS`. Karena itu query memakai kolom eksplisit.

## Kode

- `src/server/modules/domisili/`:
  - `domisili.constants.ts` — kode kabupaten 7110, batas hari, daftar layanan;
  - `domisili.schema.ts`;
  - `domisili.dal.ts`;
  - `domisili.olah.ts`;
  - `domisili.service.ts`;
  - `domisili.excel.ts` — 3 lembar: Ringkasan, Dalam Kabupaten, Luar Kabupaten;
  - `domisili.test.ts`.
- **API** (izin `laporan:view`):
  - `GET /api/laporan/domisili?from&to`;
  - `GET /api/laporan/domisili/export?from&to`.
- **Antarmuka:**
  - `src/app/(dashboard)/laporan/domisili/page.tsx`;
  - `src/features/laporan-domisili/DomisiliView.tsx`.
  - Pemilih periode memakai ulang milik RL 3.2 (bulan / triwulan / rentang), lewat prop `idAwalan`.

## Validasi

- **Unit:** 10 uji — klasifikasi, kecamatan nol & tidak tercatat, kota vs kabupaten, pasien unik, validasi periode.
- **E2E** (`scratchpad/domisili-e2e.mjs`):
  - RBAC: 401 / 403 / halaman;
  - validasi 422, termasuk injeksi dan rentang lebih dari 366 hari;
  - angka dibandingkan dengan **oracle SQL independen** (join gaya SP + `COUNT(DISTINCT)` + `CASE`, tanpa ROLLUP dan tanpa `FORCE INDEX`) untuk bulan, triwulan, dan setahun: setiap sel kelas × layanan, per kecamatan, per kabupaten/kota;
  - total per layanan sama dengan Laporan Pengunjung;
  - cache;
  - isi Excel.
- **UI** (`scratchpad/domisili-ui.mjs`):
  - angka di layar sama dengan API;
  - toggle Kunjungan/Pasien dan tab tanpa permintaan ulang ke server;
  - ganti periode memicu permintaan baru;
  - unduh Excel;
  - ponsel 390 px tanpa luapan, dengan kolom wilayah lengket;
  - tanpa galat JS.

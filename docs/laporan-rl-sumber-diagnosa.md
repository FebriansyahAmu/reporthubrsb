# RL 4.1 & RL 5.1 — sumber diagnosa dan kasus baru (perbaikan 12 Nov 2026)

Berlaku untuk **RL 4.1** (Morbiditas & Mortalitas Rawat Inap) dan **RL 5.1**
(Morbiditas Rawat Jalan) di Pusat Laporan. Perubahan hanya pada query aplikasi;
database dan procedure SIMGOS tidak diubah (hanya dibaca).

## Masalah

1. **Kolom umur & "Kasus Baru" RL 5.1 bernilai 0 untuk periode sejak Juni 2026.**
   RL 5.1 hanya mengisi kolom umur untuk kasus baru. Penanda kasus baru diambil
   dari kolom `medicalrecord.diagnosa.BARU`, yang diisi trigger SIMGOS
   `onBeforeInsertDiagnosa`. Trigger itu juga memeriksa baris diagnosa lain pada
   kunjungan yang **sama**, sehingga `BARU = 1` jatuh ke baris yang tersimpan
   lebih dulu. Sejak **10 Mei 2026** diagnosa grouper INA-CBG tersimpan lebih
   dulu daripada diagnosa klinis, sehingga baris klinis selalu `BARU = 0`.
   SP SIMGOS `LaporanRL51Revisi` memakai aturan yang sama dan juga akan
   menghasilkan 0.
2. **RL 4.1 & RL 5.1 kurang hitung sejak Mei 2026.** Kedua laporan, seperti SP
   aslinya, hanya membaca diagnosa klinis (`INA_GROUPER = 0`). Sejak Mei,
   banyak kunjungan hanya punya diagnosa grouper (`INA_GROUPER = 1`).
   Contoh Oktober 2026: 222 dari 279 kunjungan RJ/IGD berdiagnosa tidak punya
   baris klinis.

## Aturan baru

- **Sumber diagnosa, per kunjungan (NOPEN):** diagnosa klinis bila kunjungan
  punya minimal satu; bila tidak, diagnosa grouper INA-CBG. Kunjungan yang punya
  keduanya hampir selalu berkode sama (1018 dari 1028 sejak Juni), jadi tidak
  ada kasus yang terhitung ganda. Kode: `src/server/lib/diagnosa-sumber.ts`.
- **Kasus baru (RL 5.1):** kode ICD-10 belum pernah tercatat pada pendaftaran
  pasien yang **lebih awal** (diagnosa aktif, klinis maupun grouper). Ini sama
  dengan maksud trigger SIMGOS, tetapi tidak bergantung pada urutan simpan.
  Riwayat diagnosa SIMGOS tersedia sejak September 2023. Kode:
  `BARU_RIWAYAT` di `src/server/modules/rl51/rl51.dal.ts`.
- Halaman, Excel, dan PDF kini mencantumkan aturan ini beserta berapa kasus
  yang memakai diagnosa grouper pada periode tersebut.

## Dampak angka

| Periode | RL 5.1 sebelum | RL 5.1 sesudah | RL 4.1 sebelum | RL 4.1 sesudah |
|---|---|---|---|---|
| Jan–Apr 2026 | 1.282 kunjungan / 1.135 baru | 1.283 / 1.134 | 1.074 kasus | 1.074 |
| Mei 2026 | 293 / 107 | 400 / 367 | 276 | 346 |
| Okt 2026 | 107 / 0 | 496 / 447 | 207 | 354 |
| 1 Jan–12 Nov 2026 | 2.240 / 1.242 | 4.246 / 3.780 | 2.771 | 3.329 |

Periode Januari–April praktis tidak berubah, karena saat itu setiap kunjungan
punya diagnosa klinis dan penanda `BARU` masih benar. **Laporan RL 4.1 atau
RL 5.1 periode Mei 2026 ke atas yang sudah dikirim memakai angka lama yang kurang
hitung**; perlu diputuskan oleh unit RM apakah dikirim ulang.

## Opsi Export Excel: hanya kelompok umur terisi

Di halaman RL 4.1 dan RL 5.1, di samping tombol Export, ada sakelar
**"Excel: hanya umur terisi (n/25)"**. Angka n adalah jumlah kelompok umur yang
punya data pada periode dan filter yang sedang dipilih.

- **Mati (bawaan):** Excel memuat ke-25 kelompok umur, termasuk yang bernilai 0,
  sesuai format resmi SIRS.
- **Aktif:** Excel hanya memuat kelompok umur yang jumlah L+P-nya lebih dari 0
  di seluruh laporan. Kelompok disembunyikan utuh (kolom L dan P sekaligus),
  urutannya tetap, dan blok kolom sesudahnya bergeser. Baris keterangan Excel
  menyebut "(n dari 25 kelompok ditampilkan)", dan nama berkas diberi akhiran
  `_umur-terisi`.
- Untuk RL 5.1, kolom umur berisi kasus baru, sehingga "terisi" berarti ada
  kasus baru pada kelompok itu.
- PDF tidak terpengaruh opsi ini.
- API: `GET /api/laporan/{rl41|rl51}/export?…&umur=terisi` (nilai sah:
  `semua`, `terisi`; selain itu 422). Kode: `src/server/lib/rl-kelompok-umur.ts`.

## Temuan GAP

| Laporan | Kode | Kondisi sekarang | Dampak | Tindak lanjut |
|---|---|---|---|---|
| 10 Besar Penyakit | `src/server/modules/penyakit/penyakit.dal.ts` | Hanya membaca diagnosa klinis (`INA_GROUPER = 0`) | Kunjungan yang hanya punya diagnosa grouper (mayoritas sejak Mei 2026) tidak terhitung, sehingga peringkat dan jumlah kasus bisa kurang | Bisa memakai aturan yang sama (`diagnosaSumberSql`) bila diminta |
| RL 3.5 Kunjungan | `src/server/modules/rl35/rl35.dal.ts` | Pemindahan kunjungan ke baris khusus berdasarkan diagnosa hanya memeriksa diagnosa klinis | Kunjungan yang diagnosanya hanya di grouper tidak dipindahkan ke baris khususnya | Bisa memakai aturan yang sama (`diagnosaSumberSql`) bila diminta |

Keduanya belum diubah; menunggu keputusan.

## Verifikasi

Uji E2E membandingkan setiap sel (total, L/P, kasus baru, kematian, porsi
grouper, 50 sel umur) dengan perhitungan pembanding yang ditulis terpisah, untuk
5 periode, termasuk filter menular, ekspor Excel/PDF, dan otorisasi. Waktu
respons: ±0,1–0,5 dtk per bulan hingga satu tahun, ±0,6 dtk untuk Jan 2024–Nov 2026.

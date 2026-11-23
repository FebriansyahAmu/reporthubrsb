# PRD — Checklist Pemeliharaan v2 (Inventarisasi Barang)

| | |
|---|---|
| Versi | 1.0 — 17 Nov 2026 |
| Branch | `feat/inventaris-checklist` |
| Halaman | `/inventaris/pemeliharaan` (Checklist & Riwayat), `/inventaris/pengaturan` (tab Ruangan) |
| Data | reporthub (baca-tulis). SIMGOS tidak dipakai. |
| Rilis | setelah merge ke `main` → tag MINOR berikutnya (`v2.4.0`) |

## 1. Tujuan

1. **Ruangan langsung terpilih** untuk petugas yang login, dari pemetaan di Pengaturan › Ruangan.
   Pilihan ruangan tetap dropdown, tetapi **bisa diketik dengan saran otomatis** (64 ruangan).
2. **Warna kartu checklist mengikuti kondisi hasil periksa**: Baik hijau, Rusak Ringan kuning,
   Rusak Berat merah, Hilang biru (bukan selalu hijau).
3. **Checklist bisa diisi susulan (backdate)**, ditandai jelas sebagai backdate, dengan
   **riwayat perubahan** rinci (siapa, kapan, apa yang berubah, alasan).
4. **Tampilan compact & elegan** (gaya shadcn) — mulai dari halaman Checklist, lalu
   halaman lain modul Inventarisasi secara bertahap.

## 2. Keputusan (17 Nov 2026)

| # | Topik | Keputusan |
|---|---|---|
| D1 | Pemetaan akun ↔ ruangan | **Petugas per ruangan + NIP PJ.** Tabel baru `inv_ruangan_petugas` (disetujui). Akun yang NIP-nya sama dengan NIP PJ ruangan juga dianggap petugas ruangan itu. |
| D2 | Batas backdate | **Harian maks 30 hari ke belakang; Mingguan & Bulanan maks 3 periode sebelumnya.** Tidak boleh ke depan. **Alasan wajib** (sekali per sesi backdate). Semua akun yang boleh mencentang boleh backdate. |
| D3 | Kondisi di Master Barang dari backdate | Diperbarui **hanya bila tidak ada pemeriksaan barang itu yang lebih baru**. |
| D4 | Cakupan desain | **Checklist dulu**, halaman lain menyusul satu per satu. |

## 3. Kondisi sekarang (temuan)

- Akun belum punya tautan ke ruangan; Pengaturan › Ruangan hanya menyimpan nama & NIP PJ.
  Data: 64 ruangan aktif, 53 ber-NIP PJ (29 NIP berbeda; satu PJ sampai 12 ruangan);
  10 akun, 4 cocok NIP PJ → 9 ruangan.
- Pemilih ruangan = `Select` biasa berisi 64 ruangan, selalu memilih ruangan pertama.
- Kartu yang sudah dicentang selalu hijau. Warna per kondisi sebenarnya sudah ada di
  Pengaturan › Kondisi (`tone`): Baik `success`, Rusak Ringan `warning`, Rusak Berat
  `danger`, Hilang `brand`, Tidak Diketahui `neutral`.
- Hanya periode berjalan yang bisa diisi.
- **Tidak ada catatan perubahan.** Batal centang menghapus baris; "Batalkan selesai"
  menghapus semua hasil periksa periode itu; edit menimpa `checked_by/at`.
- Simpan tidak dalam transaksi; dua petugas bersamaan bisa memicu galat unik (`ensureRun`).
- Setiap centang berkondisi langsung menimpa kondisi di Master Barang.

## 4. Rancangan

### 4.1 Petugas ruangan (D1)

**Tabel baru `inv_ruangan_petugas`** (reporthub; migrasi idempoten
`scripts/db/migrate-inventaris-petugas.mjs`, masuk runner `migrate-inventaris-all.mjs`):

| Kolom | Tipe | Catatan |
|---|---|---|
| `ruangan_id` | VARCHAR(30) `utf8mb4_0900_ai_ci` | PK bersama, FK `inv_ruangan` ON DELETE CASCADE |
| `user_id` | VARCHAR(30) `utf8mb4_unicode_ci` | PK bersama, FK `users` ON DELETE CASCADE, indeks |
| `dibuat_oleh` | VARCHAR(191) NULL | nama akun yang menambahkan |
| `created_at` | DATETIME(3) | |

Kolasi tiap kolom kunci disamakan dengan kolom yang dirujuk (`inv_ruangan.id` dan
`users.id` berbeda kolasi); tanpa itu FK gagal dibuat.

**Pengaturan › Ruangan:** kolom baru **Petugas** (cip nama, "+n" bila banyak) dan aksi
"Atur petugas" → modal pemilih akun (cari nama/username, pilih banyak). Hak:
`inventaris.pengaturan` *update*.

**API baru**
- `GET /api/inventaris/pengaturan/ruangan/[id]/petugas` — daftar petugas + akun PJ yang
  otomatis termasuk (view).
- `PUT /api/inventaris/pengaturan/ruangan/[id]/petugas` — `{ userIds: string[] }` maks 50,
  akun **baru** harus ada & aktif (akun lama yang kini nonaktif boleh dipertahankan); ganti
  seluruh daftar dalam satu transaksi dengan audit `inventaris.ruangan.petugas` di transaksi
  yang sama (tanpa perubahan → tanpa tulis); body ≤ 8 KB (413); permintaan lintas situs
  ditolak 403 (`inventaris.jaga.ts`, sama dengan modul RL 3.2 / Form RM).
- `GET /api/inventaris/pengaturan/ruangan` (sudah ada) kini memuat `petugas: {id, nama, aktif}[]`.
- `GET /api/inventaris/pengaturan/pengguna?q=` — cari akun aktif (id, nama, username,
  NIP tersamar); maks 20 hasil; hanya untuk pemegang hak pengaturan *update*.

**Ruangan saya** = ruangan aktif yang (a) memetakan akun ini sebagai petugas, atau
(b) NIP PJ-nya sama dengan NIP akun (dinormalkan: tanpa spasi). Dihitung server, dikirim
lewat `GET /api/inventaris/pemeliharaan/checklist/refs` (`ruanganSaya: string[]`).

**Pilihan ruangan awal** (urutan): `?ruangan=` di URL (ID atau kode prefix) → ruangan
terakhir dipakai **oleh akun ini** di peramban ini — hanya bila termasuk "Ruangan saya",
atau akun belum dipetakan sama sekali (mis. admin) → ruangan saya pertama → kosong
("Pilih ruangan"; tidak lagi otomatis ruangan pertama). Hanya ruangan aktif.
Ruangan terpilih ditulis ke URL (`replaceState`) agar bisa dibagikan/dimuat ulang.
Ingatan "terakhir dipakai" disimpan per akun (`localStorage` berkunci ID akun) karena
PC bangsal kerap dipakai bergantian; boleh hilang, tidak pernah dibaca server.

**Combobox ruangan** (komponen umum baru `components/ui/Combobox.tsx`, pola ARIA
combobox + listbox): ketik untuk menyaring prefix/nama (tanpa beda huruf besar/kecil),
kelompok **Ruangan saya** di atas lalu **Semua ruangan**, sorot teks yang cocok,
↑/↓/Enter/Esc, tombol hapus pilihan, popover di portal (tidak terpotong `overflow`).

### 4.1b Ruangan tugas dari sisi akun — Master › Pengguna (23 Nov 2026)

Pemetaan yang sama (`inv_ruangan_petugas`, tanpa tabel baru) kini juga bisa diatur dari
**form Tambah/Edit Akun** — bagian *Checklist Pemeliharaan › Ruangan tugas*:
combobox yang bisa diketik (kode/nama) untuk menambah, cip dengan tombol ×
untuk melepas, info ruangan yang otomatis termasuk karena NIP PJ. Tabel pengguna
mendapat kolom **Ruangan tugas** (maks 2 kode + "+n"; ikon centang = otomatis dari NIP PJ).
Kedua layar (Pengaturan › Ruangan › Petugas dan Master › Pengguna) selalu sinkron.

**API baru** (hak `master.pengguna`)
- `GET /api/master/pengguna/opsi-ruangan` — ruangan aktif `{id, kodePrefix, nama, aktif}` (view; tanpa PJ/NIP).
- `GET /api/master/pengguna/[id]/ruangan` — `{akun, ruangan, otomatisPj}` (view).
- `PUT /api/master/pengguna/[id]/ruangan` — `{ ruanganIds: string[] }` maks 100 (update);
  ruangan BARU harus ada & aktif, ruangan lama yang kini nonaktif boleh dipertahankan; ganti
  seluruh daftar dalam satu transaksi + audit `inventaris.pengguna.ruangan` (target = akun)
  di transaksi yang sama; tanpa perubahan → tanpa tulis; body ≤ 8 KB (413); lintas situs 403.
- `GET /api/master/pengguna` kini memuat `ruangan: {kodePrefix, nama, otomatis}[]` (ruangan
  aktif); gagal baca tabel Inventaris → kolom kosong, daftar akun tetap terbuka.

Form akun menyimpan data akun dulu, lalu ruangan (hanya bila berubah). Gagal menyimpan
ruangan saat **Edit** → modal tetap terbuka dengan pesan "Perubahan akun tersimpan, tetapi
ruangan tugas gagal disimpan"; saat **Tambah** → akun tetap dibuat + peringatan untuk
mengatur lewat Edit (form "Buat" tidak diulang agar username tak bentrok).

### 4.2 Warna kartu menurut kondisi

- Warna diambil dari `tone` kondisi di Pengaturan (bukan dari nama), sehingga tetap benar
  bila nama kondisi diubah.
- Belum diperiksa: kartu netral. Diperiksa tanpa kondisi: netral + tanda "Diperiksa".
  Diperiksa dengan kondisi: garis tepi kiri + latar lembut + lencana sesuai tone.
- Identitas tidak bergantung warna saja: nama kondisi selalu tertulis.
- Bilah kemajuan menjadi **bilah komposisi** (Baik/RR/RB/Hilang/belum) dengan legenda.

### 4.3 Checklist susulan / backdate (D2, D3)

**Pemilih periode** di kepala checklist: Harian → pemilih tanggal (hari ini s.d. 30 hari
ke belakang); Mingguan/Bulanan → daftar periode berjalan + 3 sebelumnya. Banner
"Terlewat" mendapat tombol **Isi susulan** yang langsung membuka periode itu.

**Masuk periode lampau** → banner tetap "Mode susulan · {periode}" dan dialog
**alasan wajib** (10–300 karakter, contoh: "Pemeriksaan dilakukan, input terlambat karena
jaringan putus"). Alasan disimpan di state halaman untuk periode itu dan ikut setiap
permintaan simpan.

**Server** (`periksa` & `complete`): parameter baru `periodeKey` (opsional; kosong =
periode berjalan) dan `alasan`. Server menghitung ulang batas D2 dari jam server WITA
(periode masa depan atau di luar batas → 422; periode lampau tanpa alasan → 422).
Entri disebut **backdate** bila periode yang diisi bukan periode berjalan saat disimpan.

**Kondisi Master (D3):** entri backdate memperbarui `inv_barang.kondisi_id` hanya bila tidak
ada hasil periksa berkondisi untuk barang itu dengan **tanggal efektif** lebih baru.
Tanggal efektif = tanggal (WITA) pencatatan untuk periode berjalan; untuk backdate =
hari terakhir periode yang diisi (harian: tanggal itu). Hasilnya (`masterDiperbarui`)
tercatat di log dan ditampilkan.

**Penanda backdate** di kartu ("Susulan · dicatat 17 Nov 10.12"), di kepala checklist
("3 entri susulan"), dan di Riwayat (lencana per periode).

### 4.4 Riwayat perubahan

Setiap perubahan ditulis ke `audit_log` **di dalam transaksi yang sama** dengan
perubahannya (tanpa tabel baru; dibaca lewat indeks `action` + `target_id = runId`):

| `action` | Kapan |
|---|---|
| `inventaris.checklist.periksa` | centang baru / ubah kondisi / ubah catatan |
| `inventaris.checklist.batal_periksa` | centang dibatalkan (baris dihapus) |
| `inventaris.checklist.selesai` | Tandai Semua Selesai (jumlah barang yang ditambahkan) |
| `inventaris.checklist.batal_selesai` | Batalkan selesai (daftar hasil periksa yang terhapus) |

`metadata`: periode & frekuensi, barang (id, kode, nama), **sebelum → sesudah** (dicentang,
kondisi id+nama, catatan), `backdate`, `alasan`, `masterDiperbarui`. Perubahan yang tidak
mengubah apa pun tidak dicatat. Tidak ada data pasien.

**Tampilan:** Riwayat › detail periode mendapat bagian **Perubahan** (linimasa: waktu,
petugas, "Kondisi Baik → Rusak Ringan", lencana Susulan + alasan). Kartu checklist punya
tautan kecil "Riwayat" ke perubahan barang itu pada periode tersebut.

### 4.5 Pengerasan simpan

- `periksa` & `complete` dalam **transaksi** + `upsert` run (aman untuk dua petugas
  bersamaan; tidak lagi galat unik).
- Validasi: barang milik ruangan (409), kondisi aktif, periode dalam batas, alasan.
- Kartu tidak "menang" diam-diam: respons server mengembalikan keadaan baris terkini.

### 4.6 Desain compact (Checklist)

- Satu bilah alat ringkas: Combobox ruangan · Frekuensi (segmented) · Periode ·
  Checklist/Riwayat · Ekspor.
- Kartu lebih padat: kode + nama + merk; **kondisi berupa tombol pil** (1 klik = centang +
  kondisi) menggantikan dropdown; catatan dilipat ("+ Catatan").
- Saring cepat: Semua · Belum diperiksa · per kondisi (dengan jumlah).
- Token & komponen yang ada (Cord, Badge, Button, Card) dipakai; radius & jarak dirapatkan
  lewat kelas lokal, bukan mengubah token global (tidak memengaruhi modul lain).
- Uji 360 px tanpa gulir menyamping.

## 5. Keamanan (OWASP)

| Risiko | Kendali |
|---|---|
| A01 akses | Semua rute memakai guard modul (`inventaris.pemeliharaan` create/view, `inventaris.pengaturan` update); barang harus milik ruangan; daftar akun hanya untuk pengelola pengaturan. |
| A01 IDOR | `ruanganId`, `barangId`, `userIds`, `runId` divalidasi ada & berelasi; batas backdate dihitung server. |
| A03 injeksi | Prisma berparameter; Zod `strictObject`, panjang dibatasi. |
| A04 desain | Backdate wajib alasan, ditandai, tercatat dalam transaksi; Master tidak ditimpa data lama. |
| A08 integritas | Log ditulis atomik bersama perubahan; tidak bisa diubah dari UI. |
| A09 log | Tanpa data pasien; NIP tersamar di pencarian akun. |

## 6. Langkah implementasi

| Langkah | Isi | Uji |
|---|---|---|
| **L1** | Tabel `inv_ruangan_petugas` + API petugas & cari akun + kolom/modal Petugas di Pengaturan › Ruangan + `Combobox` + ruangan saya & pilihan awal | E2E API + UI |
| **L2** | Desain compact Checklist + warna kartu per kondisi + pil kondisi + saring cepat + bilah komposisi | UI (desktop & 360 px) |
| **L3** | Backdate (pemilih periode, alasan, batas server, aturan Master) + log perubahan transaksional + Riwayat › Perubahan + pengerasan simpan | E2E + UI |
| **L4** | Pengerasan, regresi modul Inventarisasi, dokumen & memori; siap merge → `v2.4.0` | regresi |
| L5+ | Desain compact halaman lain: Dashboard, Master Barang, KIR, Pengaturan (satu per langkah) | UI per halaman |

## 6a. Status

| Langkah | Status |
|---|---|
| L1 | **Selesai 17 Nov 2026** — unit 21 baru (762 total), E2E API 66/66, UI 41/41 (desktop + 360 px), build produksi :3100 |
| L2–L4 | belum |

## 7. Deploy

```sh
docker compose run --rm migrate scripts/db/migrate-inventaris-all.mjs   # menambah inv_ruangan_petugas (idempoten)
docker compose build && docker compose up -d
```
Tidak ada env baru. Setelah deploy, isi Petugas per ruangan di Pengaturan › Ruangan.

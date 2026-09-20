# Blueprint — Modul Inventarisasi Barang (RSUD Boltim)

> **Dokumen untuk:** tim pengembang & sesi build berikutnya (cetak biru teknis + UX yang harus disepakati sebelum eksekusi). Bukan untuk pimpinan.
>
> Status: **DRAFT — menunggu persetujuan.** Setelah disepakati, kita kerjakan **per fitur, per sesi** (lihat Roadmap).

---

## 1. Tujuan & ruang lingkup

Manajemen seluruh data barang/aset RSUD Boltim dalam satu modul yang **kaya, modern, elegan, terasa SaaS profesional**, konsisten dengan aplikasi yang ada (bukan gaya baru), responsif, dan tidak membingungkan.

Fitur inti:

1. **Dashboard Analitik Tren** — ringkasan & tren aset.
2. **Master Barang** — data seluruh unit aset (CRUD, filter, import, export, cetak).
3. **KIR (Kartu Inventaris Ruangan)** — daftar aset per ruangan + cetak resmi bertanda tangan penanggung jawab.
4. **Checklist Pemeliharaan / Pengecekan** — jadwal & riwayat perawatan/inspeksi per unit.
5. **Pengaturan** — master referensi: Satuan, Kondisi, Sumber Anggaran, (Kategori), dan Ruangan (kode prefix + penanggung jawab).

---

## 2. Prinsip desain & UX (frontend-design + design system "Cord")

Wajib **memakai design system yang sudah ada**, bukan membuat standar baru (mencegah "standar ganda" & kebingungan):

- **Token maritim "Cord"**: navy + harbor-blue, brand `#2b76b6`, font Figtree, **light-only** (dark mode sudah dihapus). Pakai token (`bg-surface`, `text-fg`, `border-border`, `brand`, `success/warning/danger/accent`) — jangan warna hardcode.
- **Komponen bersama yang sudah ada**: `Card`, `Button`, `Badge`, `Table`, `Modal`, `Pagination`, `Select/SelectOther`, `DatePicker`, `PopoverPanel`, `Skeleton`, `EmptyState/ErrorState`, `PageHeader`, `Segmented`, `Chip`. Bangun komponen baru hanya bila belum ada.
- **Hirarki visual jelas**: aksi utama dominan; kelompokkan dengan spasi & Card; skala spasi base-4/8.
- **Status & badge yang jelas** (lihat §6 taksonomi): kondisi & status aset selalu tampil sebagai badge berwarna + label (tidak mengandalkan warna saja — sertakan teks/ikon; aman CVD).
- **Interaktif**: filter satu baris di atas tabel, hover states, empty/skeleton/error states di setiap data view, konfirmasi untuk aksi destruktif.
- **Notifikasi jelas**: aplikasi **belum punya sistem toast** → kita tambah **Toast/Notification provider ringan** (sukses/simpan/hapus/gagal) di fase fondasi. Semua aksi tulis memberi umpan balik.
- **Responsif**: mobile-first; tabel lebar → scroll horizontal berkontainer + kolom prioritas (sembunyikan kolom sekunder di layar kecil, pola seperti `PengunjungView`).
- **Aksesibilitas**: elemen interaktif keyboard-navigable, label pada input, focus ring terlihat, kontras AA.
- Saat membangun chart Dashboard: ikuti skill **dataviz** + kit chart SVG bespoke yang sudah ada (token warna chart CVD-safe).

---

## 3. Arsitektur & fondasi teknis

- **Lokasi data: `reporthub` (read-write)** — ini data milik aplikasi, **bukan** SIMGOS. Tidak menyentuh SIMGOS sama sekali (HIGH ALERT read-only tetap dihormati).
- **Prisma**: tambah model di schema app. **DDL manual (`CREATE TABLE`/`ALTER` aditif)** — JANGAN `prisma db push` (bahaya drift/kehilangan data). Setelah tambah model → **restart dev server**.
- **RBAC**: daftarkan modul di `src/server/rbac/modules.ts` (grup **"Inventarisasi Barang"**), guard tiap page & API. Rencana modul (lihat keputusan D):
  - `inventaris` — Dashboard (view)
  - `inventaris.barang` — Master Barang (view/create/update/delete/print)
  - `inventaris.kir` — KIR (view/print)
  - `inventaris.pemeliharaan` — Checklist (view/create/update)
  - `inventaris.pengaturan` — Pengaturan (view/update)
- **Navigasi**: otomatis dari katalog modul (grup baru muncul di Sidebar).
- **Rute**:
  - `/inventaris` (Dashboard)
  - `/inventaris/barang` (list) · `/inventaris/barang/[id]` (detail) · dialog tambah/edit
  - `/inventaris/kir`
  - `/inventaris/pemeliharaan`
  - `/inventaris/pengaturan` (tab: Satuan · Kondisi · Sumber Anggaran · Kategori · Ruangan)
- **API**: `/api/inventaris/...` (barang, kir, pemeliharaan, ref/*, dsb) — konsisten `ok/fail`, validasi Zod, guard izin.
- **Reuse**: helper Excel (`buildReportWorkbook`) & PDF (`buildReportPdf`) yang sudah ada untuk export/cetak.

---

## 4. Model data (tabel `inv_*` di reporthub)

### Referensi (Pengaturan)
| Tabel | Kolom inti | Catatan |
|---|---|---|
| `inv_satuan` | id, nama (Unit/Buah/Set/…), aktif, urutan | dropdown satuan |
| `inv_kondisi` | id, nama (Baik/Rusak Ringan/Rusak Berat), kode (B/RR/RB), tone (success/warning/danger), urutan, aktif | badge kondisi |
| `inv_sumber_anggaran` | id, nama (DAU/DAK/Hibah/APBD/…), singkatan, aktif | badge/label |
| `inv_kategori` | id, nama (Alat Kesehatan/Alat Kantor/Mebel/…), kode, aktif | filter & analitik (lihat keputusan) |
| `inv_ruangan` | id, **kodePrefix** (unik, mis. ICU/OBG/DIR), nama, penanggungJawabNama, penanggungJawabNip, aktif | lokasi + PJ; dipakai auto-generate kode & KIR |

### Aset
| Tabel | Kolom inti |
|---|---|
| `inv_barang` (1 baris = 1 **unit fisik**) | id, **kodeBarang** (unik), register (int, urut per ruangan), nama, merk, kategoriId?, sumberAnggaranId?, tahunPerolehan?, tglPerolehan?, harga (BIGINT rupiah, nullable), satuanId?, kondisiId, ruanganId, nomorSeri?, **statusAset** (AKTIF/PERBAIKAN/DIPINJAM/DIHAPUS), fotoUrl?, keterangan?, createdBy/At, updatedBy/At |
| `inv_pemeliharaan` (log) | id, barangId, tanggal, jenis (RUTIN/PERBAIKAN/KALIBRASI/INSPEKSI), hasil (BAIK/PERLU_TINDAK_LANJUT/RUSAK), kondisiSesudahId?, petugas, biaya?, catatan?, jatuhTempoBerikutnya?, createdBy/At |
| _(opsional, fase lanjut)_ `inv_mutasi` | id, barangId, dariRuanganId, keRuanganId, tanggal, alasan, oleh | riwayat perpindahan lokasi |

Indeks: `inv_barang(kodeBarang)` unik; index `ruanganId`, `kondisiId`, `kategoriId`, `statusAset`, `tahunPerolehan`. Semua FK referensi → `RESTRICT`/`SET NULL` sesuai konteks.

---

## 5. Master Barang — analisis & optimasi data contoh (best practices)

Dari contoh (ICU-001…ICU-022) — usulan optimasi:

1. **Satu record = satu unit fisik** (asset-level). Di contoh `JUMLAH` selalu 1 → **kolom JUMLAH dibuang** di level unit; jumlah/total dihitung via agregasi (COUNT). Cocok untuk KIR & pemeliharaan (yang dicek/dirawat adalah unit).
2. **HARGA disimpan `BIGINT` rupiah (nullable)** — bukan string "Rp 29.924.358". Kosong = NULL (harga tak diketahui); "Rp 0" = 0 (hibah/nilai 0). Format Rupiah hanya di tampilan.
3. **KODE BARANG auto-generate** = `<kodePrefix ruangan>-<urut 3 digit>` (mis. `ICU-001`). `register` = nomor urut. **Kode = tag permanen** (tidak berubah saat barang mutasi); lokasi (`ruanganId`) yang berubah, riwayat via `inv_mutasi`.
4. **Referensi dinormalkan** (Pengaturan): SUMBER ANGGARAN, KONDISI, SATUAN, KATEGORI → tabel + badge. Hindari salah ketik (mis. "UNKNOW", "SH", "MEND" pada MERK menandakan input bebas → beri **autocomplete** dari nilai yang sudah ada).
5. **Pisahkan `KONDISI` (Baik/RR/RB)** dari **`statusAset` (Aktif/Perbaikan/Dipinjam/Dihapus)** — dua sumbu berbeda, dua badge berbeda.
6. **Tambahan bernilai**: `nomorSeri` (alkes), `tglPerolehan` (opsional selain tahun), **QR code dari kodeBarang** (scan cepat saat stock-opname & checklist), `fotoUrl` (identifikasi), audit `dibuat/diubah oleh`.
7. **Import Excel/CSV** untuk memuat data existing (mapping kolom → validasi → pratinjau → commit). Wajib karena data sudah ada di spreadsheet.
8. Nama barang berulang (BED ELEKTRIK ×4, VENTILATOR ×3) → cukup **autocomplete + normalisasi ejaan**; katalog "Jenis Barang" terpisah = opsional (lihat keputusan B).

**UX Master Barang**: tabel padat + filter (ruangan, kategori, kondisi, status, sumber anggaran, tahun, pencarian kode/nama/merk/seri) satu baris; stat tiles (total unit, nilai total, %Baik, perlu perhatian); tambah/edit via Modal dengan kode auto-preview; halaman detail unit (info + riwayat pemeliharaan + QR); aksi Export Excel/PDF & Import.

---

## 6. Taksonomi status & badge (konsisten seluruh modul)

| Sumbu | Nilai | Badge tone |
|---|---|---|
| Kondisi | Baik | success |
| | Rusak Ringan | warning |
| | Rusak Berat | danger |
| Status Aset | Aktif | brand/neutral |
| | Dalam Perbaikan | warning |
| | Dipinjam | accent |
| | Dihapus/Non-aktif | neutral (redup) |
| Pemeliharaan | Terjadwal (due) | brand |
| | Jatuh tempo (overdue) | danger |
| | Selesai | success |

Semua badge = warna **+ teks** (dan ikon bila perlu) — tidak warna-saja.

---

## 7. Rincian fitur

- **Dashboard Analitik Tren**: stat tiles (total unit, total nilai perolehan, jumlah ruangan, unit perlu perhatian). Chart: komposisi kondisi (Baik/RR/RB), aset per kategori, per ruangan (top), per sumber anggaran, **tren perolehan per tahun** (nilai & jumlah), pemeliharaan jatuh tempo. Ikuti skill **dataviz** + kit chart bespoke.
- **Master Barang**: seperti §5.
- **KIR**: pilih ruangan → daftar aset ruangan itu → **cetak PDF KIR resmi** (kop, kolom standar, footer tanda tangan Penanggung Jawab dari `inv_ruangan`). Reuse `buildReportPdf`.
- **Checklist Pemeliharaan**: daftar aset dengan status pemeliharaan (due/overdue/ok), form input inspeksi/perawatan (update kondisi + jadwal berikutnya), riwayat per unit, filter periode & ruangan, export. Badge due/overdue jelas + notifikasi.
- **Pengaturan**: tab CRUD untuk Satuan, Kondisi (+tone), Sumber Anggaran, Kategori, dan **Ruangan** (kodePrefix + PJ nama/NIP) seperti contoh (DIR/OBG/…). Validasi kodePrefix unik.

---

## 8. Roadmap (per sesi)

| Sesi | Fokus | Output |
|---|---|---|
| **0 (ini)** | Blueprint & kesepakatan | dokumen ini + keputusan |
| **1** | **Fondasi**: DDL tabel, model Prisma, RBAC + nav, **Toast provider**, modul **Pengaturan** (Satuan/Kondisi/Sumber Anggaran/Kategori/Ruangan) | referensi siap dipakai |
| **2** | **Master Barang**: list+filter+CRUD, kode auto-gen, detail+QR, Export Excel/PDF, **Import Excel** data existing | data aset masuk |
| **3** | **KIR**: view per ruangan + cetak PDF resmi ber-TTD PJ | |
| **4** | **Checklist Pemeliharaan**: jadwal, input, riwayat, badge due/overdue, notifikasi | |
| **5** | **Dashboard Analitik Tren**: chart & tren (dataviz) | |
| **6** | Polish: QR scan, foto, mutasi/riwayat, penyempurnaan notifikasi | (sesuai keputusan) |

Pengaturan didahulukan karena Master Barang bergantung pada referensinya.

---

## 9. Keputusan (DISEPAKATI 2026-09-20)

- **A. Granularitas** → **Per-unit saja.** 1 record = 1 unit fisik dengan kode/tag unik. Tanpa mode kuantitas massal.
- **B. Jenis Barang** → **Flat + autocomplete.** Nama/merk di record barang, dengan autocomplete dari nilai existing untuk cegah salah ketik. Tanpa katalog jenis terpisah.
- **C. Fitur tambahan** → **SEMUA masuk scope**: Import Excel data existing · QR/barcode dari kode · Foto barang · Mutasi & riwayat lokasi (`inv_mutasi`). _(Penyusutan/masa manfaat tidak dipilih → di luar scope untuk saat ini.)_
- **D. RBAC** → **Sub-modul per fitur** (`inventaris`, `inventaris.barang`, `inventaris.kir`, `inventaris.pemeliharaan`, `inventaris.pengaturan`).
- **E. Kategori barang** → default **kategori bebas** (tabel `inv_kategori`), belum ditegaskan user; bisa disesuaikan ke klasifikasi KIB BMD bila diminta.

Implikasi vs draft: `inv_mutasi` naik jadi bagian scope (bukan opsional); QR & Foto masuk field `inv_barang` (`fotoUrl`, QR dari `kodeBarang`); Import Excel bagian Sesi 2.

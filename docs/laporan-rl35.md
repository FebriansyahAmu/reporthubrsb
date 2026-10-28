# Laporan RL 3.5 (SIRS 6) — Rekapitulasi Kunjungan

Pusat Laporan › Rekam Medis › **RL 3.5 — Kunjungan** (`/laporan/rl35`). Dibuat 28 Okt 2026.

Laporan ini merekap kunjungan poliklinik per jenis kegiatan dan kunjungan rawat darurat sesuai formulir SIRS 6 RL 3.5. Setiap baris dirinci laki-laki/perempuan dan domisili dalam/luar kabupaten/kota. Dua baris rata-rata ikut dihitung: hari poliklinik buka dan kunjungan per hari.

Periode bisa per bulan, triwulan, atau rentang tanggal hingga 366 hari. Hasilnya bisa diekspor ke Excel (2 lembar) dan PDF. Izin: `laporan:view`. Panel pemetaan memakai `laporan.pemetaan-rl`.

## Analisis procedure SIMGOS (hanya dibaca)

Procedure acuannya `laporan.LaporanRL35Revisi(TGLAWAL, TGLAKHIR)`, dibuat 17 Jul 2026. `laporan.LaporanRL35` tanpa "Revisi" adalah RL 3.5 format lama (Perinatologi) dan bukan acuan laporan ini.

| Tabel | Peran di procedure |
| --- | --- |
| `master.jenis_laporan_detil` (JENIS `100103`, ID `105`, kode "RL 3.5 (SIRS 6)") | Menentukan daftar baris. |
| `master.refrl` (38 baris) | Jenis kegiatan 1–34; baris 66 "Rata-rata hari poliklinik buka", 77 "Rata-rata kunjungan per hari", 99 TOTAL (dibuang procedure), 100 "Tidak Ada Data". |
| `pendaftaran.kunjungan` + `master.ruangan` (`JENIS = 5`) | Kunjungan poliklinik (`JENIS_KUNJUNGAN = 1`) dan IGD (`= 2`) dengan `MASUK` dalam periode; pendaftaran & kunjungan berstatus 1/2. |
| `pendaftaran.tujuan_pasien` | Syarat cabang rawat jalan. PK-nya NOPEN dan setiap pendaftaran punya satu, jadi tidak pernah membuang data. |
| **`master.rl35_ruangan_revisi`** (ID ruangan → `RL52` = ID refrl) | Pemetaan poliklinik → jenis kegiatan. **Di instalasi ini tabelnya kosong (0 baris).** |
| `medicalrecord.diagnosa` (`INA_GROUPER = 0`, `STATUS = 1`) | Memindahkan baris: 4 → 3 bila ada diagnosis neonatal (P00–P89, P91–P96); 6 → 5 bila kehamilan (O*); 31 → 30 dan 33 → 32 bila stroke (I61.9, I63.9, I64, I69.3, I69.4). |
| `pendaftaran.surat_rujukan_pasien` → `master.ppk.WILAYAH` vs `aplikasi.instansi` → `master.ppk.WILAYAH` | Kolom dalam/luar kota. |
| `penjamin`, `referensi`, `ikatan_kerja_sama`, `kartu_asuransi_pasien` | Join kosmetik, tidak dipakai di keluaran. |

**Akibat tabel pemetaan kosong:** procedure tidak pernah menghitung rawat jalan. `CALL` untuk September 2026 hanya mengisi baris 24 "Rawat Darurat" (243 kunjungan, L 110 / P 133); semua baris poliklinik bernilai 0. Seluruh kunjungan IGD (Bedah, Non Bedah, IRDA, IRDO) selalu masuk baris 24 tanpa pemetaan.

## Port ReportHub

SIMGOS tidak diubah: tidak ada tabel atau procedure baru, dan database user `reporthub_ro` hanya punya SELECT/EXECUTE. Logika procedure dipindahkan ke modul `src/server/modules/rl35/*`. Tabel pemetaan pengganti dibuat di DB aplikasi `reporthub`:

```sql
rl35_ruangan_peta (ruangan_id PK, rl_id NULL = tidak dilaporkan, ruangan_nama, diubah_oleh_*, created_at, updated_at)
```

**Status pemetaan per ruangan** (`rl35.hitung.ts` › `petaEfektif`):

| Status | Arti |
| --- | --- |
| Ditetapkan | Ada baris tersimpan dengan `rl_id` jenis kegiatan yang sah. |
| Bawaan | Belum ada baris; memakai saran dari nama ruangan (`saranJenisKegiatan`). Ruang IGD selalu 24. |
| Tidak dilaporkan | Baris tersimpan dengan `rl_id` NULL. |
| Belum dipetakan | Tanpa baris dan tanpa saran, atau `rl_id` usang. Kunjungannya tidak masuk laporan dan muncul sebagai peringatan. |

Pemetaan bawaan per 28 Okt 2026, untuk 17 ruangan `JENIS = 5`, `JENIS_KUNJUNGAN` 1/2, termasuk yang nonaktif:

| Ruangan | Jenis kegiatan |
| --- | --- |
| Klinik Interna | 1 Penyakit Dalam |
| Klinik Bedah | 2 Bedah |
| Klinik Anak | 4 Kesehatan Anak Lainnya → 3 bila diagnosis neonatal |
| Klinik Obgyn | 6 Obstetri & Ginekologi Lainnya → 5 bila diagnosis kehamilan |
| Klinik KIA/KB | 7 Keluarga Berencana |
| Klinik Mata | 12 Mata |
| Klinik Gigi | 14 Gigi & Mulut |
| Klinik Radiologi | 17 Radiologi |
| Klinik Rehab Medik, Klinik Fisioterapy (nonaktif) | 25 Rehabilitasi Medik |
| Klinik Gizi | 27 Konsultasi Gizi |
| Klinik MCU | 29 Medical Check Up |
| Klinik Saraf | 33 Saraf (Lainnya) → 32 bila diagnosis stroke |
| Bedah, Non Bedah, IRDA, IRDO (IGD) | 24 Rawat Darurat |

Admin dapat menetapkan atau mengubah pemetaan lewat panel **Pemetaan ruangan**. Setiap simpan ditulis satu transaksi bersama jejak `audit_log` (`laporan.rl35.pemetaan`, berisi dari → ke per ruangan, tanpa data pasien).

## Penyesuaian terhadap procedure

Penyesuaian 1 dan 3 diputuskan pemilik pada 28 Okt 2026.

1. **Dalam/luar kab/kota menurut domisili pasien.** Ukurannya kabupaten alamat pasien (`LEFT(master.pasien.WILAYAH, 4)`) dibanding kabupaten RS (4 digit `master.ppk.WILAYAH` instansi = `7110`).
   - Procedure memakai wilayah faskes perujuk, sehingga pendaftaran tanpa surat rujukan aktif selalu terhitung "luar kota".
   - Contoh September 2026, kunjungan IGD dalam kota: procedure 13 dari 243 (5%), domisili 187 dari 243 (77%).
   - Domisili kosong dihitung luar dan jumlahnya disebut di catatan laporan.
2. **Satuan kunjungan = pasangan (pendaftaran, ruangan).**
   - Procedure menghitung sekali per pendaftaran dengan ruangan sembarang (`GROUP BY pd.NOMOR` tanpa agregat ruangan).
   - Pendaftaran yang mengunjungi dua poliklinik kini terhitung di keduanya: 11 kasus sepanjang 2025, 5 pada Triwulan III 2026.
3. **Baris 66 & 77 dihitung** (procedure selalu 0):
   - **66** = jumlah tanggal dengan ≥ 1 kunjungan poliklinik terlaporkan, dibagi jumlah bulan kalender periode;
   - **77** = kunjungan rawat jalan terlaporkan (tanpa IGD) dibagi jumlah hari poliklinik buka;
   - keduanya dibulatkan 1 desimal.
4. **Join kosmetik dibuang**, dan baris 100 "Tidak Ada Data" tidak ditampilkan.

## Desain query

Untuk setiap periode ada dua query SELECT paralel; satu-satunya nilai yang di-bind adalah tanggal dan kode kabupaten:

- **`queryAgregatRl35`:**
  - `kunjungan FORCE INDEX (MASUK)` → `ruangan` → `pendaftaran` → `pasien`;
  - satu baris per (NOPEN, ruangan), dengan bendera diagnosis berupa `EXISTS` per NOPEN;
  - lalu `GROUP BY` ruangan × jenis kelamin × domisili × bendera, menghasilkan puluhan baris.
- **`queryHariPoliklinik`:** satu baris per tanggal (≤ 366) berisi daftar poliklinik yang melayani.
- **Pemetaan, pemindahan baris, dan rata-rata** dihitung di `rl35.hitung.ts`, modul murni yang diuji unit.
- **Kode diagnosis** adalah konstanta yang dipagari pola sebelum disisipkan ke SQL.
- **Pengaman:** `MAX_EXECUTION_TIME(15000)`, rentang ≤ 366 hari, dan cache 10 menit untuk jenis kegiatan serta instansi.
- **Kinerja produksi:** 1 bulan ±35 ms, 1 tahun ±90 ms.

## Verifikasi (28 Okt 2026, build produksi)

**Unit:** 529 tes. Mencakup saran 17 ruangan nyata, pemindahan baris, status pemetaan, kolom formulir, rata-rata, dan schema.

**E2E `rl35-e2e.mjs`:** 72/72.
- **RBAC:** 401 tanpa sesi; 403 tanpa `laporan`; 403 untuk pemetaan tanpa izin; hanya-lihat tidak bisa menyimpan; 403 lintas situs.
- **Validasi:** 12 kasus → 422.
- **Oracle hitung JS dari data mentah per kunjungan:** semua sel (34 × 7) dan baris 66/77 identik untuk Sep 2026, Triwulan III 2026, Tahun 2025, dan Okt 2026 (berjalan).
- **Oracle SQL procedure asli** (dari `SHOW CREATE`, tabel pemetaan diganti pemetaan efektif): total procedure + pendaftaran multi-poliklinik = total port, Jumlah/L/P per baris sama.
- **`CALL` procedure asli:** baris 24 identik (243 / 110 / 133).
- **Pemetaan:** simpan, audit, pengaruh ke laporan, nilai sama tanpa audit, kosongkan → bawaan.
- **Ekspor:** Excel dicek isinya, PDF.
- **Halaman, katalog, kinerja:** semua lulus.
- **Tabel pemetaan:** dipulihkan persis.

**UI `rl35-ui.mjs`:** 13/13. Tile dan tabel sama dengan API, saklar 34 baris, tab per ruangan, drawer 17 ruangan, ponsel 390 px tanpa luapan, tanpa galat JS.

## Deploy

Tabel baru di `reporthub` harus dibuat dulu. Migrasinya idempoten (hanya `CREATE TABLE IF NOT EXISTS`):

```sh
docker compose run --rm migrate scripts/db/migrate-laporan-rl.mjs
docker compose build && docker compose up -d
```

# Referensi — Discovery SIMGOS (read-only)

Kumpulan query **read-only** untuk memetakan struktur SIMGOS sebelum menulis DAL.
Semua aman dijalankan user `SELECT/EXECUTE` (tidak mengubah apa pun — HIGH ALERT).

> Database yang dipakai (lihat `src/server/db/simgos-databases.ts`):
> `medicalrecord`, `pendaftaran`, `layanan`, `laporan`, `master`.

## Hasil tes koneksi (2026-07-24)

Server `10.202.100.60:3306` (MySQL 8.0.45), user `admin`. Semua terjangkau:

| Database | Ada | Tabel | Routine |
|---|---|---:|---:|
| medicalrecord | ✅ | 182 | 79 |
| pendaftaran | ✅ | 25 | 18 |
| layanan | ✅ | 56 | 66 |
| master | ✅ | 150 | 89 |
| ~~report~~ → **laporan** | ✅ | — | — |

Objek kunci terkonfirmasi ADA: `medicalrecord.CetakMR2` (SP), `pendaftaran.kunjungan`,
`master.ruangan`. Catatan: DB "report" ternyata bernama **`laporan`**.

---

## 0. Konektivitas & hak akses

```sql
-- Database yang terlihat oleh user koneksi
SHOW DATABASES;

-- Jumlah tabel & stored procedure yang bisa diakses per database
SELECT TABLE_SCHEMA, COUNT(*) AS jml_tabel
FROM information_schema.TABLES
WHERE TABLE_SCHEMA IN ('medicalrecord','pendaftaran','layanan','laporan','master')
GROUP BY TABLE_SCHEMA;

SELECT ROUTINE_SCHEMA, COUNT(*) AS jml_routine
FROM information_schema.ROUTINES
WHERE ROUTINE_SCHEMA IN ('medicalrecord','pendaftaran','layanan','laporan','master')
GROUP BY ROUTINE_SCHEMA;
```

---

## 1. Tabel `pendaftaran.kunjungan`

Cari kolom penanda **RUANGAN**, waktu **MASUK**, waktu **KELUAR** (penanda final),
serta **NOPEN** / **NORM** untuk penghubung.

```sql
SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_KEY, COLUMN_COMMENT
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = 'pendaftaran' AND TABLE_NAME = 'kunjungan'
ORDER BY ORDINAL_POSITION;
```

## 2. Tabel `master.ruangan`

Cari kolom yang membedakan **Rawat Inap / Rawat Jalan Klinik / IGD**
(mis. `JENIS`, `KELOMPOK`, `DEPARTEMEN`, atau flag tertentu).

```sql
SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_KEY, COLUMN_COMMENT
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = 'master' AND TABLE_NAME = 'ruangan'
ORDER BY ORDINAL_POSITION;
```

## 3. Contoh nilai ruangan (untuk menentukan aturan klasifikasi)

```sql
SELECT * FROM master.ruangan LIMIT 10;

-- Bila ada kolom jenis/kelompok, lihat sebaran nilainya:
-- SELECT <kolom_jenis>, COUNT(*) FROM master.ruangan GROUP BY <kolom_jenis>;
```

---

## Hasil discovery

> Tempel hasil query di sini setelah dijalankan, lalu jadikan acuan menulis
> `kunjungan.dal.ts` (query `pendaftaran.kunjungan ⨝ master.ruangan`, filter minggu,
> status final dari kolom `KELUAR`).

- Kolom kunjungan: _(isi)_
- Kolom ruangan: _(isi)_
- Aturan RI/RJ/IGD: _(isi)_
- Nama kolom KELUAR: _(isi)_

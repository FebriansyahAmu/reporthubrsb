-- ============================================================================
-- DDL BCKH (Buku Catatan Kegiatan Harian) → DB APLIKASI `reporthub` (RW).
-- BUKAN SIMGOS — modul ini tidak membaca/menulis SIMGOS sama sekali.
-- Idempoten: hanya CREATE TABLE IF NOT EXISTS (tanpa ALTER/DROP → AMAN diulang).
-- Runner: scripts/db/migrate-bckh.mjs (membaca file INI — sumber tunggal).
-- Rancangan: docs/PRD_Modul_BCKH.md §5.
-- Sengaja TANPA FK ke `users`: catatan kinerja tetap ada walau akun dihapus,
-- dan alur hapus pengguna (Master) tidak terganggu.
-- ============================================================================

-- Profil laporan per pengguna (opsional; tanpa baris → bawaan dari `users`).
-- nama_lengkap = sampul ("Nama, S.Kom"); nama_ttd = blok tanda tangan (huruf besar/singkatan).
CREATE TABLE IF NOT EXISTS bckh_profil (
  user_id       VARCHAR(191) NOT NULL PRIMARY KEY,
  nama_lengkap  VARCHAR(191) NOT NULL,
  nama_ttd      VARCHAR(191) NOT NULL,
  jabatan       VARCHAR(191) NOT NULL DEFAULT '',
  nip           VARCHAR(40)  NOT NULL DEFAULT '',
  unit          VARCHAR(191) NOT NULL DEFAULT '',
  atasan_nama   VARCHAR(191) NOT NULL DEFAULT '',
  atasan_nip    VARCHAR(40)  NOT NULL DEFAULT '',
  created_at    DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at    DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Satu catatan per pengguna per tanggal. status: MASUK | TUGAS_LUAR | REMOTE | OFF
-- | CUTI | SAKIT | IZIN | LIBUR (divalidasi Zod; VARCHAR(16) cukup → tanpa ALTER).
-- keterangan = kolom KET laporan. Foto profil BUKAN di tabel: STORAGE_DIR/bckh/avatar/.
CREATE TABLE IF NOT EXISTS bckh_hari (
  id          VARCHAR(30)  NOT NULL PRIMARY KEY,
  user_id     VARCHAR(191) NOT NULL,
  tanggal     DATE         NOT NULL,
  status      VARCHAR(16)  NOT NULL DEFAULT 'MASUK',
  keterangan  VARCHAR(191) NOT NULL DEFAULT '',
  created_at  DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at  DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  UNIQUE KEY uq_bckh_hari_user_tanggal (user_id, tanggal)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Kegiatan dalam satu catatan hari (urut tampil). target: SELESAI | PROSES.
CREATE TABLE IF NOT EXISTS bckh_kegiatan (
  id          VARCHAR(30)  NOT NULL PRIMARY KEY,
  hari_id     VARCHAR(30)  NOT NULL,
  urutan      SMALLINT     NOT NULL DEFAULT 0,
  uraian      VARCHAR(300) NOT NULL,
  kategori    VARCHAR(24)  NOT NULL DEFAULT 'tugas-pokok',
  target      VARCHAR(8)   NOT NULL DEFAULT 'SELESAI',
  created_at  DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at  DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  KEY idx_bckh_kegiatan_hari (hari_id, urutan),
  CONSTRAINT fk_bckh_kegiatan_hari FOREIGN KEY (hari_id) REFERENCES bckh_hari(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Log pengisian (hanya-tambah, tanpa data pasien). aksi: BUAT | UBAH | HAPUS |
-- EKSPOR. tanggal = hari yang disentuh (EKSPOR: tanggal 1 bulan laporan).
-- rincian = ringkasan perubahan (JSON). user_id = pemilik catatan; aktor_* = pelaku.
CREATE TABLE IF NOT EXISTS bckh_log (
  id          INT          NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id     VARCHAR(191) NOT NULL,
  aktor_id    VARCHAR(191) NOT NULL,
  aktor_nama  VARCHAR(191) NOT NULL,
  aksi        VARCHAR(8)   NOT NULL,
  tanggal     DATE         NOT NULL,
  rincian     JSON         NULL,
  ip          VARCHAR(64)  NULL,
  created_at  DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  KEY idx_bckh_log_user (user_id, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Pengaturan laporan global (satu baris, id = 1): kop sampul & penandatangan
-- "Mengetahui". Tanpa baris → bawaan dari dokumen contoh (bckh.constants.ts).
CREATE TABLE IF NOT EXISTS bckh_pengaturan (
  id                  TINYINT      NOT NULL PRIMARY KEY,
  kop_1               VARCHAR(120) NOT NULL,
  kop_2               VARCHAR(120) NOT NULL,
  instansi_1          VARCHAR(120) NOT NULL,
  instansi_2          VARCHAR(120) NOT NULL,
  mengetahui_jabatan  VARCHAR(191) NOT NULL,
  mengetahui_nama     VARCHAR(191) NOT NULL,
  mengetahui_nip      VARCHAR(40)  NOT NULL,
  diubah_oleh_id      VARCHAR(191) NULL,
  diubah_oleh_nama    VARCHAR(191) NULL,
  updated_at          DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- v1.2 — Persetujuan & tanda tangan (PRD §15). Tabel BARU; tabel di atas tidak diubah.
-- ---------------------------------------------------------------------------

-- Pegawai → AKUN atasan langsung (dipilih pegawai di profil laporan). Nama/NIP atasan
-- untuk cetak tetap di bckh_profil (atasan_nama/atasan_nip).
CREATE TABLE IF NOT EXISTS bckh_atasan (
  user_id     VARCHAR(191) NOT NULL PRIMARY KEY,
  atasan_id   VARCHAR(191) NOT NULL,
  created_at  DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at  DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  KEY idx_bckh_atasan_atasan (atasan_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Setelan global kunci–nilai (setelan baru tanpa ALTER). mengetahui_id = akun direktur
-- penanda tangan "Mengetahui".
CREATE TABLE IF NOT EXISTS bckh_setelan (
  kunci             VARCHAR(40)  NOT NULL PRIMARY KEY,
  nilai             VARCHAR(191) NOT NULL,
  diubah_oleh_id    VARCHAR(191) NULL,
  diubah_oleh_nama  VARCHAR(191) NULL,
  updated_at        DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Pengajuan persetujuan laporan bulanan. status: MENUNGGU_ATASAN | MENUNGGU_MENGETAHUI |
-- DISETUJUI | DITOLAK | DITARIK | DIBATALKAN. aktif = '1' selama berjalan/disetujui, NULL
-- bila berakhir → UNIQUE (user_id, bulan, aktif) = satu pengajuan aktif per bulan (NULL boleh
-- berulang). isi = snapshot laporan (JSON) yang ditandatangani; token = URL verifikasi (QR).
CREATE TABLE IF NOT EXISTS bckh_pengajuan (
  id                 VARCHAR(30)  NOT NULL PRIMARY KEY,
  user_id            VARCHAR(191) NOT NULL,
  bulan              CHAR(7)      NOT NULL,
  status             VARCHAR(20)  NOT NULL,
  aktif              CHAR(1)      NULL,
  sampai_mengetahui  TINYINT(1)   NOT NULL DEFAULT 1,
  atasan_id          VARCHAR(191) NOT NULL,
  mengetahui_id      VARCHAR(191) NULL,
  catatan            VARCHAR(500) NOT NULL DEFAULT '',
  isi                LONGTEXT     NOT NULL,
  isi_sha256         CHAR(64)     NOT NULL,
  token              CHAR(32)     NOT NULL,
  alasan             VARCHAR(500) NULL,
  diakhiri_oleh_id   VARCHAR(191) NULL,
  diakhiri_oleh_nama VARCHAR(191) NULL,
  diakhiri_at        DATETIME(3)  NULL,
  diajukan_at        DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at         DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  UNIQUE KEY uq_bckh_pengajuan_aktif (user_id, bulan, aktif),
  UNIQUE KEY uq_bckh_pengajuan_token (token),
  KEY idx_bckh_pengajuan_user (user_id, bulan),
  KEY idx_bckh_pengajuan_atasan (atasan_id, status),
  KEY idx_bckh_pengajuan_mengetahui (mengetahui_id, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Gambar TTD per pengajuan × peran (PEGAWAI | ATASAN | MENGETAHUI). PNG dinormalkan
-- server; sekali tulis, tak pernah diubah.
CREATE TABLE IF NOT EXISTS bckh_ttd (
  id            VARCHAR(30)  NOT NULL PRIMARY KEY,
  pengajuan_id  VARCHAR(30)  NOT NULL,
  peran         VARCHAR(12)  NOT NULL,
  user_id       VARCHAR(191) NOT NULL,
  nama          VARCHAR(191) NOT NULL,
  png           MEDIUMBLOB   NOT NULL,
  sha256        CHAR(64)     NOT NULL,
  ukuran        INT          NOT NULL,
  ip            VARCHAR(64)  NULL,
  created_at    DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE KEY uq_bckh_ttd_peran (pengajuan_id, peran),
  CONSTRAINT fk_bckh_ttd_pengajuan FOREIGN KEY (pengajuan_id) REFERENCES bckh_pengajuan(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

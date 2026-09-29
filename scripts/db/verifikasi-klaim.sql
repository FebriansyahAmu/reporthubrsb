-- ============================================================================
-- DDL modul VERIFIKASI KLAIM BPJS → DB APLIKASI `reporthub` (RW). BUKAN SIMGOS.
-- SIMGOS tetap READ-ONLY: semua status, koreksi, lampiran & paket disimpan di sini.
-- Idempoten: CREATE TABLE IF NOT EXISTS (tanpa DROP → AMAN diulang).
-- Runner: scripts/db/migrate-verifikasi-klaim.mjs (membaca file INI — sumber tunggal).
-- PRD: docs/PRD_Verifikasi_Klaim_BPJS.md §7.4. Enum disimpan VARCHAR (divalidasi Zod).
-- Kolom *_oleh_id = users.id pelaku; *_oleh_nama = snapshot nama (linimasa tetap terbaca).
-- ============================================================================

-- 1 baris per episode klaim (NOPEN). Dibuat saat keputusan pertama (lazy) —
-- episode tanpa baris = BELUM_DIPERIKSA. `versi` = optimistic locking.
CREATE TABLE IF NOT EXISTS klaim_verifikasi (
  id                 VARCHAR(30)  NOT NULL PRIMARY KEY,
  nopen              VARCHAR(20)  NOT NULL,
  norm               VARCHAR(20)  NULL,
  nama_pasien        VARCHAR(191) NULL,
  kategori           VARCHAR(4)   NOT NULL,                        -- RI / IGD / RJ
  ruang              VARCHAR(191) NULL,
  tgl_pulang         DATETIME     NULL,                            -- jam dinding SIMGOS
  no_sep             VARCHAR(40)  NULL,
  status             VARCHAR(20)  NOT NULL DEFAULT 'BELUM_DIPERIKSA',
  versi              INT          NOT NULL DEFAULT 1,
  cek                JSON         NULL,                            -- snapshot hasil cek otomatis terakhir
  cek_at             DATETIME(3)  NULL,
  lolos_rm_oleh_id   VARCHAR(191) NULL,
  lolos_rm_at        DATETIME(3)  NULL,
  lolos_klaim_oleh_id VARCHAR(191) NULL,
  lolos_klaim_at     DATETIME(3)  NULL,
  final_oleh_id      VARCHAR(191) NULL,
  final_at           DATETIME(3)  NULL,
  created_at         DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at         DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  UNIQUE KEY uq_klaim_verifikasi_nopen (nopen),
  KEY idx_klaim_verifikasi_status (status),
  KEY idx_klaim_verifikasi_pulang (tgl_pulang)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Linimasa transisi & aksi (siapa, kapan, dari→ke, catatan, rincian).
CREATE TABLE IF NOT EXISTS klaim_verifikasi_riwayat (
  id           VARCHAR(30)  NOT NULL PRIMARY KEY,
  nopen        VARCHAR(20)  NOT NULL,
  aksi         VARCHAR(40)  NOT NULL,                              -- LOLOSKAN_RM / TANDAI_TIDAK_LENGKAP / …
  dari_status  VARCHAR(20)  NULL,
  ke_status    VARCHAR(20)  NULL,
  versi        INT          NOT NULL,                              -- versi baris SETELAH aksi
  catatan      TEXT         NULL,
  data         JSON         NULL,                                  -- item gagal, kode koreksi, hash paket, …
  oleh_id      VARCHAR(191) NULL,
  oleh_nama    VARCHAR(191) NULL,
  created_at   DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  KEY idx_kvr_nopen (nopen, created_at),
  CONSTRAINT fk_kvr_verifikasi FOREIGN KEY (nopen) REFERENCES klaim_verifikasi(nopen) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Item kurang per NOPEN → sasaran (DPJP via NIP / ruangan SIMGOS / peran).
-- Tertutup OTOMATIS saat data SIMRS sudah lengkap (dicek ulang read-only).
CREATE TABLE IF NOT EXISTS klaim_tindak_lanjut (
  id                VARCHAR(30)  NOT NULL PRIMARY KEY,
  nopen             VARCHAR(20)  NOT NULL,
  aturan            VARCHAR(40)  NOT NULL,                         -- kunci katalog aturan / 'manual' / 'koding'
  tahap             TINYINT      NOT NULL DEFAULT 1,
  pesan             VARCHAR(500) NOT NULL,
  sasaran_jenis     VARCHAR(10)  NOT NULL,                         -- DPJP / RUANGAN / PERAN
  sasaran_ref       VARCHAR(60)  NOT NULL,                         -- NIP / master.ruangan.ID / roles.key
  sasaran_nama      VARCHAR(191) NULL,
  status            VARCHAR(10)  NOT NULL DEFAULT 'OPEN',          -- OPEN / SELESAI / BATAL
  catatan           TEXT         NULL,
  dibuat_oleh_id    VARCHAR(191) NULL,
  dibuat_oleh_nama  VARCHAR(191) NULL,
  selesai_at        DATETIME(3)  NULL,
  selesai_cara      VARCHAR(10)  NULL,                             -- OTOMATIS / MANUAL / BATAL
  selesai_oleh_id   VARCHAR(191) NULL,
  selesai_oleh_nama VARCHAR(191) NULL,
  created_at        DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at        DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  KEY idx_ktl_nopen (nopen),
  KEY idx_ktl_sasaran (status, sasaran_jenis, sasaran_ref),
  CONSTRAINT fk_ktl_verifikasi FOREIGN KEY (nopen) REFERENCES klaim_verifikasi(nopen) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Usulan koreksi koding oleh coder (BUKAN ditulis ke SIMGOS). Status SESUAI
-- terdeteksi otomatis saat diagnosa/prosedur SIMGOS sudah sama dengan usulan.
CREATE TABLE IF NOT EXISTS klaim_koreksi_koding (
  id               VARCHAR(30)  NOT NULL PRIMARY KEY,
  nopen            VARCHAR(20)  NOT NULL,
  status           VARCHAR(16)  NOT NULL DEFAULT 'MENUNGGU_SIMRS', -- MENUNGGU_SIMRS / SESUAI / BATAL
  usulan           JSON         NOT NULL,                          -- {diagnosa:[{kode,utama}], prosedur:[{kode}]}
  simrs_awal       JSON         NOT NULL,                          -- snapshot SIMGOS saat usulan dibuat
  catatan          TEXT         NULL,
  bukti            JSON         NULL,                              -- log SIMGOS (OBJEK 21003) saat terdeteksi sesuai
  dibuat_oleh_id   VARCHAR(191) NULL,
  dibuat_oleh_nama VARCHAR(191) NULL,
  sesuai_at        DATETIME(3)  NULL,
  created_at       DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at       DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  KEY idx_kkk_nopen (nopen),
  KEY idx_kkk_status (status),
  CONSTRAINT fk_kkk_verifikasi FOREIGN KEY (nopen) REFERENCES klaim_verifikasi(nopen) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Dokumen sisipan paket klaim. Berkas fisik di volume storage (bukan BLOB DB).
CREATE TABLE IF NOT EXISTS klaim_lampiran (
  id                 VARCHAR(30)  NOT NULL PRIMARY KEY,
  nopen              VARCHAR(20)  NOT NULL,
  nama_berkas        VARCHAR(255) NOT NULL,
  mime               VARCHAR(100) NOT NULL,
  ukuran             INT          NOT NULL,
  sha256             CHAR(64)     NOT NULL,
  lokasi             VARCHAR(500) NOT NULL,
  halaman            INT          NULL,
  urutan             INT          NOT NULL DEFAULT 0,
  keterangan         VARCHAR(255) NULL,
  diunggah_oleh_id   VARCHAR(191) NULL,
  diunggah_oleh_nama VARCHAR(191) NULL,
  created_at         DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  dihapus_at         DATETIME(3)  NULL,
  dihapus_oleh_id    VARCHAR(191) NULL,
  KEY idx_kl_nopen (nopen),
  KEY idx_kl_sha (sha256),
  CONSTRAINT fk_kl_verifikasi FOREIGN KEY (nopen) REFERENCES klaim_verifikasi(nopen) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Paket klaim gabungan: satu per NOPEN (versi lama diganti; hash tiap versi di riwayat).
CREATE TABLE IF NOT EXISTS klaim_paket (
  id               VARCHAR(30)  NOT NULL PRIMARY KEY,
  nopen            VARCHAR(20)  NOT NULL,
  versi            INT          NOT NULL DEFAULT 1,
  status           VARCHAR(10)  NOT NULL DEFAULT 'DRAF',           -- DRAF / FINAL
  manifest         JSON         NOT NULL,                          -- urutan komponen + sisipan
  hash             CHAR(64)     NOT NULL,                          -- SHA-256 PDF gabungan
  halaman          INT          NOT NULL DEFAULT 0,
  ukuran           INT          NOT NULL DEFAULT 0,
  lokasi           VARCHAR(500) NULL,
  dibuat_oleh_id   VARCHAR(191) NULL,
  dibuat_oleh_nama VARCHAR(191) NULL,
  created_at       DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at       DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  UNIQUE KEY uq_kp_nopen (nopen),
  CONSTRAINT fk_kp_verifikasi FOREIGN KEY (nopen) REFERENCES klaim_verifikasi(nopen) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Notifikasi dalam aplikasi (GENERIK, bisa dipakai modul lain).
-- Sasaran: USER (users.id) / NIP (users.nip) / RUANGAN (akses ruangan SIMGOS) / PERAN (roles.key).
CREATE TABLE IF NOT EXISTS notifikasi (
  id             VARCHAR(30)  NOT NULL PRIMARY KEY,
  jenis          VARCHAR(40)  NOT NULL,                            -- mis. KLAIM_TINDAK_LANJUT
  judul          VARCHAR(191) NOT NULL,
  pesan          VARCHAR(500) NULL,
  tautan         VARCHAR(500) NULL,                                -- rute dalam aplikasi
  sasaran_jenis  VARCHAR(10)  NOT NULL,
  sasaran_ref    VARCHAR(191) NOT NULL,
  ref_tipe       VARCHAR(40)  NULL,
  ref_id         VARCHAR(60)  NULL,
  dibuat_oleh_id VARCHAR(191) NULL,
  created_at     DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  KEY idx_notif_sasaran (sasaran_jenis, sasaran_ref, created_at),
  KEY idx_notif_ref (ref_tipe, ref_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Status baca per pengguna (baris ada = sudah dibaca).
CREATE TABLE IF NOT EXISTS notifikasi_baca (
  notifikasi_id VARCHAR(30)  NOT NULL,
  user_id       VARCHAR(191) NOT NULL,
  dibaca_at     DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (notifikasi_id, user_id),
  KEY idx_notif_baca_user (user_id),
  CONSTRAINT fk_notif_baca_notif FOREIGN KEY (notifikasi_id) REFERENCES notifikasi(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

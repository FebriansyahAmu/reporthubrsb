-- ============================================================================
-- DDL LAPORAN RL → DB APLIKASI `reporthub` (RW). BUKAN SIMGOS.
-- Idempoten: CREATE TABLE IF NOT EXISTS (tanpa DROP → AMAN diulang).
-- Runner: scripts/db/migrate-laporan-rl.mjs (membaca file INI — sumber tunggal).
-- ============================================================================

-- Pemetaan ruang rawat inap SIMGOS (master.ruangan.ID, 9 digit) → jenis
-- pelayanan RL 3.2 SIRS 6 (master.refrl.ID). Pengganti master.rl32_ruangan_revisi
-- di SIMGOS yang berisi ID SMF sehingga SP LaporanRL32RuanganRevisi selalu
-- kosong (docs/analisis-rl32-ruangan-revisi.sql). rl_id NULL = ruangan sengaja
-- tidak dilaporkan; tanpa baris = belum dipetakan. pisah_dpjp = 1 → pasien di
-- ruangan ini dikelompokkan menurut SMF DPJP kunjungannya (rl32_smf_peta), SMF
-- tanpa pemetaan tetap ikut rl_id ruangan. Perubahan tercatat di audit_log.
CREATE TABLE IF NOT EXISTS rl32_ruangan_peta (
  ruangan_id        VARCHAR(10)  NOT NULL PRIMARY KEY,
  rl_id             INT          NULL,
  pisah_dpjp        TINYINT(1)   NOT NULL DEFAULT 0,
  ruangan_nama      VARCHAR(191) NOT NULL,
  diubah_oleh_id    VARCHAR(191) NULL,
  diubah_oleh_nama  VARCHAR(191) NULL,
  created_at        DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at        DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- SMF dokter (master.referensi JENIS 26 = master.pegawai.SMF milik DPJP
-- kunjungan, lewat master.dokter.NIP) → jenis pelayanan RL 3.2. Hanya berlaku
-- di ruangan ber-pisah_dpjp (mis. Interna yang juga merawat pasien Saraf/Bedah).
CREATE TABLE IF NOT EXISTS rl32_smf_peta (
  smf_id            SMALLINT     NOT NULL PRIMARY KEY,
  rl_id             INT          NOT NULL,
  smf_nama          VARCHAR(191) NOT NULL,
  diubah_oleh_id    VARCHAR(191) NULL,
  diubah_oleh_nama  VARCHAR(191) NULL,
  created_at        DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at        DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

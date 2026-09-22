-- ============================================================================
-- DDL referensi (manusiawi) modul REKAP KLAIM BPJS → DB APLIKASI `reporthub` (RW).
-- BUKAN SIMGOS. Idempoten: CREATE TABLE IF NOT EXISTS (tanpa DROP).
-- Runner: scripts/db/migrate-rekap-klaim.mjs
-- Uang = rupiah penuh (BIGINT). Enum disimpan sbg VARCHAR (divalidasi di app/Zod).
-- ============================================================================

-- Klaim INA-CBG's / Rujukan Ambulans (satu baris = satu entri rekap).
CREATE TABLE IF NOT EXISTS klaim_klaim (
  id                 VARCHAR(30)  NOT NULL PRIMARY KEY,
  nomor_klaim        VARCHAR(60)  NULL,
  jenis_klaim        VARCHAR(16)  NOT NULL DEFAULT 'REGULER',   -- REGULER / PENDING / SUSULAN
  jenis_layanan      VARCHAR(8)   NOT NULL DEFAULT 'RITL',       -- RITL / RJTL
  kategori           VARCHAR(20)  NOT NULL DEFAULT 'INA_CBGS',   -- INA_CBGS / RUJUKAN_AMBULANS
  bulan_pelayanan    TINYINT      NOT NULL,                      -- 1..12
  tahun_pelayanan    SMALLINT     NOT NULL,
  jumlah             BIGINT       NOT NULL DEFAULT 0,            -- nilai yang diterima / masuk rekening
  jumlah_diajukan    BIGINT       NULL,                         -- nilai pengajuan (utk selisih bayar)
  jumlah_kasus       INT          NULL,                         -- khusus pending & rujukan
  tgl_masuk_rekening DATE         NULL,
  status             VARCHAR(16)  NOT NULL DEFAULT 'SUBMITTED',  -- SUBMITTED/APPROVED/RECEIVED/PARTIAL/EXPIRED/REJECTED
  ref_ba             VARCHAR(100) NULL,
  catatan            TEXT         NULL,
  created_by         VARCHAR(191) NULL,
  updated_by         VARCHAR(191) NULL,
  created_at         DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at         DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  KEY idx_klaim_tahun (tahun_pelayanan),
  KEY idx_klaim_periode (tahun_pelayanan, bulan_pelayanan),
  KEY idx_klaim_jenis (jenis_klaim),
  KEY idx_klaim_layanan (jenis_layanan),
  KEY idx_klaim_kategori (kategori),
  KEY idx_klaim_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Potongan / adjustment terhadap sebuah klaim (AAK, kelebihan bayar, cicilan, dll).
CREATE TABLE IF NOT EXISTS klaim_potongan (
  id            VARCHAR(30)  NOT NULL PRIMARY KEY,
  klaim_id      VARCHAR(30)  NOT NULL,
  jenis         VARCHAR(24)  NOT NULL,   -- AAK / KELEBIHAN_BAYAR / VPK / POTONGAN_BERKALA / PENGEMBALIAN
  jumlah        BIGINT       NOT NULL DEFAULT 0,  -- nilai potongan (pengurang)
  cicilan_ke    INT          NULL,
  total_cicilan INT          NULL,
  ref_ba        VARCHAR(100) NULL,
  deskripsi     TEXT         NULL,
  tgl_terapkan  DATE         NULL,
  created_by    VARCHAR(191) NULL,
  created_at    DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at    DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  KEY idx_potongan_klaim (klaim_id),
  KEY idx_potongan_jenis (jenis),
  CONSTRAINT fk_klaim_potongan_klaim FOREIGN KEY (klaim_id) REFERENCES klaim_klaim(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

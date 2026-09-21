-- ============================================================================
-- Checklist Pemeliharaan Berkala PER BARANG (per ruangan).
-- Isi checklist = daftar unit barang di ruangan (dari Master Barang).
-- DB APLIKASI `reporthub` (RW). BUKAN SIMGOS. Referensi manusiawi.
-- Eksekusi resmi via scripts/db/migrate-inventaris-checklist.mjs (idempoten).
-- ============================================================================

-- Buang model lama (berbasis template butir tugas) bila ada.
DROP TABLE IF EXISTS inv_checklist_check;
DROP TABLE IF EXISTS inv_checklist_item;
DROP TABLE IF EXISTS inv_checklist_periksa;
DROP TABLE IF EXISTS inv_checklist_run;
DROP TABLE IF EXISTS inv_checklist_template;

CREATE TABLE IF NOT EXISTS inv_checklist_run (
  id          VARCHAR(30)  NOT NULL PRIMARY KEY,
  ruangan_id  VARCHAR(30)  NOT NULL,
  frekuensi   VARCHAR(16)  NOT NULL DEFAULT 'HARIAN',   -- HARIAN | MINGGUAN | BULANAN
  periode_key VARCHAR(16)  NOT NULL,                    -- YYYY-MM-DD | GGGG-Www | YYYY-MM
  selesai_at  DATETIME(3)  NULL,
  selesai_by  VARCHAR(191) NULL,
  catatan     TEXT         NULL,
  created_by  VARCHAR(191) NULL,
  updated_by  VARCHAR(191) NULL,
  created_at  DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at  DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  UNIQUE KEY uq_inv_cl_run (ruangan_id, frekuensi, periode_key),
  KEY idx_inv_cl_run_ruangan (ruangan_id),
  KEY idx_inv_cl_run_periode (periode_key),
  CONSTRAINT fk_inv_cl_run_ruangan FOREIGN KEY (ruangan_id) REFERENCES inv_ruangan(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS inv_checklist_periksa (
  id         VARCHAR(30)  NOT NULL PRIMARY KEY,
  run_id     VARCHAR(30)  NOT NULL,
  barang_id  VARCHAR(30)  NOT NULL,
  kondisi_id VARCHAR(30)  NULL,                          -- status kondisi hasil periksa
  catatan    TEXT         NULL,
  checked_by VARCHAR(191) NULL,
  checked_at DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE KEY uq_inv_cl_periksa (run_id, barang_id),
  KEY idx_inv_cl_periksa_run (run_id),
  KEY idx_inv_cl_periksa_barang (barang_id),
  CONSTRAINT fk_inv_cl_periksa_run FOREIGN KEY (run_id) REFERENCES inv_checklist_run(id) ON DELETE CASCADE,
  CONSTRAINT fk_inv_cl_periksa_barang FOREIGN KEY (barang_id) REFERENCES inv_barang(id) ON DELETE CASCADE,
  CONSTRAINT fk_inv_cl_periksa_kondisi FOREIGN KEY (kondisi_id) REFERENCES inv_kondisi(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================================
-- DDL Modul INVENTARISASI BARANG — DB APLIKASI `reporthub` (READ-WRITE). BUKAN SIMGOS.
-- Referensi manusiawi. Eksekusi sebenarnya (idempoten) via scripts/db/migrate-inventaris.mjs.
-- Lihat docs/inventarisasi-barang/BLUEPRINT.md.
-- ============================================================================

-- Referensi (Pengaturan) ------------------------------------------------------
CREATE TABLE IF NOT EXISTS inv_satuan (
  id         VARCHAR(30)  NOT NULL PRIMARY KEY,
  nama       VARCHAR(40)  NOT NULL,
  urutan     INT          NOT NULL DEFAULT 0,
  aktif      TINYINT(1)   NOT NULL DEFAULT 1,
  created_at DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  UNIQUE KEY uq_inv_satuan_nama (nama)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS inv_kondisi (
  id         VARCHAR(30)  NOT NULL PRIMARY KEY,
  nama       VARCHAR(60)  NOT NULL,
  kode       VARCHAR(10)  NOT NULL,
  tone       VARCHAR(20)  NOT NULL DEFAULT 'neutral',
  urutan     INT          NOT NULL DEFAULT 0,
  aktif      TINYINT(1)   NOT NULL DEFAULT 1,
  created_at DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  UNIQUE KEY uq_inv_kondisi_kode (kode)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS inv_sumber_anggaran (
  id         VARCHAR(30)  NOT NULL PRIMARY KEY,
  nama       VARCHAR(80)  NOT NULL,
  singkatan  VARCHAR(20)  NOT NULL,
  urutan     INT          NOT NULL DEFAULT 0,
  aktif      TINYINT(1)   NOT NULL DEFAULT 1,
  created_at DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  UNIQUE KEY uq_inv_sumber_singkatan (singkatan)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS inv_kategori (
  id         VARCHAR(30)  NOT NULL PRIMARY KEY,
  nama       VARCHAR(80)  NOT NULL,
  kode       VARCHAR(20)  NULL,
  urutan     INT          NOT NULL DEFAULT 0,
  aktif      TINYINT(1)   NOT NULL DEFAULT 1,
  created_at DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  UNIQUE KEY uq_inv_kategori_nama (nama)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS inv_ruangan (
  id          VARCHAR(30)  NOT NULL PRIMARY KEY,
  kode_prefix VARCHAR(15)  NOT NULL,
  nama        VARCHAR(120) NOT NULL,
  pj_nama     VARCHAR(120) NULL,
  pj_nip      VARCHAR(30)  NULL,
  urutan      INT          NOT NULL DEFAULT 0,
  aktif       TINYINT(1)   NOT NULL DEFAULT 1,
  created_at  DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at  DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  UNIQUE KEY uq_inv_ruangan_prefix (kode_prefix)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Aset ------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS inv_barang (
  id                 VARCHAR(30)  NOT NULL PRIMARY KEY,
  kode_barang        VARCHAR(40)  NOT NULL,
  register           INT          NULL,
  nama               VARCHAR(191) NOT NULL,
  merk               VARCHAR(191) NULL,
  nomor_seri         VARCHAR(100) NULL,
  kategori_id        VARCHAR(30)  NULL,
  sumber_anggaran_id VARCHAR(30)  NULL,
  satuan_id          VARCHAR(30)  NULL,
  kondisi_id         VARCHAR(30)  NULL,
  ruangan_id         VARCHAR(30)  NOT NULL,
  tahun_perolehan    SMALLINT     NULL,
  tgl_perolehan      DATE         NULL,
  harga              BIGINT       NULL,
  status_aset        VARCHAR(20)  NOT NULL DEFAULT 'AKTIF',
  foto_url           VARCHAR(500) NULL,
  keterangan         TEXT         NULL,
  created_by         VARCHAR(30)  NULL,
  updated_by         VARCHAR(30)  NULL,
  created_at         DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at         DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  UNIQUE KEY uq_inv_barang_kode (kode_barang),
  KEY idx_inv_barang_ruangan (ruangan_id),
  KEY idx_inv_barang_kondisi (kondisi_id),
  KEY idx_inv_barang_kategori (kategori_id),
  KEY idx_inv_barang_status (status_aset),
  KEY idx_inv_barang_tahun (tahun_perolehan),
  CONSTRAINT fk_inv_barang_ruangan FOREIGN KEY (ruangan_id) REFERENCES inv_ruangan(id) ON DELETE RESTRICT,
  CONSTRAINT fk_inv_barang_kondisi FOREIGN KEY (kondisi_id) REFERENCES inv_kondisi(id) ON DELETE SET NULL,
  CONSTRAINT fk_inv_barang_kategori FOREIGN KEY (kategori_id) REFERENCES inv_kategori(id) ON DELETE SET NULL,
  CONSTRAINT fk_inv_barang_satuan FOREIGN KEY (satuan_id) REFERENCES inv_satuan(id) ON DELETE SET NULL,
  CONSTRAINT fk_inv_barang_sumber FOREIGN KEY (sumber_anggaran_id) REFERENCES inv_sumber_anggaran(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS inv_pemeliharaan (
  id                     VARCHAR(30)  NOT NULL PRIMARY KEY,
  barang_id              VARCHAR(30)  NOT NULL,
  tanggal                DATE         NOT NULL,
  jenis                  VARCHAR(20)  NOT NULL DEFAULT 'RUTIN',
  hasil                  VARCHAR(30)  NULL,
  kondisi_sesudah_id     VARCHAR(30)  NULL,
  petugas                VARCHAR(191) NULL,
  biaya                  BIGINT       NULL,
  catatan                TEXT         NULL,
  jatuh_tempo_berikutnya DATE         NULL,
  created_by             VARCHAR(30)  NULL,
  created_at             DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at             DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  KEY idx_inv_pem_barang (barang_id),
  KEY idx_inv_pem_tanggal (tanggal),
  CONSTRAINT fk_inv_pem_barang FOREIGN KEY (barang_id) REFERENCES inv_barang(id) ON DELETE CASCADE,
  CONSTRAINT fk_inv_pem_kondisi FOREIGN KEY (kondisi_sesudah_id) REFERENCES inv_kondisi(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS inv_mutasi (
  id             VARCHAR(30)  NOT NULL PRIMARY KEY,
  barang_id      VARCHAR(30)  NOT NULL,
  dari_ruangan_id VARCHAR(30) NULL,
  ke_ruangan_id  VARCHAR(30)  NOT NULL,
  tanggal        DATE         NOT NULL,
  alasan         VARCHAR(255) NULL,
  oleh           VARCHAR(191) NULL,
  created_by     VARCHAR(30)  NULL,
  created_at     DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  KEY idx_inv_mutasi_barang (barang_id),
  CONSTRAINT fk_inv_mutasi_barang FOREIGN KEY (barang_id) REFERENCES inv_barang(id) ON DELETE CASCADE,
  CONSTRAINT fk_inv_mutasi_dari FOREIGN KEY (dari_ruangan_id) REFERENCES inv_ruangan(id) ON DELETE SET NULL,
  CONSTRAINT fk_inv_mutasi_ke FOREIGN KEY (ke_ruangan_id) REFERENCES inv_ruangan(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

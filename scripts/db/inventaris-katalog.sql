-- ============================================================================
-- DDL ADITIF Katalog Item — DB APLIKASI `reporthub` (RW). BUKAN SIMGOS.
-- Referensi manusiawi. Eksekusi idempoten via scripts/db/migrate-inventaris-katalog.mjs.
-- Katalog (jenis barang) 1 : N unit fisik (inv_barang). nama_key = nama ternormalkan (unik).
-- ============================================================================

CREATE TABLE IF NOT EXISTS inv_item (
  id          VARCHAR(30)  NOT NULL PRIMARY KEY,
  nama        VARCHAR(191) NOT NULL,               -- nama baku (tampil)
  nama_key    VARCHAR(191) NOT NULL,               -- nama dinormalkan (UPPER, spasi rapat) → kunci unik
  kategori_id VARCHAR(30)  NULL,
  satuan_id   VARCHAR(30)  NULL,                    -- satuan default
  spesifikasi TEXT         NULL,
  aktif       TINYINT(1)   NOT NULL DEFAULT 1,
  created_by  VARCHAR(30)  NULL,
  updated_by  VARCHAR(30)  NULL,
  created_at  DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at  DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  UNIQUE KEY uq_inv_item_key (nama_key),
  KEY idx_inv_item_kategori (kategori_id),
  KEY idx_inv_item_satuan (satuan_id),
  CONSTRAINT fk_inv_item_kategori FOREIGN KEY (kategori_id) REFERENCES inv_kategori(id) ON DELETE SET NULL,
  CONSTRAINT fk_inv_item_satuan   FOREIGN KEY (satuan_id)   REFERENCES inv_satuan(id)   ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Tautan unit → katalog (aditif, nullable, kompatibel mundur):
ALTER TABLE inv_barang ADD COLUMN item_id VARCHAR(30) NULL AFTER nama;
ALTER TABLE inv_barang ADD INDEX idx_inv_barang_item (item_id);
ALTER TABLE inv_barang ADD CONSTRAINT fk_inv_barang_item FOREIGN KEY (item_id) REFERENCES inv_item(id) ON DELETE SET NULL;

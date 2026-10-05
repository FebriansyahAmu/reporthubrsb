-- ============================================================================
-- Tautan publik (QR) daftar barang per ruangan — ADITIF.
-- DB APLIKASI `reporthub` (RW). BUKAN SIMGOS. Referensi manusiawi.
-- Eksekusi resmi via scripts/db/migrate-inventaris-publik.mjs (idempoten).
--
-- Satu baris per ruangan. `token` = kapabilitas acak 192-bit (base64url, 32
-- karakter) yang di-encode ke QR → halaman publik /ruang/<token> tanpa login.
-- Kolom token ber-collation ascii_bin agar pencocokan PEKA huruf besar/kecil
-- (collation default *_ci membuat "Ab" = "aB" → entropi turun & bentrok unik).
-- Token disimpan apa adanya (bukan hash): data yang dibukanya ada di DB yang
-- sama, dan petugas perlu mencetak ulang QR yang sama.
-- ============================================================================

CREATE TABLE IF NOT EXISTS inv_ruangan_publik (
  ruangan_id   VARCHAR(30)  NOT NULL PRIMARY KEY,
  token        CHAR(32) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  aktif        TINYINT(1)   NOT NULL DEFAULT 1,
  dibuat_oleh  VARCHAR(191) NULL,
  diubah_oleh  VARCHAR(191) NULL,
  created_at   DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at   DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  UNIQUE KEY uq_inv_ruangan_publik_token (token),
  CONSTRAINT fk_inv_ruangan_publik_ruangan FOREIGN KEY (ruangan_id) REFERENCES inv_ruangan(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

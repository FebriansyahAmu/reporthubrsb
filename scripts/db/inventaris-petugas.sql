-- ============================================================================
-- Petugas ruangan (akun ↔ ruangan) — ADITIF.
-- DB APLIKASI `reporthub` (RW). BUKAN SIMGOS. Referensi manusiawi.
-- Eksekusi resmi via scripts/db/migrate-inventaris-petugas.mjs (idempoten).
--
-- Dipakai Checklist Pemeliharaan untuk memilih ruangan petugas yang login
-- ("Ruangan saya"). Akun yang NIP-nya sama dengan NIP PJ ruangan juga dianggap
-- petugas ruangan itu — itu dihitung di aplikasi, tidak disimpan di sini.
--
-- KOLASI: `inv_ruangan.id` dan `users.id` berbeda kolasi di DB ini
-- (utf8mb4_0900_ai_ci vs utf8mb4_unicode_ci). Kolom FK WAJIB berkolasi sama
-- dengan kolom yang dirujuk, jadi kolasi tiap kolom kunci ditulis eksplisit.
-- Skrip migrasi membaca kolasi & tipe sebenarnya dari information_schema,
-- sehingga tetap benar bila server lain memakai kolasi bawaan berbeda.
-- ============================================================================

CREATE TABLE IF NOT EXISTS inv_ruangan_petugas (
  ruangan_id   VARCHAR(30) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  user_id      VARCHAR(30) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  dibuat_oleh  VARCHAR(191) NULL,
  created_at   DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (ruangan_id, user_id),
  KEY idx_inv_ruangan_petugas_user (user_id),
  CONSTRAINT fk_inv_ruangan_petugas_ruangan FOREIGN KEY (ruangan_id) REFERENCES inv_ruangan(id) ON DELETE CASCADE,
  CONSTRAINT fk_inv_ruangan_petugas_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

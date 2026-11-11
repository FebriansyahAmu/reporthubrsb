-- ============================================================================
-- DDL FORM RM TERPADU (isian v2) → DB APLIKASI `reporthub` (RW). BUKAN SIMGOS.
-- SIMGOS tetap READ-ONLY: isian, tanda tangan & riwayat disimpan di sini.
-- Idempoten: CREATE TABLE IF NOT EXISTS (tanpa DROP → AMAN diulang).
-- Runner: scripts/db/migrate-form-rm.mjs (membaca file INI — sumber tunggal).
-- PRD: docs/PRD_Form_RM_Terpadu.md §8.5. Enum disimpan VARCHAR (divalidasi Zod).
-- *_oleh_id = users.id pelaku; oleh_nama = snapshot nama (riwayat tetap terbaca).
-- ============================================================================

-- Satu baris per isian formulir. Unik (form_kode, subjek, urutan): form tidak
-- berulang → satu isian aktif per subjek; isian BATAL tidak dihapus, isian
-- pengganti memakai urutan berikutnya. `rev` naik di SETIAP tulis
-- (konkurensi optimistis). Identitas pasien = snapshot SIMGOS dari server.
CREATE TABLE IF NOT EXISTS form_rm_isian (
  id                  VARCHAR(30)  NOT NULL PRIMARY KEY,
  form_kode           VARCHAR(20)  NOT NULL,                    -- RM.04 / RM.21 / …
  form_versi          SMALLINT     NOT NULL,
  subjek              VARCHAR(30)  NOT NULL,                    -- NOPEN / nomor KUNJUNGAN sesuai cakupan form
  nopen               VARCHAR(20)  NOT NULL,
  kunjungan           VARCHAR(30)  NULL,
  urutan              SMALLINT     NOT NULL DEFAULT 1,
  norm                VARCHAR(20)  NOT NULL,
  nama_pasien         VARCHAR(191) NOT NULL,
  ruang               VARCHAR(191) NULL,
  status              VARCHAR(10)  NOT NULL DEFAULT 'DRAF',     -- DRAF / FINAL / BATAL
  rev                 INT          NOT NULL DEFAULT 1,
  data                JSON         NOT NULL,                    -- TTD hanya referensi "ttd:<id>"
  asal                JSON         NULL,                        -- path kolom yang terisi otomatis dari SIMRS
  dibuat_oleh_id      VARCHAR(191) NULL,
  diubah_oleh_id      VARCHAR(191) NULL,
  difinalkan_oleh_id  VARCHAR(191) NULL,
  difinalkan_at       DATETIME(3)  NULL,
  created_at          DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at          DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  UNIQUE KEY uq_form_rm_isian (form_kode, subjek, urutan),
  KEY idx_form_rm_isian_nopen (nopen),
  KEY idx_form_rm_isian_norm (norm),
  KEY idx_form_rm_isian_status (form_kode, status, updated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Gambar tanda tangan (PNG dinormalkan server). Sekali tulis, tidak pernah
-- diubah; isian & revisi hanya merujuk id-nya. Unik per (isian, sha256): TTD
-- yang sama dipakai ulang (mis. "Pakai TTD sebelumnya") tidak digandakan.
CREATE TABLE IF NOT EXISTS form_rm_ttd (
  id              VARCHAR(30)  NOT NULL PRIMARY KEY,
  isian_id        VARCHAR(30)  NOT NULL,
  slot            VARCHAR(60)  NOT NULL,                        -- slot pertama, mis. entries.2.sasaranTtd
  png             MEDIUMBLOB   NOT NULL,
  sha256          CHAR(64)     NOT NULL,
  ukuran          INT          NOT NULL,
  dibuat_oleh_id  VARCHAR(191) NULL,
  created_at      DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE KEY uq_form_rm_ttd (isian_id, sha256),
  CONSTRAINT fk_form_rm_ttd_isian FOREIGN KEY (isian_id) REFERENCES form_rm_isian(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Revisi = snapshot lengkap di setiap transisi status (FINALKAN / BUKA_KOREKSI /
-- BATALKAN). APPEND-ONLY. `hash` = HMAC-SHA256 atas isi revisi + hash_sebelum
-- (rantai per isian; kunci FORM_RM_KUNCI_INTEGRITAS) → perubahan langsung di DB
-- terdeteksi. created_at diisi aplikasi karena ikut disegel.
CREATE TABLE IF NOT EXISTS form_rm_revisi (
  id            VARCHAR(30)  NOT NULL PRIMARY KEY,
  isian_id      VARCHAR(30)  NOT NULL,
  rev           INT          NOT NULL,                          -- rev isian SETELAH transisi
  aksi          VARCHAR(20)  NOT NULL,
  status        VARCHAR(10)  NOT NULL,                          -- status SETELAH transisi
  data          JSON         NOT NULL,
  alasan        VARCHAR(500) NULL,
  oleh_id       VARCHAR(191) NULL,
  oleh_nama     VARCHAR(191) NULL,
  hash          CHAR(64)     NOT NULL,
  hash_sebelum  CHAR(64)     NULL,
  created_at    DATETIME(3)  NOT NULL,
  UNIQUE KEY uq_form_rm_revisi (isian_id, rev),
  CONSTRAINT fk_form_rm_revisi_isian FOREIGN KEY (isian_id) REFERENCES form_rm_isian(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Identitas sementara isian yang dibuat SEBELUM pasien terdaftar di SIMRS (mis.
-- triase pasien yang baru tiba di IGD). Selama belum tertaut, isian memakai
-- subjek "~<token>" dan nopen/norm kosong. Saat ditautkan, isian pindah ke NOPEN
-- pasien; baris ini tetap disimpan sebagai jejak (siapa ditriase sebagai apa,
-- ditautkan oleh siapa & kapan). Satu baris per isian.
CREATE TABLE IF NOT EXISTS form_rm_identitas_sementara (
  isian_id             VARCHAR(30)  NOT NULL PRIMARY KEY,
  sebutan              VARCHAR(60)  NOT NULL,                    -- nama / sebutan, mis. "Tn. X"
  jenis_kelamin        VARCHAR(1)   NOT NULL DEFAULT '',         -- L / P / '' (tidak diketahui)
  perkiraan_umur       VARCHAR(30)  NOT NULL DEFAULT '',
  ciri                 VARCHAR(300) NOT NULL DEFAULT '',         -- ciri fisik / keterangan kedatangan
  ditautkan_at         DATETIME(3)  NULL,
  ditautkan_oleh_id    VARCHAR(191) NULL,
  ditautkan_oleh_nama  VARCHAR(191) NULL,
  created_at           DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at           DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  CONSTRAINT fk_form_rm_identitas_sementara_isian FOREIGN KEY (isian_id) REFERENCES form_rm_isian(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- TTD tersimpan MILIK PETUGAS (pengguna login) untuk dipakai ulang di slot
-- petugas/dokter/saksi. Satu baris per (pengguna, jenis): TTD & PARAF. Hanya
-- pemiliknya yang bisa membaca/memakai. Saat dipakai, PNG DISALIN ke
-- form_rm_ttd isian (rekam medis tak ikut berubah bila TTD ini diganti/dihapus).
-- Pengguna dihapus → TTD tersimpannya ikut terhapus (data pribadi).
CREATE TABLE IF NOT EXISTS form_rm_ttd_petugas (
  id          VARCHAR(30)  NOT NULL PRIMARY KEY,
  user_id     VARCHAR(30)  NOT NULL,                            -- = users.id
  jenis       VARCHAR(10)  NOT NULL,                            -- TTD / PARAF
  png         MEDIUMBLOB   NOT NULL,
  sha256      CHAR(64)     NOT NULL,
  ukuran      INT          NOT NULL,
  created_at  DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at  DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  UNIQUE KEY uq_form_rm_ttd_petugas (user_id, jenis),
  CONSTRAINT fk_form_rm_ttd_petugas_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Perangkat TTD SIAGA: tablet/HP RS yang selalu siap menerima permintaan TTD
-- dari PC petugas (docs/PRD_TTD_Perangkat_Siaga.md §7.5). Kredensial perangkat
-- HANYA disimpan sebagai sha256 (token mentah tak pernah disimpan); token lama
-- disimpan sebentar setelah rotasi (jendela grasi). Dicabut = aktif 0 + hash
-- NULL; baris tetap ada sebagai jejak dan bisa dipasang ulang. ruangan_id =
-- master.ruangan.ID SIMGOS (referensi lunak, tanpa FK lintas DB).
CREATE TABLE IF NOT EXISTS form_rm_perangkat_ttd (
  id                 VARCHAR(30)  NOT NULL PRIMARY KEY,
  nama               VARCHAR(80)  NOT NULL,
  ruangan_id         VARCHAR(10)  NULL,
  token_hash         CHAR(64)     NULL,                           -- sha256 kredensial aktif; NULL = belum/tidak terpasang
  token_hash_lama    CHAR(64)     NULL,                           -- kredensial sebelum rotasi terakhir
  token_diputar_at   DATETIME(3)  NULL,
  aktif              TINYINT(1)   NOT NULL DEFAULT 1,
  dipasang_at        DATETIME(3)  NULL,
  terakhir_aktif_at  DATETIME(3)  NULL,                           -- ditulis saat sambung/putus, bukan tiap detak
  dicabut_at         DATETIME(3)  NULL,
  dibuat_oleh_id     VARCHAR(191) NULL,
  created_at         DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at         DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  UNIQUE KEY uq_form_rm_perangkat_ttd_nama (nama),
  UNIQUE KEY uq_form_rm_perangkat_ttd_token (token_hash),
  KEY idx_form_rm_perangkat_ttd_lama (token_hash_lama)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tautan episode RAWAT INAP (lanjutan) → episode IGD asal (akar) untuk form
-- berlanjut (RM.03/RM.21/RM.01; docs/PRD_Form_RM_Berlanjut_IGD_RI.md §8.2).
-- SIMGOS memberi NOPEN baru saat pasien IGD dirawat inap; isian bersama disimpan
-- di episode akar. dasar: SPRI (otomatis) / WAKTU (pendaftaran IGD ≤ 24 jam,
-- dikonfirmasi petugas) / TANPA (petugas memilih isian terpisah, nopen_akar NULL).
-- aktif_kunci = nopen_lanjutan selama aktif, NULL setelah dilepas → paling banyak
-- satu tautan aktif per episode lanjutan (MariaDB tanpa indeks unik parsial).
-- Baris tak pernah dihapus: pelepasan dicatat (oleh, kapan, alasan).
CREATE TABLE IF NOT EXISTS form_rm_tautan_episode (
  id                 VARCHAR(30)  NOT NULL PRIMARY KEY,
  nopen_lanjutan     VARCHAR(20)  NOT NULL,                       -- episode RI
  nopen_akar         VARCHAR(20)  NULL,                           -- episode IGD; NULL bila dasar = TANPA
  norm               VARCHAR(20)  NOT NULL,                       -- snapshot, sama di kedua episode
  dasar              VARCHAR(10)  NOT NULL,                       -- SPRI / WAKTU / TANPA
  aktif_kunci        VARCHAR(20)  NULL,
  dibuat_oleh_id     VARCHAR(191) NULL,
  dibuat_oleh_nama   VARCHAR(191) NULL,
  created_at         DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  dilepas_at         DATETIME(3)  NULL,
  dilepas_oleh_id    VARCHAR(191) NULL,
  dilepas_oleh_nama  VARCHAR(191) NULL,
  alasan_lepas       VARCHAR(500) NULL,
  UNIQUE KEY uq_form_rm_tautan_episode_aktif (aktif_kunci),
  KEY idx_form_rm_tautan_episode_akar (nopen_akar),
  KEY idx_form_rm_tautan_episode_lanjutan (nopen_lanjutan)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Log perubahan isian per kolom (form berlanjut; PRD §8.4). Satu entri per simpan
-- yang benar-benar mengubah kolom; entri TERAKHIR boleh digabung (orang & konteks
-- sama, ≤ 5 menit) → nilai sebelum paling awal tetap tercatat. perubahan =
-- [{ p: path, s: sebelum, j: sesudah }] (TTD = referensi "ttd:<id>"). hash =
-- HMAC-SHA256 berantai per isian (kunci FORM_RM_KUNCI_INTEGRITAS, domain terpisah
-- dari segel revisi). created_at/updated_at diisi aplikasi karena ikut disegel.
CREATE TABLE IF NOT EXISTS form_rm_isian_log (
  id             VARCHAR(30)  NOT NULL PRIMARY KEY,
  isian_id       VARCHAR(30)  NOT NULL,
  urut           INT          NOT NULL,
  rev_awal       INT          NOT NULL,
  rev_akhir      INT          NOT NULL,
  aksi           VARCHAR(20)  NOT NULL,                           -- SIMPAN / TIMPA / MUAT_SIMRS / BEKU_TERTAUT
  oleh_id        VARCHAR(191) NULL,
  oleh_nama      VARCHAR(191) NULL,
  konteks_nopen  VARCHAR(20)  NOT NULL,
  konteks_unit   VARCHAR(3)   NOT NULL,                           -- IGD / RI / RJ
  konteks_ruang  VARCHAR(191) NULL,
  perubahan      JSON         NOT NULL,
  hash           CHAR(64)     NOT NULL,
  hash_sebelum   CHAR(64)     NULL,
  created_at     DATETIME(3)  NOT NULL,
  updated_at     DATETIME(3)  NOT NULL,
  UNIQUE KEY uq_form_rm_isian_log (isian_id, urut),
  KEY idx_form_rm_isian_log_waktu (isian_id, created_at),
  CONSTRAINT fk_form_rm_isian_log_isian FOREIGN KEY (isian_id) REFERENCES form_rm_isian(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

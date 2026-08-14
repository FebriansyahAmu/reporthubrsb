-- ============================================================================
-- RBAC DDL — DB APLIKASI `reporthub` (READ-WRITE, milik kita). BUKAN SIMGOS.
-- Referensi manusiawi. Eksekusi sebenarnya (idempoten + conditional ALTER) via
-- scripts/db/seed-rbac.mjs. Lihat docs/rbac/01-model-data.md §6.
-- ============================================================================

CREATE TABLE IF NOT EXISTS roles (
  id            VARCHAR(30)  NOT NULL PRIMARY KEY,
  `key`         VARCHAR(40)  NOT NULL,
  name          VARCHAR(80)  NOT NULL,
  description   VARCHAR(255) NULL,
  is_system     TINYINT(1)   NOT NULL DEFAULT 0,
  is_superadmin TINYINT(1)   NOT NULL DEFAULT 0,
  created_at    DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at    DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE KEY uq_roles_key (`key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS role_permissions (
  id         VARCHAR(30) NOT NULL PRIMARY KEY,
  role_id    VARCHAR(30) NOT NULL,
  module_key VARCHAR(60) NOT NULL,
  action     VARCHAR(20) NOT NULL DEFAULT 'view',
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE KEY uq_role_module_action (role_id, module_key, action),
  KEY idx_rp_role (role_id),
  CONSTRAINT fk_rp_role FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS audit_log (
  id         VARCHAR(30)  NOT NULL PRIMARY KEY,
  actor_id   VARCHAR(30)  NULL,
  actor_name VARCHAR(191) NULL,
  action     VARCHAR(60)  NOT NULL,
  target_id  VARCHAR(30)  NULL,
  metadata   JSON         NULL,
  ip         VARCHAR(64)  NULL,
  created_at DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  KEY idx_audit_actor (actor_id),
  KEY idx_audit_action (action)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Kolom baru users (jalankan hanya bila belum ada — lihat seed-rbac.mjs):
-- ALTER TABLE users
--   ADD COLUMN role_id VARCHAR(30) NULL AFTER password_hash,
--   ADD COLUMN nik VARCHAR(16) NULL, ADD COLUMN nip VARCHAR(30) NULL,
--   ADD COLUMN gelar_depan VARCHAR(30) NULL, ADD COLUMN gelar_belakang VARCHAR(40) NULL,
--   ADD COLUMN tanggal_lahir DATE NULL, ADD COLUMN agama VARCHAR(30) NULL,
--   ADD COLUMN phone VARCHAR(20) NULL,
--   ADD COLUMN must_change_password TINYINT(1) NOT NULL DEFAULT 1,
--   ADD COLUMN created_by VARCHAR(30) NULL, ADD COLUMN updated_by VARCHAR(30) NULL,
--   ADD UNIQUE KEY uq_users_nik (nik);
-- Setelah backfill role_id: ALTER TABLE users MODIFY role_id VARCHAR(30) NOT NULL,
--   ADD CONSTRAINT fk_users_role FOREIGN KEY (role_id) REFERENCES roles(id);

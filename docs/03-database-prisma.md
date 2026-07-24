# 03 — Database, Prisma & Stored Procedure

Dokumen ini menjelaskan cara aman mengakses SIMGOS (multi-database, read-only),
setup dua Prisma client, pola pemanggilan stored procedure, serta penegakan
**HIGH ALERT**.

---

## 1. 🚨 Penegakan HIGH ALERT (Berlapis)

> **DILARANG menambah/mengubah tabel atau menulis data ke SIMGOS.**

### Lapis 1 — User MySQL read-only (penegakan terkuat, di level DB)

Buat user khusus untuk aplikasi ini yang **secara fisik tidak bisa** menulis atau
mengubah struktur. Ini jaminan sebenarnya — kalaupun ada bug/kode nakal, DB akan
menolak.

```sql
-- Dijalankan oleh DBA SIMGOS (contoh; sesuaikan daftar database & host).
CREATE USER 'reporthub_ro'@'%' IDENTIFIED BY '******';

-- Hanya SELECT + EXECUTE (untuk memanggil stored procedure), TANPA DDL/DML lain.
-- Database yang dikonfirmasi dipakai (lihat src/server/db/simgos-databases.ts):
GRANT SELECT, EXECUTE ON `medicalrecord`.*  TO 'reporthub_ro'@'%';
GRANT SELECT, EXECUTE ON `pendaftaran`.*    TO 'reporthub_ro'@'%';
GRANT SELECT, EXECUTE ON `layanan`.*        TO 'reporthub_ro'@'%';
GRANT SELECT, EXECUTE ON `report`.*         TO 'reporthub_ro'@'%';
-- ... tambah database SIMGOS lain di sini bila report baru membutuhkannya ...

FLUSH PRIVILEGES;
```

> 🔐 **Jangan pakai user `admin`/root untuk koneksi ini.** Sekalipun kode kita
> tidak pernah menulis, user yang punya hak tulis membatalkan proteksi Lapis 1.
> Buat user khusus read-only seperti di atas agar DB **secara fisik** menolak
> penulisan — inilah jaminan HIGH ALERT yang sebenarnya.

> ⚠️ **Jangan** beri `INSERT/UPDATE/DELETE/CREATE/ALTER/DROP` ke user ini.
> Jika suatu stored procedure SIMGOS ternyata menulis (mis. mencatat log akses),
> catat sebagai risiko dan **konfirmasi ke tim SIMGOS** sebelum dipakai — bila SP
> menulis, kita cari alternatif query murni baca.

### Lapis 2 — Prisma tidak pernah migrasi SIMGOS

- Schema SIMGOS **hanya** dihasilkan lewat `prisma db pull` (introspect).
- **Perintah terlarang** untuk schema SIMGOS: `prisma migrate *`, `prisma db push`.
- Script npm dibuat sedemikian rupa sehingga tidak ada jalur yang menargetkan
  schema SIMGOS untuk migrasi.

### Lapis 3 — State aplikasi tidak menyentuh SIMGOS

Semua data milik kita (user, audit, config) ada di **DB aplikasi** terpisah.

### Lapis 4 — Proses (CI & review)

- CI menjalankan cek: tidak ada pemanggilan write API Prisma pada client `simgos`
  (`create`, `update`, `delete`, `$executeRaw*`, `upsert`) — lihat guard di §6.
- PR yang menyentuh `prisma/simgos/**` selain hasil `db pull` wajib review khusus.

---

## 2. Topologi SIMGOS Multi-Database

SIMGOS klasik memisah domain ke banyak database dalam satu server MySQL, mis.:

| Database | Isi (perkiraan — konfirmasi saat discovery) |
|---|---|
| `medicalrecord` | Rekam medis: anamnesis, diagnosis, tindakan, SP `CetakMR2` |
| `pendaftaran` | Pendaftaran & kunjungan pasien (dipakai sbg anchor koneksi) |
| `layanan` | Layanan/tindakan medis |
| `report` | Data/agregat report bawaan SIMGOS (read-only) |
| `master`, `bpjs`, ... | Domain lain — tambah bila diperlukan |

> Keempat DB pertama sudah dikonfirmasi sebagai sumber read-only dan terdaftar di
> `src/server/db/simgos-databases.ts` (konstanta `SIMGOS_DB`).

**Implikasi:**
- Query lintas-database memakai nama ter-kualifikasi: `SELECT ... FROM pendaftaran.kunjungan k JOIN master.pasien p ON ...`.
- User `reporthub_ro` harus punya `SELECT` di semua database yang dipakai report.
- Prisma `db pull` bekerja **per-database** (satu datasource = satu database).
  Karena itu, akses lintas-DB untuk report **mengandalkan raw SQL**, bukan model
  Prisma. Model Prisma tetap berguna untuk tabel dalam satu DB yang sering dipakai.

### Langkah Discovery (wajib di awal implementasi)

Sebelum menulis DAL, petakan dulu isi SIMGOS (semua read-only):

```sql
-- 1) Daftar database
SHOW DATABASES;

-- 2) Stored procedure yang tersedia (per database)
SELECT ROUTINE_SCHEMA, ROUTINE_NAME, ROUTINE_TYPE
FROM information_schema.ROUTINES
WHERE ROUTINE_TYPE = 'PROCEDURE'
ORDER BY ROUTINE_SCHEMA, ROUTINE_NAME;

-- 3) Parameter sebuah stored procedure
SELECT PARAMETER_NAME, DATA_TYPE, PARAMETER_MODE, ORDINAL_POSITION
FROM information_schema.PARAMETERS
WHERE SPECIFIC_NAME = 'nama_sp' AND SPECIFIC_SCHEMA = 'nama_db'
ORDER BY ORDINAL_POSITION;

-- 4) Kolom sebuah tabel
SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = 'pendaftaran' AND TABLE_NAME = 'kunjungan'
ORDER BY ORDINAL_POSITION;
```

> Hasil discovery didokumentasikan (mis. `docs/reference/simgos-map.md`) dan
> menjadi acuan menulis SP Registry & DAL. **Nama tabel/kolom/SP di workflow masih
> placeholder sampai discovery selesai.**

---

## 3. Environment

`.env` (jangan commit; sediakan `.env.example`):

```env
# --- SIMGOS: READ-ONLY. User hanya punya SELECT + EXECUTE. ---
# Satu database "utama" sebagai anchor koneksi; query lintas-DB pakai db.tabel.
DATABASE_URL_SIMGOS="mysql://reporthub_ro:PASSWORD@SIMGOS_HOST:3306/pendaftaran"

# --- DB Aplikasi: milik kita, read-write. ---
DATABASE_URL_APP="mysql://reporthub_app:PASSWORD@APP_HOST:3306/reporthub_app"
```

> Database di URL SIMGOS hanya menentukan **default schema** koneksi. Selama user
> punya hak `SELECT` pada database lain, query `db_lain.tabel` tetap jalan.

---

## 3a. ⚙️ Catatan Prisma 7 (implementasi aktual)

Repo ini memakai **Prisma 7**, yang berbeda dari contoh historis di bawah:

- **`datasource` di schema TIDAK lagi punya `url`.** Koneksi runtime lewat
  **driver adapter** (`@prisma/adapter-mariadb`, kompatibel MySQL) yang di-pass ke
  `new PrismaClient({ adapter })`. URL untuk CLI (`db pull`) ada di
  **`prisma.config.ts`**, dibaca dari `.env`.
- **Generator** memakai `provider = "prisma-client"` (output TS/ESM) → `src/generated/simgos`.
- **Schema SIMGOS sengaja tanpa `model`.** Fitur cetak hanya butuh stored procedure
  read-only, jadi tak perlu introspect struktur tabel. Client tetap punya
  `$queryRaw*` untuk `CALL`. Tambah model hanya bila perlu, lewat `db pull` saja.
- **Client di-generate**, bukan di-commit (lihat `.gitignore`), via
  `npm run db:simgos:generate` (juga `postinstall`).
- Instansiasi client bersifat **lazy + singleton**: tidak konek ke DB sampai query
  pertama, sehingga aman diimport meski `.env` belum diisi (fallback ke data mock).

Contoh di §4 di bawah masih menampilkan pola lama (`url` di schema,
`prisma-client-js`) sebagai konteks; **acuan yang benar adalah catatan ini** dan
file `prisma/simgos/schema.prisma`, `prisma.config.ts`, `src/server/db/*`.

---

## 4. Dua Prisma Client Terpisah

### 4.1 Schema files

**`prisma/simgos/schema.prisma`** — hasil `db pull`, read-only:

```prisma
generator client {
  provider = "prisma-client-js"
  output   = "../../src/generated/simgos"   // client terpisah
}

datasource db {
  provider = "mysql"
  url      = env("DATABASE_URL_SIMGOS")
}

// Model di bawah ini DIISI OLEH `prisma db pull` (introspection).
// JANGAN diedit manual untuk mengubah struktur. JANGAN dibuat migrasi.
```

**`prisma/app/schema.prisma`** — milik kita, dengan migrasi:

```prisma
generator client {
  provider = "prisma-client-js"
  output   = "../../src/generated/app"
}

datasource db {
  provider = "mysql"
  url      = env("DATABASE_URL_APP")
}

// Model aplikasi kita definisikan & migrasikan sendiri (lihat §7).
```

### 4.2 Instansiasi client (singleton, aman untuk dev hot-reload)

**`src/server/db/simgos.client.ts`**

```ts
import { PrismaClient } from "@/generated/simgos";

const globalForSimgos = globalThis as unknown as { simgos?: PrismaClient };

export const simgos =
  globalForSimgos.simgos ??
  new PrismaClient({ log: ["warn", "error"] });

if (process.env.NODE_ENV !== "production") globalForSimgos.simgos = simgos;
```

**`src/server/db/app.client.ts`** — analog, memakai `@/generated/app`.

### 4.3 Script npm

```jsonc
{
  "scripts": {
    // SIMGOS: HANYA introspect + generate. TIDAK ADA migrate/db push.
    "db:simgos:pull":     "prisma db pull   --schema prisma/simgos/schema.prisma",
    "db:simgos:generate": "prisma generate  --schema prisma/simgos/schema.prisma",

    // DB Aplikasi: migrasi normal.
    "db:app:migrate":     "prisma migrate dev --schema prisma/app/schema.prisma",
    "db:app:deploy":      "prisma migrate deploy --schema prisma/app/schema.prisma",
    "db:app:generate":    "prisma generate --schema prisma/app/schema.prisma"
  }
}
```

> **Sengaja tidak ada** `db:simgos:migrate` atau `db:simgos:push`. Ketiadaan ini
> adalah bagian dari penegakan HIGH ALERT.

---

## 5. Memanggil Stored Procedure & Raw Query

### 5.1 SP Registry (whitelist)

Nama SP/query **tidak boleh** dari input user. Daftarkan yang diizinkan:

**`src/server/db/sp-registry.ts`**

```ts
/**
 * Registry SP & raw query SIMGOS yang diizinkan. Hanya nama di sini yang boleh
 * dieksekusi. Semua parameter WAJIB di-bind (?), tidak pernah string-concat.
 */
export const SIMGOS_SP = {
  LAPORAN_KUNJUNGAN: {
    // Ganti dengan nama SP asli hasil discovery, atau strategi 'query'.
    kind: "procedure",
    name: "sp_laporan_kunjungan", // schema.nama bila perlu: `pendaftaran`.`sp_...`
    params: ["tanggalAwal", "tanggalAkhir", "unitId"] as const,
  },
  RESUME_MEDIK: {
    kind: "procedure",
    name: "sp_resume_medik",
    params: ["kunjunganId"] as const,
  },
} as const;

export type SpKey = keyof typeof SIMGOS_SP;
```

### 5.2 Helper eksekusi (di layer db, dipakai DAL)

```ts
import { simgos } from "./simgos.client";

/**
 * Panggil stored procedure read-only dengan parameter ter-bind.
 * @returns baris result set pertama (untuk report ber-single result set).
 */
export async function callProcedure<T = unknown>(
  procName: string,
  params: unknown[],
): Promise<T[]> {
  const placeholders = params.map(() => "?").join(", ");
  // procName berasal dari registry (bukan input user) → aman.
  const sql = `CALL ${procName}(${placeholders})`;
  return simgos.$queryRawUnsafe<T[]>(sql, ...params);
}
```

Catatan penting soal stored procedure di MySQL + Prisma:

- Gunakan **`$queryRawUnsafe`** hanya karena string `CALL x(...)` disusun dari nama
  registry; **nilai parameter tetap di-bind** lewat `?` → **aman dari injeksi**.
- MySQL SP bisa mengembalikan **beberapa result set**. Prisma umumnya mengambil
  **result set pertama**. Jika sebuah SP mengembalikan banyak set, pertimbangkan:
  (a) minta versi SP satu result set, atau (b) pakai raw SELECT setara. Dokumentasikan
  di registry.
- Kalau SP memakai `OUT` parameter, umumnya lebih praktis diganti pola SELECT.

### 5.3 Raw query lintas-database (tagged template, aman)

Untuk data tanpa SP, pakai `$queryRaw` (tagged template) agar parameter otomatis
ter-bind:

```ts
import { Prisma } from "@/generated/simgos";
import { simgos } from "./simgos.client";

export async function queryKunjungan(params: {
  from: Date; to: Date; limit: number; offset: number;
}) {
  return simgos.$queryRaw<KunjunganRow[]>`
    SELECT k.id, k.nomor, p.nama AS nama_pasien, k.tanggal, k.status
    FROM pendaftaran.kunjungan k
    JOIN master.pasien p ON p.id = k.pasien_id
    WHERE k.tanggal BETWEEN ${params.from} AND ${params.to}
    ORDER BY k.tanggal DESC
    LIMIT ${params.limit} OFFSET ${params.offset}
  `;
}
```

> Nama tabel/kolom di atas **placeholder** — sesuaikan dengan hasil discovery.
> **Jangan pernah** membangun WHERE/kolom dari string input user; selalu bind nilai.

---

## 6. Guard Anti-Write ke SIMGOS

Selain user DB read-only, tambahkan sabuk pengaman di kode:

1. **Lint rule / grep CI** — larang pemanggilan berikut pada `simgos`:
   `simgos.$executeRaw`, `simgos.$executeRawUnsafe`, `.create(`, `.update(`,
   `.delete(`, `.upsert(`, `.createMany(` (kecuali di test yang di-mock).
2. **Konvensi** — hanya file `*.dal.ts` yang boleh meng-import `simgos`.
3. **(Opsional) Proxy runtime** — bungkus `simgos` dengan Proxy yang melempar error
   bila method tulis dipanggil, sebagai jaring pengaman tambahan.

Contoh cek CI sederhana (grep):

```bash
# Gagal build bila ada pola tulis ke client simgos.
grep -REn "simgos\.\$executeRaw|simgos\.[a-zA-Z]+\.(create|update|delete|upsert)" src && exit 1 || true
```

---

## 7. Skema DB Aplikasi (`reporthub_app`)

Ini **milik kita** — boleh migrasi normal. Isi minimal untuk SaaS-ready:

```prisma
// prisma/app/schema.prisma (ringkasan model — detail final saat implementasi)

model User {
  id        String   @id @default(cuid())
  email     String   @unique
  name      String
  role      Role     @default(VIEWER)
  isActive  Boolean  @default(true)
  createdAt DateTime @default(now())
  audits    AuditLog[]
}

enum Role { ADMIN OPERATOR VIEWER }

/// Audit akses data medis (mis. cetak resume medik). WAJIB untuk kepatuhan.
model AuditLog {
  id          String   @id @default(cuid())
  userId      String
  user        User     @relation(fields: [userId], references: [id])
  action      String   // "PRINT_RESUME_MEDIK", "VIEW_LAPORAN_KUNJUNGAN", ...
  resourceRef String?  // mis. kunjunganId / rentang tanggal filter
  metadata    Json?
  ip          String?
  createdAt   DateTime @default(now())

  @@index([userId, createdAt])
  @@index([action, createdAt])
}

/// Preset filter report yang bisa disimpan user (SaaS convenience).
model SavedFilter {
  id        String   @id @default(cuid())
  userId    String
  reportKey String   // "laporan-kunjungan"
  name      String
  params    Json
  createdAt DateTime @default(now())
}
```

> Karena data medis sensitif, **AuditLog** untuk pencetakan resume medik bukan
> opsional — ini bagian dari tanggung jawab kepatuhan. Ia disimpan di DB aplikasi,
> **bukan** di SIMGOS.

Lanjut ke → [04-backend-layering.md](./04-backend-layering.md)

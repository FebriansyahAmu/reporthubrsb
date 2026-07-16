# 04 — Backend Layering (API · Validation · Service · DAL)

Dokumen ini merinci kontrak tiap lapisan, aliran data, penanganan error, dan pola
kode. Tujuannya: **batas tanggung jawab tegas, mudah diuji, sulit bocor.**

```
Request ─▶ API Layer ─▶ Validation ─▶ Service ─▶ DAL ─▶ DB
Response ◀────────────── DTO ◀──────── DTO ◀───── rows(mapper)
```

Aturan emas import (satu arah ke bawah):

```
api  →  service  →  dal  →  db client
 │         │         └─ mapper, types
 └─ schema (validation), http helper
service TIDAK import api. dal TIDAK import service.
```

---

## 1. Tipe Fondasi

### 1.1 Result & Error

Business logic tidak melempar error HTTP. Ia memakai error domain (atau `Result`),
dan **API layer** yang menerjemahkan ke status HTTP.

**`src/server/lib/errors.ts`**

```ts
export class AppError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly httpStatus: number,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = new.target.name;
  }
}

export class ValidationError extends AppError {
  constructor(details: unknown) {
    super("Input tidak valid", "VALIDATION_ERROR", 422, details);
  }
}
export class NotFoundError extends AppError {
  constructor(msg = "Data tidak ditemukan") { super(msg, "NOT_FOUND", 404); }
}
export class ForbiddenError extends AppError {
  constructor(msg = "Tidak memiliki akses") { super(msg, "FORBIDDEN", 403); }
}
export class UnauthorizedError extends AppError {
  constructor(msg = "Belum login") { super(msg, "UNAUTHORIZED", 401); }
}
/** Aturan bisnis dilanggar, mis. resume medik untuk kunjungan belum selesai. */
export class BusinessRuleError extends AppError {
  constructor(msg: string, details?: unknown) {
    super(msg, "BUSINESS_RULE", 409, details);
  }
}
```

### 1.2 Pagination

**`src/server/lib/pagination.ts`**

```ts
export type PageParams = { page: number; pageSize: number };
export type PageMeta = { page: number; pageSize: number; total: number; totalPages: number };

export function toOffset({ page, pageSize }: PageParams) {
  return { limit: pageSize, offset: (page - 1) * pageSize };
}
export function buildMeta(p: PageParams, total: number): PageMeta {
  return { ...p, total, totalPages: Math.max(1, Math.ceil(total / p.pageSize)) };
}
```

---

## 2. DAL — Data Access Layer

**Tanggung jawab:** satu-satunya lapisan yang bicara ke database. Menjalankan
stored procedure / raw query read-only, lalu **memetakan baris DB → DTO**.

**Boleh:** import `simgos`/`app` client, tulis SQL/CALL.
**Tidak boleh:** aturan bisnis, tahu HTTP, tahu siapa user.

### 2.1 Types & Mapper

**`kunjungan.types.ts`** (DTO — kontrak keluar, camelCase):

```ts
export type KunjunganListItemDto = {
  id: string;
  nomorKunjungan: string;
  namaPasien: string;
  noRekamMedis: string;
  tanggalKunjungan: string;   // ISO string
  unit: string;
  dokter: string | null;
  status: "BARU" | "DALAM_PROSES" | "SELESAI" | "BATAL";
};

/** Bentuk baris mentah dari DB (snake_case / apa adanya SIMGOS). Internal DAL. */
export type KunjunganRow = {
  id: number | bigint;
  nomor: string;
  nama_pasien: string;
  no_rm: string;
  tanggal: Date;
  unit: string;
  dokter: string | null;
  status_kode: string;
};
```

**`kunjungan.mapper.ts`** (row → DTO; satu-satunya tempat konversi bentuk):

```ts
import type { KunjunganRow, KunjunganListItemDto } from "./kunjungan.types";

const STATUS_MAP: Record<string, KunjunganListItemDto["status"]> = {
  "1": "BARU", "2": "DALAM_PROSES", "3": "SELESAI", "0": "BATAL",
};

export function mapKunjungan(row: KunjunganRow): KunjunganListItemDto {
  return {
    id: String(row.id),
    nomorKunjungan: row.nomor,
    namaPasien: row.nama_pasien,
    noRekamMedis: row.no_rm,
    tanggalKunjungan: row.tanggal.toISOString(),
    unit: row.unit,
    dokter: row.dokter,
    status: STATUS_MAP[row.status_kode] ?? "BARU",
  };
}
```

### 2.2 DAL

**`kunjungan.dal.ts`**

```ts
import { simgos } from "@/server/db/simgos.client";
import { mapKunjungan } from "./kunjungan.mapper";
import type { KunjunganRow, KunjunganListItemDto } from "./kunjungan.types";

type QueryArgs = {
  from: Date; to: Date; search?: string; status?: string;
  limit: number; offset: number;
};

export async function queryKunjungan(a: QueryArgs): Promise<KunjunganListItemDto[]> {
  // Placeholder nama tabel/kolom — sesuaikan hasil discovery SIMGOS.
  // Parameter SELALU di-bind lewat tagged template ($queryRaw).
  const rows = await simgos.$queryRaw<KunjunganRow[]>`
    SELECT k.id, k.nomor, p.nama AS nama_pasien, p.no_rm,
           k.tanggal, u.nama AS unit, d.nama AS dokter, k.status AS status_kode
    FROM pendaftaran.kunjungan k
    JOIN master.pasien p ON p.id = k.pasien_id
    JOIN master.unit   u ON u.id = k.unit_id
    LEFT JOIN master.dokter d ON d.id = k.dokter_id
    WHERE k.tanggal BETWEEN ${a.from} AND ${a.to}
      AND (${a.search ?? null} IS NULL OR p.nama LIKE ${"%" + (a.search ?? "") + "%"})
      AND (${a.status ?? null} IS NULL OR k.status = ${a.status ?? null})
    ORDER BY k.tanggal DESC
    LIMIT ${a.limit} OFFSET ${a.offset}
  `;
  return rows.map(mapKunjungan);
}

export async function countKunjungan(a: Omit<QueryArgs, "limit" | "offset">): Promise<number> {
  const res = await simgos.$queryRaw<{ total: bigint }[]>`
    SELECT COUNT(*) AS total
    FROM pendaftaran.kunjungan k
    JOIN master.pasien p ON p.id = k.pasien_id
    WHERE k.tanggal BETWEEN ${a.from} AND ${a.to}
      AND (${a.search ?? null} IS NULL OR p.nama LIKE ${"%" + (a.search ?? "") + "%"})
      AND (${a.status ?? null} IS NULL OR k.status = ${a.status ?? null})
  `;
  return Number(res[0]?.total ?? 0);
}
```

> Untuk report yang punya stored procedure, DAL memanggil `callProcedure(...)`
> dari helper di [03-database-prisma.md](./03-database-prisma.md) §5, lalu memetakan
> hasilnya via mapper.

---

## 3. Validation Layer (Zod)

**Tanggung jawab:** mendefinisikan & memvalidasi **input** di boundary, plus (opsional)
menjamin bentuk **output** DTO. Menjadi sumber tipe input via `z.infer`.

**`kunjungan.schema.ts`**

```ts
import { z } from "zod";

export const kunjunganQuerySchema = z
  .object({
    from: z.coerce.date(),
    to: z.coerce.date(),
    search: z.string().trim().min(1).max(100).optional(),
    status: z.enum(["BARU", "DALAM_PROSES", "SELESAI", "BATAL"]).optional(),
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(25),
  })
  .refine((v) => v.from <= v.to, {
    message: "Tanggal awal tidak boleh melebihi tanggal akhir",
    path: ["from"],
  });

export type KunjunganQuery = z.infer<typeof kunjunganQuerySchema>;
```

Prinsip:
- **Semua** input dari luar (query string, body, params) divalidasi di sini —
  tidak ada `any` yang lolos ke service.
- Validasi menyertakan aturan **format & rentang**, bukan aturan bisnis
  (aturan bisnis ada di service).

---

## 4. Service Layer

**Tanggung jawab:** aturan bisnis, orchestrasi beberapa DAL, cek permission, dan
audit. Ia menerima **input yang sudah tervalidasi & typed**, mengembalikan **DTO**.

**Boleh:** panggil banyak DAL, panggil `app` client untuk audit/config, lempar
error domain (`AppError`).
**Tidak boleh:** tahu `Request`/`Response`, tulis SQL, parse query string.

**`kunjungan.service.ts`**

```ts
import { queryKunjungan, countKunjungan } from "./kunjungan.dal";
import { buildMeta, toOffset } from "@/server/lib/pagination";
import type { KunjunganQuery } from "./kunjungan.schema";
import type { AuthUser } from "@/server/auth/guard";

export async function getKunjunganList(input: KunjunganQuery, user: AuthUser) {
  // Contoh aturan permission (detail di 06):
  // requirePermission(user, "kunjungan:read");

  const { limit, offset } = toOffset({ page: input.page, pageSize: input.pageSize });

  const [data, total] = await Promise.all([
    queryKunjungan({ from: input.from, to: input.to, search: input.search, status: input.status, limit, offset }),
    countKunjungan({ from: input.from, to: input.to, search: input.search, status: input.status }),
  ]);

  return {
    data,
    meta: buildMeta({ page: input.page, pageSize: input.pageSize }, total),
  };
}
```

Contoh aturan bisnis nyata (di modul resume-medik):

```ts
// resume-medik.service.ts (ringkas)
export async function getResumeMedik(kunjunganId: string, user: AuthUser) {
  const header = await getKunjunganHeader(kunjunganId);        // DAL
  if (!header) throw new NotFoundError("Kunjungan tidak ditemukan");

  // ATURAN BISNIS: resume medik hanya untuk kunjungan SELESAI.
  if (header.status !== "SELESAI") {
    throw new BusinessRuleError("Resume medik hanya tersedia untuk kunjungan yang sudah selesai");
  }

  const [diagnosa, tindakan, resep] = await Promise.all([...]); // beberapa DAL
  const resume = assembleResume(header, diagnosa, tindakan, resep);

  await writeAudit(user, "VIEW_RESUME_MEDIK", { kunjunganId });  // ke DB aplikasi
  return resume;
}
```

---

## 5. API Layer (Route Handler)

**Tanggung jawab:** urusan HTTP saja — auth guard, parse & validasi input, panggil
service, bentuk response, terjemahkan error → status HTTP.

### 5.1 Helper HTTP

**`src/server/lib/http.ts`**

```ts
import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { AppError, ValidationError } from "./errors";

export function ok<T>(data: T, meta?: unknown) {
  return NextResponse.json({ data, meta }, { status: 200 });
}

export function fail(err: unknown) {
  if (err instanceof ZodError) {
    const e = new ValidationError(err.flatten());
    return NextResponse.json({ error: { code: e.code, message: e.message, details: e.details } }, { status: e.httpStatus });
  }
  if (err instanceof AppError) {
    return NextResponse.json({ error: { code: err.code, message: err.message, details: err.details } }, { status: err.httpStatus });
  }
  // Jangan bocorkan detail internal DB ke klien.
  console.error("[UNHANDLED]", err);
  return NextResponse.json({ error: { code: "INTERNAL", message: "Terjadi kesalahan" } }, { status: 500 });
}
```

### 5.2 Route Handler

**`src/app/api/kunjungan/route.ts`**

```ts
import { NextRequest } from "next/server";
import { requireUser } from "@/server/auth/guard";
import { kunjunganQuerySchema } from "@/server/modules/kunjungan/kunjungan.schema";
import { getKunjunganList } from "@/server/modules/kunjungan/kunjungan.service";
import { ok, fail } from "@/server/lib/http";

export async function GET(req: NextRequest) {
  try {
    const user = await requireUser(req);                       // auth
    const params = Object.fromEntries(req.nextUrl.searchParams);
    const input = kunjunganQuerySchema.parse(params);          // validation
    const result = await getKunjunganList(input, user);        // service
    return ok(result.data, result.meta);                       // response
  } catch (err) {
    return fail(err);                                          // error → HTTP
  }
}
```

> API layer **tipis**: tidak ada logika bisnis, tidak ada SQL. Ganti Route Handler
> dengan Server Action pun, service & bawahnya tidak berubah.

---

## 6. Kontrak Response Standar

Konsisten di semua endpoint:

```jsonc
// Sukses (list)
{ "data": [ /* DTO[] */ ], "meta": { "page": 1, "pageSize": 25, "total": 132, "totalPages": 6 } }

// Sukses (single)
{ "data": { /* DTO */ } }

// Error
{ "error": { "code": "BUSINESS_RULE", "message": "Resume medik hanya ...", "details": null } }
```

| Kondisi | HTTP | code |
|---|---|---|
| Sukses | 200 | — |
| Input tidak valid | 422 | `VALIDATION_ERROR` |
| Belum login | 401 | `UNAUTHORIZED` |
| Tidak berhak | 403 | `FORBIDDEN` |
| Tidak ditemukan | 404 | `NOT_FOUND` |
| Langgar aturan bisnis | 409 | `BUSINESS_RULE` |
| Error tak terduga | 500 | `INTERNAL` |

---

## 7. Testing per Lapisan

| Lapisan | Jenis test | Fokus |
|---|---|---|
| Mapper | Unit murni | row → DTO benar, status mapping, null-safety |
| Validation | Unit | schema menolak/menerima input yang tepat |
| Service | Unit (DAL di-mock) | aturan bisnis (mis. tolak kunjungan belum selesai), audit dipanggil |
| DAL | Integration (DB test/staging read-only) | SQL/SP mengembalikan bentuk benar |
| API | E2E (Playwright) | status HTTP, auth, alur cetak |

> Karena lapisan `src/server` tidak bergantung Next.js, service & mapper bisa diuji
> cepat tanpa menjalankan server.

Lanjut ke → [05-frontend-design.md](./05-frontend-design.md)

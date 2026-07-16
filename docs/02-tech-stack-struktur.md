# 02 — Tech Stack & Struktur Folder

## 1. Tech Stack

| Layer | Teknologi | Catatan |
|---|---|---|
| Framework | **Next.js 16** (App Router) + React 19 | Fullstack: UI + API di satu repo |
| Bahasa | **TypeScript** (strict) | Sudah aktif di `tsconfig.json` |
| ORM | **Prisma** | 2 client: `simgos` (RO) & `app` (RW) |
| Database | **MySQL** | SIMGOS multi-database + DB aplikasi |
| Validasi | **Zod** | Di boundary API (input) & bentuk DTO |
| Styling | **Tailwind CSS v4** | Sudah terpasang (`@tailwindcss/postcss`) |
| Animasi | **Framer Motion** | Transisi halaman, list, modal |
| Auth | **Auth.js (NextAuth)** atau JWT sesi | Disimpan di DB aplikasi |
| Cetak (fase 1) | **CSS `@media print`** | Route cetak khusus |
| Cetak (fase 2) | **Puppeteer** | PDF server-side |
| Tabel/UI data | **TanStack Table** (opsional) | Untuk tabel report yang kompleks |
| Testing | **Vitest** + **Playwright** | Unit (service/DAL) + E2E (alur cetak) |

> Dependency di atas **belum** diinstal (kecuali Next/React/Tailwind). Instalasi
> dilakukan saat implementasi sesuai [07-roadmap.md](./07-roadmap.md).

---

## 2. Struktur Folder

Prinsip: **modular per fitur** untuk backend, **route-based** untuk UI, dengan
lapisan backend yang framework-agnostic di `src/server`.

```
reporthubrsb/
├─ prisma/
│  ├─ simgos/
│  │  └─ schema.prisma          # HASIL introspect SIMGOS — READ-ONLY, tanpa migrasi
│  └─ app/
│     ├─ schema.prisma          # Schema DB aplikasi — dengan migrasi
│     └─ migrations/            # Migrasi versioned (hanya untuk DB aplikasi)
│
├─ src/
│  ├─ app/                      # Next.js App Router (Presentation + API)
│  │  ├─ (dashboard)/           # Group route dengan layout sidebar
│  │  │  ├─ layout.tsx          # Shell SaaS (sidebar, topbar)
│  │  │  ├─ kunjungan/
│  │  │  │  └─ page.tsx         # Menu: Kunjungan Pasien
│  │  │  └─ laporan/
│  │  │     ├─ kunjungan/
│  │  │     │  └─ page.tsx      # Report: Laporan Kunjungan Pasien
│  │  │     └─ resume-medik/
│  │  │        └─ page.tsx      # Report: Cari kunjungan selesai → cetak
│  │  │
│  │  ├─ print/                 # Layout khusus cetak (tanpa sidebar)
│  │  │  └─ resume-medik/
│  │  │     └─ [kunjunganId]/
│  │  │        └─ page.tsx      # Halaman cetak resume medik (print CSS)
│  │  │
│  │  ├─ api/                   # API Layer (Route Handlers)
│  │  │  ├─ kunjungan/route.ts
│  │  │  ├─ laporan/
│  │  │  │  └─ kunjungan/route.ts
│  │  │  └─ resume-medik/
│  │  │     └─ [kunjunganId]/route.ts
│  │  │
│  │  ├─ layout.tsx
│  │  └─ globals.css
│  │
│  ├─ server/                   # BACKEND (framework-agnostic, bisa diuji unit)
│  │  ├─ db/
│  │  │  ├─ simgos.client.ts    # Prisma client SIMGOS (read-only)
│  │  │  ├─ app.client.ts       # Prisma client DB aplikasi
│  │  │  └─ sp-registry.ts      # Whitelist stored procedure & query
│  │  │
│  │  ├─ modules/               # Satu folder per fitur
│  │  │  ├─ kunjungan/
│  │  │  │  ├─ kunjungan.dal.ts
│  │  │  │  ├─ kunjungan.service.ts
│  │  │  │  ├─ kunjungan.schema.ts   # Zod: input & output
│  │  │  │  ├─ kunjungan.mapper.ts   # row DB → DTO
│  │  │  │  └─ kunjungan.types.ts    # DTO & tipe domain
│  │  │  ├─ laporan-kunjungan/
│  │  │  │  └─ ... (dal, service, schema, mapper, types)
│  │  │  └─ resume-medik/
│  │  │     └─ ... (dal, service, schema, mapper, types)
│  │  │
│  │  ├─ auth/                  # Konfigurasi auth, guard, session
│  │  │  ├─ auth.config.ts
│  │  │  └─ guard.ts            # requireUser(), requirePermission()
│  │  │
│  │  └─ lib/                   # Utilitas backend lintas modul
│  │     ├─ result.ts          # Result<T, E> (success/failure)
│  │     ├─ errors.ts          # AppError, NotFoundError, ValidationError, ...
│  │     ├─ http.ts            # helper bentuk response & mapping error→HTTP
│  │     ├─ pagination.ts      # parsing & bentuk meta pagination
│  │     ├─ audit.ts           # tulis audit log ke DB aplikasi
│  │     └─ logger.ts
│  │
│  ├─ components/               # UI reusable lintas fitur (design system)
│  │  ├─ ui/                    # Button, Card, Badge, Table, Input, DateRange...
│  │  ├─ layout/                # Sidebar, Topbar, PageHeader
│  │  └─ feedback/              # EmptyState, Skeleton, ErrorState, Toast
│  │
│  ├─ features/                 # Komponen UI spesifik fitur (client)
│  │  ├─ kunjungan/
│  │  ├─ laporan-kunjungan/
│  │  └─ resume-medik/
│  │
│  ├─ lib/                      # Utilitas client (fetcher, format tanggal, dll)
│  └─ styles/                   # token desain, print.css
│
├─ docs/                        # ← dokumen ini
├─ .env                         # DATABASE_URL_SIMGOS, DATABASE_URL_APP, ...
└─ package.json
```

### Kenapa `src/server` terpisah dari `src/app/api`?

- `src/app/api/**` = **API Layer tipis** (HTTP saja). Ia memanggil service.
- `src/server/**` = business logic **tanpa** ketergantungan Next.js, sehingga:
  - bisa diuji unit tanpa menjalankan server,
  - bisa dipakai ulang dari Server Action, cron/job, atau CLI,
  - batas lapisan jelas dan sulit "bocor".

---

## 3. Konvensi Penamaan

| Hal | Konvensi | Contoh |
|---|---|---|
| Folder modul | kebab-case, singular domain | `resume-medik/` |
| File lapisan | `<modul>.<layer>.ts` | `kunjungan.service.ts` |
| Fungsi service | verb + domain | `getLaporanKunjungan()`, `getResumeMedik()` |
| Fungsi DAL | `query*` / `call*` | `queryKunjungan()`, `callSpResumeMedik()` |
| DTO | PascalCase + suffix `Dto` | `KunjunganListItemDto` |
| Zod schema | camelCase + suffix `Schema` | `laporanKunjunganQuerySchema` |
| Tipe input | dari `z.infer` | `type LaporanKunjunganQuery = z.infer<...>` |
| Stored procedure key | UPPER_SNAKE di registry | `SP_RESUME_MEDIK` |
| Route API | plural resource | `/api/laporan/kunjungan` |
| Komponen React | PascalCase | `KunjunganTable.tsx` |

### Aturan penting

- **DTO memakai camelCase**, walau kolom DB SIMGOS snake_case/idn. Konversi terjadi
  di **mapper**, bukan bocor ke UI.
- **Tidak ada** akses `simgos` client di luar folder `*.dal.ts`.
- **Tidak ada** SQL mentah di service atau API.
- Import antar-lapisan hanya **satu arah ke bawah** (API→Service→DAL). DAL tidak
  meng-import Service.

---

## 4. Alias Path

`tsconfig.json` sudah punya `@/*` → `./src/*`. Gunakan konsisten:

```ts
import { getLaporanKunjungan } from "@/server/modules/laporan-kunjungan/laporan-kunjungan.service";
import { simgos } from "@/server/db/simgos.client";
```

Lanjut ke → [03-database-prisma.md](./03-database-prisma.md)

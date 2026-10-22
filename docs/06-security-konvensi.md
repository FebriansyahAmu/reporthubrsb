# 06 — Keamanan & Konvensi

Data yang diakses adalah **rekam medis** — sensitif. Keamanan & kepatuhan bukan
tambahan, tapi bagian inti desain.

---

## 1. Prinsip Keamanan Utama

1. **Read-only mutlak ke SIMGOS** (HIGH ALERT) — ditegakkan di level user DB.
   Lihat [03-database-prisma.md](./03-database-prisma.md) §1.
2. **Least privilege** — user DB, role aplikasi, dan akses menu semuanya seminimal
   yang dibutuhkan.
3. **Audit akses data medis** — setiap lihat/cetak resume medik tercatat.
4. **Tidak membocorkan detail internal** — error DB tidak pernah sampai ke klien.
5. **Semua input tak dipercaya** — validasi & bind parameter tanpa kecuali.

---

## 2. Autentikasi & Otorisasi

### 2.1 Autentikasi
- Wajib login untuk semua route (dashboard & API), kecuali halaman login.
- Implementasi: Auth.js (NextAuth) atau session JWT; **data user di DB aplikasi**.
- Middleware Next.js melindungi grup route `(dashboard)` dan `/api/**`.

### 2.2 Otorisasi (RBAC)

> 🔄 **Diperbarui:** peta role→permission **statis** di bawah ini adalah rencana
> awal. Desain final adalah **RBAC dinamis berbasis modul** (peran di DB + grant
> per modul/aksi + katalog modul di kode + guard halaman & API). Lihat blueprint
> lengkap di **[rbac/README.md](./rbac/README.md)**. Tabel di bawah dipertahankan
> sebagai gambaran konsep permission.

Role di DB aplikasi (`ADMIN`, `OPERATOR`, `VIEWER`) → dipetakan ke permission:

| Permission | ADMIN | OPERATOR | VIEWER |
|---|:---:|:---:|:---:|
| `kunjungan:read` | ✅ | ✅ | ✅ |
| `laporan:read` | ✅ | ✅ | ✅ |
| `resume-medik:read` | ✅ | ✅ | ❌ |
| `resume-medik:print` | ✅ | ✅ | ❌ |
| `admin:users` | ✅ | ❌ | ❌ |

**Guard** dipanggil di API & service:

```ts
// src/server/auth/guard.ts
export type AuthUser = { id: string; email: string; role: "ADMIN" | "OPERATOR" | "VIEWER" };

export async function requireUser(req: Request): Promise<AuthUser> {
  const user = await getSessionUser(req);      // baca session/JWT
  if (!user) throw new UnauthorizedError();
  return user;
}

export function requirePermission(user: AuthUser, perm: string): void {
  if (!hasPermission(user.role, perm)) throw new ForbiddenError();
}
```

> **Cek permission ada di dua tempat:** UI menyembunyikan menu yang tak berhak
> (UX), tapi **penegakan sebenarnya di server** (API/service). UI tidak pernah
> jadi satu-satunya penjaga.

---

## 3. Audit Trail (Kepatuhan Data Medis)

Karena kita mengakses rekam medis, **wajib** mencatat:

- Siapa (userId), kapan (timestamp), aksi apa (`VIEW_RESUME_MEDIK`, `PRINT_RESUME_MEDIK`,
  `VIEW_LAPORAN_KUNJUNGAN`), untuk resource apa (kunjunganId / rentang filter), dari IP mana.

Ditulis ke `AuditLog` di **DB aplikasi** (bukan SIMGOS). Helper:

```ts
// src/server/lib/audit.ts
import { app } from "@/server/db/app.client";
export async function writeAudit(user: AuthUser, action: string, meta?: {
  resourceRef?: string; metadata?: unknown; ip?: string;
}) {
  await app.auditLog.create({
    data: { userId: user.id, action, resourceRef: meta?.resourceRef, metadata: meta?.metadata as any, ip: meta?.ip },
  });
}
```

Audit dipanggil dari **service** (bukan API), agar tercatat apa pun jalur pemanggilnya.

---

## 4. Anti SQL Injection

- **Selalu** parameterized: `$queryRaw` tagged template, atau `$queryRawUnsafe` dengan
  placeholder `?` + argumen terpisah.
- **Tidak pernah** menyusun WHERE/nama kolom/nama SP dari string input user.
- Nama stored procedure hanya dari **SP Registry** (whitelist), lihat
  [03-database-prisma.md](./03-database-prisma.md) §5.
- Input yang membentuk `LIKE` tetap di-bind (`${"%"+term+"%"}`), bukan di-concat ke SQL.

---

## 5. Secrets & Konfigurasi

- Kredensial DB di `.env` (tidak di-commit). Sediakan `.env.example` tanpa nilai asli.
- Password user DB **read-only** SIMGOS berbeda dari user DB aplikasi.
- Di produksi, secret dari secret manager / env platform, bukan file.
- Jangan pernah log kredensial atau data pasien lengkap ke logger.

`.gitignore` sudah mengabaikan `.env*` (verifikasi saat setup).

---

## 6. Penanganan Error yang Aman

- Error domain (`AppError`) → pesan aman + kode ke klien.
- Error tak terduga → log detail di server, kirim `500 { code: "INTERNAL" }` ke klien
  (tanpa stack/SQL).
- Pesan error **tidak** menyebut nama tabel/kolom/SP SIMGOS ke pengguna akhir.
- Lihat helper `fail()` di [04-backend-layering.md](./04-backend-layering.md) §5.1.

---

## 7. Konvensi Kode

### Umum
- **TypeScript strict**, tidak ada `any` implisit. `any` eksplisit hanya di batas
  interop (mis. `Json` Prisma) dengan komentar alasan.
- **ESLint** (config Next sudah ada) + Prettier. Format sebelum commit.
- Nama file & simbol mengikuti [02-tech-stack-struktur.md](./02-tech-stack-struktur.md) §3.

### Batas lapisan (di-review ketat)
- `simgos` client **hanya** di `*.dal.ts`.
- Tidak ada SQL di service/API.
- Import satu arah: API → Service → DAL. Tidak ada import balik.
- DTO camelCase; konversi bentuk hanya di mapper.

### Commit & Git
- Branch dari `main`; commit kecil & deskriptif.
- Jangan commit `.env`, `src/generated/**` (hasil `prisma generate`), atau kredensial.
- PR yang menyentuh `prisma/simgos/**` di luar hasil `db pull` → review khusus (HIGH ALERT).

---

## 8. Checklist Keamanan Sebelum Rilis Fitur

- [ ] Endpoint punya `requireUser` + `requirePermission` yang sesuai.
- [ ] Semua input divalidasi Zod; tidak ada param mentah ke DAL.
- [ ] Semua query/SP parameterized; nama SP dari registry.
- [ ] Akses/print data medis menulis `AuditLog`.
- [ ] Error tidak membocorkan detail DB.
- [ ] User DB yang dipakai benar-benar read-only (uji: coba INSERT → harus ditolak).
- [ ] Tidak ada jalur `migrate`/`db push` ke schema SIMGOS.

---

## 9. Patch Keamanan Dependensi & Image

**Rutin:**
- Pantau [blog keamanan Next.js](https://nextjs.org/blog) dan [rilis keamanan Node.js](https://nodejs.org/en/blog/vulnerability).
- Jangan hanya mengandalkan `npm audit`. Advisory Next.js sering belum masuk database npm, sehingga `next@16.3.8` lolos audit padahal rentan.
- `npm audit --omit=dev` (yang masuk ke image produksi) harus bersih. Temuan dev-only dicatat beserta alasannya.
- Versi Node di `Dockerfile` dipatok (`ARG NODE_VERSION`). Naikkan setiap ada rilis keamanan Node, lalu build ulang image.

**Pertahanan berlapis yang dipasang:**
- **Optimizer gambar** (`/_next/image`, publik): `images.localPatterns` hanya mengizinkan `/logo/**` tanpa query string. Jalur lain, host luar, dan SVG ditolak 400.
- **Image runner:**
  - `apk upgrade` untuk tambalan paket Alpine;
  - npm/npx/corepack/yarn dibuang, karena runtime hanya memanggil `node`;
  - berjalan sebagai non-root UID 1001;
  - init `tini`.

### Log patch 22 Okt 2026

| Komponen | Sebelum → sesudah | Advisory | Dampak ke aplikasi ini |
| --- | --- | --- | --- |
| `next` | 16.3.8 → **16.4.2** | CVE-2026-96889 / GHSA-2464-fhr4-w9xw: RCE di Image Optimization lewat SVG (memori `sharp`, glibc Linux; rentan ≤ 16.4.0) | `next/image` dipakai untuk logo, dan `/_next/image` publik tanpa login. Image kita Alpine (musl), tetapi tetap ditambal plus dikunci dengan `localPatterns`. |
| | | GHSA-673q-mjm6-r5xr: RCE di fungsi `use cache` | Tidak dipakai (tanpa Cache Components). Tetap ditambal sesuai anjuran Vercel. |
| | | GHSA-p3m5-59mp-jv5r: DoS lewat Server Actions | Tidak ada Server Action. |
| | | CVE-2026-94545: RCE `next/og` `ImageResponse` lewat SVG (16.2.0–16.3.5) | Sudah aman sejak 16.3.6; `next/og` juga tidak dipakai. |
| `sharp` | 0.35.5 | Batas aman CVE-2026-96889 adalah ≥ 0.35.5 | Lockfile sudah 0.35.5, termasuk biner `linuxmusl`. |
| `react`, `react-dom` | 19.2.4 → **19.2.9** | GHSA-xqc2-xf4c-x3h3, GHSA-h3gv-c5rc-p453 (`react-server-dom-*`) | RSC dibundel di dalam `next`, sehingga tertambal lewat 16.4.x. Paket `react` diselaraskan. |
| Node.js (Docker) | `22-alpine` mengambang → **24.22.1-alpine3.24** dipatok | Rilis 21 Okt 2026: CVE-2026-111497 (Brotli → RCE), bypass cek hostname TLS CVE-2026-105483 / CVE-2026-106069, `dns` NUL, dll. Rentan: < 22.23.4 / < 24.22.1 / < 26.12.1. | `fetch()` server (webservice SIMGOS, BPJS) mendekompresi Brotli secara otomatis. Node 24 sama dengan PC dev. |
| `mariadb` | 3.5.3 (+ 3.4.5 di adapter) → **3.5.4** | SQL injection di text protocol (`NO_BACKSLASH_ESCAPES`, SET expansion), kebocoran memori GeoJSON, kebocoran kata sandi via MitM | Driver kedua DB. Query kita di-bind, tetapi tetap ditambal. |
| `@prisma/*`, `prisma` | 7.9.0 → **7.10.1** | Membawa `mariadb` 3.5.4 dan menambal rantai CLI (`mysql2`, `deepmerge-ts`, `valibot`, `find-my-way`) | — |
| `uuid` (via exceljs) | 8.3.2 → **11.1.1** (`overrides`) | GHSA-w5hq-g745-h8pq | exceljs hanya memanggil `v4()` tanpa `buf`, sehingga tidak terjangkau. Override tetap dipasang untuk membersihkan audit. |
| `vitest` (dev) | 3.2.7 → **4.1.12** | `tinypool` RCE (critical), `@vitest/mocker` path traversal | Hanya dipakai saat uji lokal. |
| Transitif dev | `npm audit fix` | brace-expansion, browserslist, fast-uri, js-yaml, nanoid, source-map-js, vite | — |

**Sisa temuan (diterima):**
- `braces` ≤ 3.0.3 lewat `eslint-config-next` → `fast-glob` → `micromatch`. Belum ada versi tambalan, dan saran `npm audit` (turun ke `eslint-config-next@14`) salah.
- Hanya dipakai lint saat dev; tidak masuk image produksi. `npm audit --omit=dev` = 0.

**Validasi:**
- `tsc` dan ESLint bersih; unit 473/473 (Vitest 4).
- Build produksi lolos.
- Uji pasca-patch 17/17: optimizer menerima logo, menolak jalur lain, traversal, query, host luar, dan lebar tidak terdaftar.
- Regresi E2E produksi:
  - Domisili 44/44;
  - sesi 43/43;
  - sesi-tetap 27/29. Dua cek `expires_at` meleset karena jam server DB reporthub 16 detik lebih cepat (drift NTP), bukan karena kode.

Lanjut ke → [07-roadmap.md](./07-roadmap.md)

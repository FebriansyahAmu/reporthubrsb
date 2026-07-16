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

Lanjut ke → [07-roadmap.md](./07-roadmap.md)

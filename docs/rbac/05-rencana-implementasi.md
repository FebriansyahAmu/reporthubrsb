# 05 — Rencana Implementasi (Bertahap)

> Urutan kerja aman-mundur: RBAC dulu (fondasi), lalu Master › Pengguna. Setiap
> fase punya **acceptance** sendiri. Semua operasi DB/dev **via PowerShell**
> (`C:\Program Files\nodejs\node.exe`) — Bash sandbox tak menjangkau LAN DB.

---

## 0. Prasyarat & Catatan Lingkungan

- DB target = **`reporthub`** (`DATABASE_URL_APP`). **Bukan** SIMGOS. (HIGH ALERT tetap berlaku.)
- Skema Prisma app: `prisma/app/schema.prisma` → generate `npm run db:app:generate`.
- Perubahan skema pakai **DDL manual** + skrip seed (bukan `prisma migrate`) —
  [01-model-data.md](./01-model-data.md) §5–§7.
- Setelah menambah model/relasi Prisma, **restart dev server** (memori [[form-rm-map]]).
- `.next/dev/types/validator.ts` kadang korup → hapus sebelum `tsc` (memori kerja).

---

## Fase 1 — Fondasi RBAC (tanpa UI)

**Tujuan:** peran dinamis + resolusi izin + guard, kompatibel dengan login lama.

**DB & skema**
1. Update `prisma/app/schema.prisma`: hapus `enum Role`, tambah `Role`,
   `RolePermission`, `AuditLog`; ubah `User` (`roleId` + kolom profil,
   `mustChangePassword`, `createdBy/updatedBy`). ([01](./01-model-data.md) §2)
2. Tulis `scripts/db/rbac.sql` (DDL idempoten) + `scripts/db/seed-rbac.mjs`
   (peran sistem, grant awal, backfill `role_id` dari enum, `mustChangePassword=0`
   utk user lama). ([01](./01-model-data.md) §6–§7)
3. Jalankan DDL + seed via PowerShell; verifikasi kolom & baris peran.
4. `npm run db:app:generate`.

**Kode inti**
5. `src/server/rbac/modules.ts` — katalog `MODULES` + helper. ([03](./03-katalog-modul.md) §1–§2)
6. `src/server/rbac/permissions.ts` — `resolvePermissions` + cache TTL + `can` +
   `allowedModuleKeys` + `invalidateRole/All`. ([02](./02-otorisasi.md) §3)
7. `src/server/rbac/guard.ts` — `requireModule` (page) + `withPermission` (API). ([02](./02-otorisasi.md) §4–§5)
8. Sesuaikan auth agar `role` = `role.key`:
   - `auth.dal`: `findUserByUsername/ById` → `include: { role: true }`.
   - `auth.service`: `issueTokens` isi `role: user.role.key`; login/refresh ikut.
   - Tak ada perubahan bentuk klaim (`tokens.ts` tetap).
9. Halaman `/(dashboard)/403/page.tsx` (Forbidden state).

**Acceptance F1**
- [ ] Login admin lama tetap jalan; klaim `role="admin"`.
- [ ] `can("admin", <apa saja>)` = true (superadmin); `can("viewer","master.pengguna")` = false.
- [ ] `requireModule`/`withPermission` unit-tested (allow/deny/fail-closed).
- [ ] `tsc` 0, `eslint` 0.

---

## Fase 2 — Terapkan Guard ke Modul yang Ada + Filter Menu

**Tujuan:** proteksi nyata semua modul lama & sembunyikan menu tak berizin.

1. Tambah `moduleKey` ke `NavItem` (`nav.ts`) untuk tiap item; tambah section
   **Master** (item Pengguna & Peran) — item Master ikut terfilter izin.
2. `(dashboard)/layout.tsx`: resolve `allowedModuleKeys(user.role)` → kirim ke
   `AppShell/Sidebar`; filter `NAV`, sembunyikan section kosong. ([02](./02-otorisasi.md) §7)
3. Bungkus handler API modul lama dengan `withPermission`:
   `kunjungan`, `monitoring.*`, `berkas-klaim`, `form-rm`, `laporan`, `print`. ([03](./03-katalog-modul.md) §2)
4. Tambah `requireModule` di `layout.tsx`/`page.tsx` tiap grup route lama.
5. (Opsional) uji CI: tiap `route.ts` di bawah prefix modul mengekspor handler
   ber-`withPermission` (pakai `moduleKeyForApiPath`).

**Acceptance F2**
- [ ] Operator/Viewer melihat menu sesuai grant; admin melihat semua.
- [ ] Menembak URL/endpoint tanpa izin → `/403` / `403 JSON`.
- [ ] Modul yang sudah ada tetap berfungsi untuk peran yang berizin.

> **Urutan aman:** beri grant memadai ke `operator`/`viewer` (seed F1) **sebelum**
> mengaktifkan filter, agar tak ada user sah yang mendadak kehilangan menu.

---

## Fase 3 — Master › Pengguna (fitur utama)

**Tujuan:** UI kelola akun + modal Tambah Akun + endpoint aman. ([04](./04-master-pengguna.md))

**Backend** (`src/server/modules/master/`)
1. `master.schema.ts` — `createUserSchema`/`updateUserSchema`/`listQuerySchema`
   (`.strict`, normalisasi phone/nik, enum agama).
2. `master.dal.ts` — CRUD user & cek unik via `getAppDb()`.
3. `master.mapper.ts` — DTO + **mask NIK** + rakit nama lengkap.
4. `master.service.ts` — createUser/updateUser/listUsers/resetPassword/
   revokeSessions; guard superadmin-terakhir; audit; `invalidateRole` bila peran berubah.
5. `src/server/lib/audit.ts` — `writeAudit(actor, action, {targetId, metadata, ip})`.
6. Routes `src/app/api/master/pengguna/**` + `.../peran/**` — semua `withPermission`.

**Frontend**
7. `src/app/(dashboard)/master/layout.tsx` (guard grup) + `page.tsx` redirect ke
   `/master/pengguna`.
8. `src/app/(dashboard)/master/pengguna/page.tsx` (server: list awal) +
   `features/master/PenggunaView.tsx` (client: tabel, toolbar, pagination URL).
9. `features/master/UserFormModal.tsx` — modal Tambah/Edit (Select/DatePicker,
   generate sandi, dialog salin sandi sekali). ([04](./04-master-pengguna.md) §4, §9)
10. `src/app/(dashboard)/master/peran/page.tsx` + `features/master/PeranView.tsx`
    (daftar peran + **matriks hak akses** modul×aksi).

**Acceptance F3** = Definition of Done di [04](./04-master-pengguna.md) §11.

---

## Fase 4 — Peran & Hak Akses (operasional RBAC)

Bagian dari Fase 3 backend, tapi acceptance terpisah:
- [ ] Buat peran kustom (mis. `admisi`) → default tanpa izin.
- [ ] Set grant lewat matriks → tersimpan tervalidasi katalog; perubahan efektif
      ≤ TTL cache (`invalidateRole`).
- [ ] `isSystem`/superadmin dilindungi (tak bisa dihapus/dikurangi).
- [ ] Hapus peran hanya bila non-system & tanpa user.

---

## 3. Daftar File (ringkas)

**Baru**
```
docs/rbac/*.md                                  (dokumen ini)
scripts/db/rbac.sql
scripts/db/seed-rbac.mjs
src/server/rbac/{modules,permissions,guard}.ts
src/server/lib/audit.ts
src/server/modules/master/{master.schema,master.dal,master.service,master.mapper}.ts
src/app/(dashboard)/403/page.tsx
src/app/(dashboard)/master/{layout,page}.tsx
src/app/(dashboard)/master/pengguna/page.tsx
src/app/(dashboard)/master/peran/page.tsx
src/app/api/master/pengguna/{route.ts,[id]/route.ts,[id]/reset-password/route.ts,[id]/revoke-sessions/route.ts}
src/app/api/master/peran/{route.ts,[id]/route.ts,[id]/hak-akses/route.ts}
src/features/master/{PenggunaView,UserFormModal,PeranView,HakAksesMatrix}.tsx
```

**Diubah**
```
prisma/app/schema.prisma                         (Role, RolePermission, AuditLog, User)
src/server/modules/auth/{auth.dal,auth.service}.ts   (role.key)
src/components/layout/nav.ts                      (+moduleKey, +section Master)
src/components/layout/{Sidebar,AppShell}.tsx      (terima daftar modul terizin)
src/app/(dashboard)/layout.tsx                    (resolve allowedModuleKeys)
src/app/(dashboard)/**/*                          (requireModule per grup)
src/app/api/**/route.ts (modul lama)              (bungkus withPermission)
docs/README.md, docs/06-security-konvensi.md      (pointer ke docs/rbac)
```

---

## 4. Pengujian

**Unit** — `permissions.can` (allow/deny/superadmin/fail-closed), normalisasi
phone/nik, mapper mask NIK, `moduleKeyForApiPath` (prefix tumpang-tindih).

**Integrasi** (PowerShell + `Invoke-WebRequest` + cookie sesi, pola RM.01):
- Login `admin` → CRUD pengguna happy-path (create→list→edit→reset→nonaktif).
- Buat user `operator` uji → login sbagai operator → akses modul berizin OK,
  modul `master.*` **403** (page & API).
- Ubah grant operator → verifikasi efek ≤ TTL cache.
- Nonaktifkan user → refresh/login **gagal**.
- **Bersih-bersih**: hapus user/peran uji dari `reporthub` setelah tes (pola
  cleanup RM.01).

**Keamanan** — checklist [02](./02-otorisasi.md) §9 + [04](./04-master-pengguna.md) §7.

---

## 5. Rollout & Rollback

**Rollout**
1. Deploy Fase 1 (skema+seed+kode inti) — **belum** mengubah perilaku user
   (guard belum dipasang di modul lama). Verifikasi login & superadmin.
2. Deploy Fase 2 (guard + filter menu) setelah grant peran diverifikasi.
3. Deploy Fase 3–4 (Master UI).
4. Ganti sandi admin awal bila belum (memori [[app-db-auth]]).

**Rollback aman**
- Kolom enum `users.role` **tidak** langsung di-drop (lihat [01](./01-model-data.md) §5
  langkah 6) → bisa balik ke pembacaan enum bila perlu.
- Guard modul lama bisa dinonaktifkan cepat (feature flag / revert bungkus) tanpa
  menyentuh DB.
- Seed idempoten → aman dijalankan ulang.

---

## 6. Uji CI Opsional (penjaga konsistensi)

- **Setiap** `src/app/api/<prefix>/**/route.ts` yang path-nya cocok modul (via
  `moduleKeyForApiPath`) harus mengekspor handler hasil `withPermission` — kecuali
  allowlist (`/api/auth`, `/api/sign`). Cegah endpoint "bocor" tanpa guard.
- **Setiap** `moduleKey` di `nav.ts` ada di katalog `MODULES`.
- Grant seed hanya memakai `moduleKey:action` yang valid (`isValidModuleAction`).

---

## 7. Definition of Done (keseluruhan)

- [ ] RBAC dinamis berjalan: peran di DB, grant per modul+aksi, superadmin bypass.
- [ ] Halaman & API semua modul dijaga; menu terfilter izin; fail closed.
- [ ] Master › Pengguna: modal Tambah Akun lengkap + Peran & Hak Akses operasional.
- [ ] PII (NIK/tgl lahir) & sandi ditangani aman; audit tercatat.
- [ ] SIMGOS tak tersentuh; semua state di `reporthub`.
- [ ] `tsc` 0, `eslint` 0; pengujian integrasi & keamanan lulus; data uji dibersihkan.

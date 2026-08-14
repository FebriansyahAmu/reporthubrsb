# 03 — Katalog Modul

> **Katalog modul = sumber kebenaran di kode** (`src/server/rbac/modules.ts`).
> Modul terikat ke rute/fitur yang benar-benar ada. DB hanya menyimpan **grant**
> (peran → `moduleKey:action`) yang divalidasi terhadap katalog ini.

---

## 1. Bentuk Data Katalog

```ts
// src/server/rbac/modules.ts
import type { LucideIcon } from "lucide-react";
import { Users, /* … */ } from "lucide-react";

export type ModuleAction = "view" | "create" | "update" | "delete" | "print";

export type AppModule = {
  key: string;              // stabil & unik: "master.pengguna", "kunjungan", …
  group: string;            // grup tampilan/menu: "Master", "Monitoring", …
  label: string;
  description?: string;
  icon: LucideIcon;
  navHref?: string;         // rute UI utama (untuk menu). Boleh kosong (modul non-menu).
  apiPrefixes: string[];    // prefix /api/... yang dijaga izin modul ini
  actions: ModuleAction[];  // aksi yang tersedia untuk modul ini
  order: number;
};

export const MODULES: readonly AppModule[] = [ /* lihat §2 */ ];

// --- Helper turunan (dipakai guard, nav, validasi grant) ---
const BY_KEY = new Map(MODULES.map((m) => [m.key, m]));
export const MODULE_KEYS = MODULES.map((m) => m.key);

export function getModule(key: string) { return BY_KEY.get(key); }

/** Validasi grant sebelum ditulis / saat resolusi (buang grant usang). */
export function isValidModuleAction(key: string, action: string): boolean {
  const m = BY_KEY.get(key);
  return !!m && (m.actions as string[]).includes(action);
}

/** Peta prefix API → moduleKey (untuk kontrak & cek CI). Prefix terpanjang menang. */
export function moduleKeyForApiPath(pathname: string): string | null {
  let best: { key: string; len: number } | null = null;
  for (const m of MODULES) {
    for (const p of m.apiPrefixes) {
      if ((pathname === p || pathname.startsWith(p + "/")) && (!best || p.length > best.len)) {
        best = { key: m.key, len: p.length };
      }
    }
  }
  return best?.key ?? null;
}
```

> **Kenapa di kode, bukan DB?** Lihat [01-model-data.md](./01-model-data.md) §1 &
> [README](./README.md) Keputusan **D2**. Ringkas: modul = rute nyata yang di-deploy;
> menaruhnya di DB berisiko grant "yatim" (menunjuk rute tak ada) atau rute tanpa
> entri. Menambah modul = menambah baris di array ini (satu PR, ter-review).

---

## 2. Katalog Awal (memetakan fitur yang sudah ada + Master baru)

Diturunkan dari `src/components/layout/nav.ts` + folder `src/app/api/**` saat ini.

| `key` | Grup | `navHref` | `apiPrefixes` | Aksi | Catatan |
|---|---|---|---|---|---|
| `kunjungan` | Menu | `/kunjungan` | `/api/kunjungan` | view | Daftar kunjungan pasien |
| `monitoring.antrean-bpjs` | Monitoring | `/monitoring/antrean-bpjs` | `/api/monitoring/antrean-bpjs` | view, update | "Sesuaikan task" = update |
| `monitoring.pelayanan` | Monitoring Pelayanan | `/monitoring/pelayanan/kunjungan` | `/api/monitoring/pelayanan` | view | Mencakup kunjungan/belum-final/diagnosa/resume |
| `berkas-klaim` | Berkas Klaim | `/berkas-klaim/rm` | `/api/berkas-klaim` | view, print | + `/api/print/simgos` (cetak) |
| `form-rm` | Form RM | `/form-rm` | `/api/form-rm` | view, create, update, print | Isi/simpan formulir RM |
| `laporan` | Laporan | `/laporan` | `/api/laporan` | view, print | Pusat Laporan (katalog) |
| **`master.pengguna`** | **Master** | `/master/pengguna` | `/api/master/pengguna` | view, create, update, delete | **Baru** — kelola akun |
| **`master.peran`** | **Master** | `/master/peran` | `/api/master/peran` | view, create, update, delete | **Baru** — peran & hak akses |

Catatan pemetaan:
- **`monitoring.pelayanan`** sengaja **satu modul** untuk 4 sub-halaman
  (kunjungan/belum-final/diagnosa/resume) agar izin sederhana. Bila kelak perlu
  beda izin per sub-halaman, pecah jadi beberapa `key` — tak ada perubahan arsitektur.
- **`/api/print/simgos/*`** dijadikan bagian `apiPrefixes` `berkas-klaim` (atau modul
  cetak tersendiri bila diinginkan). Tetapkan saat implementasi sesuai kebijakan cetak.
- **`/api/sign/*`** & **`/api/auth/*`** **tidak** masuk katalog — publik/authn-only
  (lihat [02-otorisasi.md](./02-otorisasi.md) §5.1).

---

## 3. Kontrak Prefix API ↔ Modul

Aturan wajib: **setiap `route.ts` di bawah prefix suatu modul harus dibungkus
`withPermission(<moduleKey>, <action>)`** dengan aksi sesuai metode:

| Metode HTTP | Aksi default |
|---|---|
| `GET` | `view` |
| `POST` (buat) | `create` |
| `PUT`/`PATCH` | `update` |
| `DELETE` | `delete` |
| Cetak/ekspor | `print` |

`moduleKeyForApiPath()` (§1) dipakai untuk:
- **Uji/CI**: pastikan tak ada endpoint di bawah prefix modul yang lupa dijaga.
- **Dokumentasi hidup**: menurunkan tabel prefix→modul otomatis.

> **Bukan magic middleware.** Penegakan tetap **eksplisit** per handler
> (`withPermission`), bukan disisipkan diam-diam berdasarkan path. Peta path hanya
> alat bantu verifikasi, bukan jalur penegakan utama — supaya mudah dibaca & di-audit.

---

## 4. Integrasi dengan Menu (`nav.ts`)

`NAV` diperkaya `moduleKey` per item, lalu difilter sesuai izin (lihat
[02-otorisasi.md](./02-otorisasi.md) §7):

```ts
// src/components/layout/nav.ts  (perubahan)
export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  description?: string;
  moduleKey: string;        // ← BARU: kaitkan item ke modul untuk filter izin
};
```

- Tambah **section baru "Master"** dengan item **Pengguna** (`master.pengguna`) &
  **Peran & Hak Akses** (`master.peran`).
- Saat render, buang item yang `moduleKey`-nya tak ada di `allowedModuleKeys(user.role)`;
  section yang jadi kosong disembunyikan.
- Superadmin melihat semua.

> **Satu sumber, dua konsumen:** idealnya label/ikon/href menu diturunkan dari
> `MODULES` (katalog) agar tak ganda. MVP boleh menjaga `nav.ts` terpisah tapi
> **wajib** memakai `moduleKey` yang sama persis dengan katalog. Konsolidasi penuh
> (nav dibangun dari katalog) bisa jadi langkah rapikan berikutnya.

---

## 5. Cara Menambah Modul Baru (checklist developer)

1. Tambah entri di `MODULES` (`src/server/rbac/modules.ts`): `key`, `group`,
   `label`, `icon`, `navHref`, `apiPrefixes`, `actions`, `order`.
2. Tambah item menu di `nav.ts` dengan `moduleKey` sama (bila muncul di sidebar).
3. Proteksi halaman: `await requireModule("<key>")` di `layout.tsx`/`page.tsx`.
4. Proteksi API: bungkus tiap handler dengan `withPermission("<key>", "<action>")`.
5. Beri grant awal ke peran non-superadmin yang membutuhkan (via UI Peran & Hak Akses
   atau seed). Superadmin otomatis dapat.
6. Tambah entri di uji CI prefix→modul (bila ada). Selesai — **tanpa** migrasi DB
   (grant baru = baris `role_permissions`, bukan skema).

---

## 6. Definition of Done (katalog)

- [ ] `MODULES` mencakup semua fitur/route yang ada + Master.
- [ ] `isValidModuleAction()` menolak `moduleKey`/`action` di luar katalog.
- [ ] `moduleKeyForApiPath()` benar untuk prefix tumpang-tindih (terpanjang menang).
- [ ] `nav.ts` memakai `moduleKey` yang identik dengan katalog.
- [ ] Menambah modul baru tidak perlu perubahan skema DB.

Lanjut ke → [04-master-pengguna.md](./04-master-pengguna.md)

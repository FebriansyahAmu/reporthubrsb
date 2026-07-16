# ReportHub RSB — Dokumentasi Perencanaan & Arsitektur

> Aplikasi **SaaS pelaporan & cetak** untuk melengkapi cetakan report yang tidak
> disediakan oleh SIMRS **SIMGOS**. Aplikasi ini **membaca langsung** dari
> database SIMGOS (via stored procedure & query read-only) dan menyajikannya
> dalam UI modern serta output cetak.

---

## 🚨 HIGH ALERT — Aturan Paling Utama

> **DILARANG KERAS menambah tabel, mengubah struktur tabel, atau menulis data
> apa pun ke database SIMGOS.** Aplikasi ini **READ-ONLY** terhadap SIMGOS.

Aturan ini **wajib** dan ditegakkan berlapis (defense in depth):

1. **Level database** — koneksi ke SIMGOS memakai user MySQL khusus yang hanya
   punya hak `SELECT` + `EXECUTE`. Secara fisik tidak bisa `INSERT/UPDATE/DELETE`
   apalagi `CREATE/ALTER/DROP`.
2. **Level Prisma** — schema SIMGOS hanya boleh di-`db pull` (introspect). **Tidak
   pernah** `migrate` / `db push` terhadap SIMGOS.
3. **Level aplikasi** — semua state milik kita sendiri (user, role, audit, konfigurasi)
   disimpan di **database aplikasi terpisah**, bukan di SIMGOS.
4. **Level proses** — code review & CI menolak perubahan yang melanggar aturan ini.

Detail penegakan ada di [03-database-prisma.md](./03-database-prisma.md) dan
[06-security-konvensi.md](./06-security-konvensi.md).

---

## Ringkasan Keputusan Arsitektur

| Topik | Keputusan | Alasan |
|---|---|---|
| Topologi DB SIMGOS | **Multi-database** (master, pendaftaran, medicalrecord, dst.) | Sesuai instalasi SIMGOS klasik; DAL memakai nama ter-kualifikasi `db.tabel` + stored procedure |
| Model deployment | **Single RS, SaaS-ready** | Mulai untuk 1 rumah sakit, tapi arsitektur siap berkembang (auth, role, audit) |
| Strategi data | **Dual-database** | SIMGOS read-only + database aplikasi read-write terpisah, agar HIGH ALERT terjaga |
| Akses data SIMGOS | **Stored procedure & raw query read-only** via Prisma `$queryRaw` | Prisma tidak punya first-class SP; raw query parameterized paling pas |
| Format cetak | **Bertahap**: browser print (CSS) → server PDF (Puppeteer) | Cepat & andal dulu, arsip PDF menyusul |

---

## Lingkup (Scope) Fase Ini

### Menu
1. **Kunjungan Pasien** — daftar/list kunjungan pasien.
2. **Report**
   - **Laporan Kunjungan Pasien** — rekap kunjungan dengan filter.
   - **Cetak Resume Medik** — cari berdasarkan kunjungan yang **sudah selesai**, lalu cetak.

### Di luar lingkup fase ini (lihat [07-roadmap.md](./07-roadmap.md))
- Multi-tenant penuh (banyak RS dalam satu instance).
- Export PDF server-side (fase lanjut).
- Report tambahan (keuangan, farmasi, dll).

---

## Peta Dokumen

| # | Dokumen | Isi |
|---|---|---|
| 00 | **README.md** (ini) | Ikhtisar, HIGH ALERT, scope, index |
| 01 | [01-arsitektur.md](./01-arsitektur.md) | Arsitektur sistem, dual-database, layering, alur request |
| 02 | [02-tech-stack-struktur.md](./02-tech-stack-struktur.md) | Tech stack, struktur folder, konvensi penamaan |
| 03 | [03-database-prisma.md](./03-database-prisma.md) | Multi-DB SIMGOS, introspection, guard read-only, stored procedure |
| 04 | [04-backend-layering.md](./04-backend-layering.md) | Layer DAL / Validation / Service / API secara detail |
| 05 | [05-frontend-design.md](./05-frontend-design.md) | Arsitektur UI, design system, Tailwind + Framer Motion |
| 06 | [06-security-konvensi.md](./06-security-konvensi.md) | Keamanan, env, error handling, konvensi kode |
| 07 | [07-roadmap.md](./07-roadmap.md) | Roadmap bertahap & definition of done |
| — | [workflows/kunjungan-pasien.md](./workflows/kunjungan-pasien.md) | Workflow fitur Kunjungan Pasien |
| — | [workflows/laporan-kunjungan-pasien.md](./workflows/laporan-kunjungan-pasien.md) | Workflow Laporan Kunjungan Pasien |
| — | [workflows/cetak-resume-medik.md](./workflows/cetak-resume-medik.md) | Workflow Cetak Resume Medik |

---

## Prinsip Utama

1. **Read-only terhadap SIMGOS** — tanpa kompromi (lihat HIGH ALERT).
2. **Layered & modular** — API → Service → Validation → DAL, per modul fitur.
3. **Typed end-to-end** — TypeScript strict + Zod di boundary + DTO eksplisit.
4. **Stored procedure sebagai kontrak** — SP/query dikunci di registry, tidak dinamis dari input user.
5. **Aman untuk data medis** — akses resume medik dicatat (audit) di DB aplikasi, bukan di SIMGOS.
6. **UI SaaS modern** — bersih, responsif, animasi halus, dengan mode cetak khusus.

---

## Status

📄 **Fase perencanaan** — dokumen ini adalah blueprint. Belum ada implementasi kode.
Implementasi mengikuti urutan di [07-roadmap.md](./07-roadmap.md).

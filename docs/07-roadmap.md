# 07 — Roadmap & Definition of Done

Urutan implementasi bertahap. Setiap fase punya **Definition of Done (DoD)** yang
jelas. Belum ada kode ditulis — ini rencana eksekusi.

---

## Fase 0 — Fondasi & Discovery

**Tujuan:** menyiapkan akses aman ke SIMGOS dan kerangka proyek.

- [ ] DBA SIMGOS membuat user `reporthub_ro` (SELECT + EXECUTE saja) — uji tak bisa menulis.
- [ ] Buat DB aplikasi `reporthub_app` + user `reporthub_app`.
- [ ] **Discovery SIMGOS**: petakan database, tabel, kolom, & stored procedure yang
      relevan (kunjungan, pasien, unit, dokter, diagnosa, tindakan, resep, status).
      Hasil → `docs/reference/simgos-map.md`.
- [ ] Setup 2 Prisma client (`simgos` RO, `app` RW) + script npm (tanpa migrate SIMGOS).
- [ ] `prisma db pull` SIMGOS; `prisma migrate` awal untuk DB aplikasi (User, AuditLog, SavedFilter).
- [ ] Kerangka `src/server/lib` (errors, http, result, pagination, audit, logger).
- [ ] Guard CI anti-write ke `simgos`.

**DoD:** koneksi RO terverifikasi (INSERT ditolak DB), peta SIMGOS terdokumentasi,
kerangka layer siap.

---

## Fase 1 — Auth & App Shell

**Tujuan:** kerangka aplikasi SaaS yang bisa login & bernavigasi.

- [ ] Autentikasi (login, session/JWT) + middleware proteksi route.
- [ ] RBAC dasar (ADMIN/OPERATOR/VIEWER) + guard `requireUser`/`requirePermission`.
- [ ] App shell: Sidebar (Kunjungan Pasien, Report), Topbar, PageHeader.
- [ ] Design tokens + komponen `ui/` inti (Button, Card, Table, Badge, Input, DateRange, Pagination).
- [ ] State feedback (Loading/Empty/Error) + Toast.

**DoD:** user bisa login, melihat shell, menu tampil sesuai role.

---

## Fase 2 — Menu Kunjungan Pasien

Referensi: [workflows/kunjungan-pasien.md](./workflows/kunjungan-pasien.md)

- [ ] DAL `queryKunjungan` + `countKunjungan` (raw parameterized, lintas-DB).
- [ ] Zod schema + service `getKunjunganList` (pagination).
- [ ] API `GET /api/kunjungan`.
- [ ] UI: filter (tanggal, cari nama/RM, status), tabel, pagination, status badge.
- [ ] 4 state UI + animasi list Framer Motion.

**DoD:** daftar kunjungan tampil, terfilter, terpaginasi, aman & typed end-to-end.

---

## Fase 3 — Laporan Kunjungan Pasien

Referensi: [workflows/laporan-kunjungan-pasien.md](./workflows/laporan-kunjungan-pasien.md)

- [ ] DAL rekap (stored procedure bila ada, atau raw agregat).
- [ ] Service + Zod filter (rentang tanggal, unit, dokter, status, cara bayar).
- [ ] API `GET /api/laporan/kunjungan` (+ ringkasan/summary).
- [ ] UI: panel filter tersinkron URL, kartu ringkasan, tabel rekap.
- [ ] Ekspor tabel (CSV/print) sederhana.
- [ ] Audit `VIEW_LAPORAN_KUNJUNGAN`.

**DoD:** laporan bisa difilter & dibaca; angka cocok dengan sampel data SIMGOS.

---

## Fase 4 — Cetak Resume Medik (Browser Print)

Referensi: [workflows/cetak-resume-medik.md](./workflows/cetak-resume-medik.md)

- [ ] Pencarian kunjungan **berstatus SELESAI** (DAL + service + API).
- [ ] Service `getResumeMedik` (rakit header + diagnosa + tindakan + resep) dengan
      aturan bisnis "hanya kunjungan selesai".
- [ ] Route cetak `/print/resume-medik/[kunjunganId]` (layout kertas, print CSS).
- [ ] Tombol Cetak (`window.print()`), kop RS, identitas, isi, tanda tangan.
- [ ] Audit `PRINT_RESUME_MEDIK`.

**DoD:** resume medik kunjungan selesai bisa dicari & dicetak rapi via browser; akses tercatat.

---

## Fase 5 — Export PDF Server-side

- [ ] Puppeteer render route cetak → PDF (`GET /api/resume-medik/[id]/pdf`).
- [ ] Konsistensi lintas browser + opsi arsip.

**DoD:** PDF resume medik identik dengan tampilan cetak; terunduh benar.

---

## Fase 6 — Pengerasan & Kualitas

- [ ] Test: unit (mapper/service/validation), integrasi (DAL), E2E (alur cetak).
- [ ] Checklist keamanan ([06-security-konvensi.md](./06-security-konvensi.md) §8) lolos.
- [ ] Kinerja: query pakai index, pagination server-side, cache data master.
- [ ] Dokumentasi operasional (deploy, env, backup DB aplikasi).

**DoD:** siap dipakai operator RS dengan andal & aman.

---

## Kandidat Fase Lanjut (belum dijadwalkan)

- Report tambahan (rawat inap, farmasi, keuangan) — pola sama, modul baru.
- Simpan/preset filter lanjutan, penjadwalan report, kirim email.
- Dark mode.
- Multi-tenant penuh (bila kelak melayani banyak RS): koneksi SIMGOS per-tenant,
  isolasi data DB aplikasi per-tenant.

---

## Prinsip Eksekusi

1. **Vertical slice** — selesaikan satu fitur menembus semua lapisan (DAL→UI) sebelum
   pindah, agar cepat terlihat nilai & risiko terungkap dini.
2. **Discovery dulu, kode kemudian** — jangan menebak nama tabel/SP; petakan dulu.
3. **HIGH ALERT di setiap PR** — pastikan tak ada jalur tulis ke SIMGOS.
4. **Typed & teruji** — DTO eksplisit, validasi di boundary, test aturan bisnis.

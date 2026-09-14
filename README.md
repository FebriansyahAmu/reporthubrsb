# AuditTrail RS BOLTIM — ReportHub RSB

Aplikasi **SaaS pelaporan, kelengkapan berkas & cetak dokumen** untuk RSUD Bolaang
Mongondow Timur. Melengkapi cetakan/laporan yang tidak disediakan SIMRS **SIMGOS**:
membaca **langsung** dari database SIMGOS (query & stored procedure **read-only**),
menyajikannya dalam UI modern, dan menyimpan dokumen yang diisi sendiri petugas
(Bukti Pelayanan, Form RM, penetapan pejabat) di database aplikasi terpisah.

> 🚨 **HIGH ALERT — SIMGOS READ-ONLY.** Dilarang keras menambah tabel, mengubah
> struktur, atau menulis data apa pun ke database SIMGOS (hanya `SELECT`/`EXECUTE`).
> Semua state milik aplikasi (pengguna, peran, audit, form, TTD, konfigurasi)
> disimpan di **database aplikasi `reporthub` yang terpisah & read-write**.

## Tech Stack

**Next.js 16** (App Router, Turbopack) · **React 19** · **TypeScript (strict)** ·
**Prisma 7** + `@prisma/adapter-mariadb` · **MySQL/MariaDB** · **Tailwind CSS v4** ·
**Zod v4** · **jose** (JWT) · **bcryptjs** · **Framer Motion** · **lucide-react** ·
**signature_pad** · **qrcode**

## Fitur

- **Dashboard** — ringkasan & grafik (tren kunjungan per-episode, sensus rawat inap)
  dengan kit chart SVG bawaan.
- **Monitoring Pelayanan** — pantau kelengkapan: *Belum Difinalkan*, *Kelengkapan
  Diagnosa*, *Kelengkapan Resume*.
- **Monitoring Antrean BPJS** — antrean registrasi online (regonline).
- **Berkas Klaim** — kelengkapan dokumen klaim per pasien (SEP, SPRI, Triase, CPPT,
  Resume), **Total Tagihan** + modal **Rincian Tagihan** (per komponen & per item),
  serta **Bukti Pelayanan JKN-KIS**: tindakan ditarik dari SIMGOS lalu bisa disunting,
  **tanda tangan peserta per tindakan**, QR nama petugas, dan tanda tangan **Kepala
  Ruangan** otomatis.
- **Form RM** (diisi admisi/petugas) — RM.01 *Ringkasan Masuk & Keluar*, RM.21
  *Edukasi Terintegrasi*, RM.03 *General Consent*; **penanda kelengkapan** per pasien
  di daftar IGD; penangkap **tanda tangan** (gambar / unggah / kamera / **via HP** lewat
  QR); cetak 1:1.
- **Resume Pulang (Discharge Planning)** — cetak via stored procedure SIMGOS.
- **Pengaturan / Master**
  - **Pengguna & Peran (RBAC)** — peran dinamis + grant izin per-modul, superadmin
    bypass, audit trail.
  - **Login via akun SIMGOS** — pengguna dapat masuk memakai akun SIMGOS-nya *bila*
    admin telah menetapkan perannya di aplikasi (sumber login "SIMGOS"); kredensial
    tetap diverifikasi read-only ke SIMGOS.
  - **Mapping Ruangan** — tetapkan Kepala Instalasi / Kepala Ruangan / Ketua Tim per
    ruangan (+ tanda tangan), dengan opsi *terapkan ke semua ruangan* satu instalasi.
    Kepala Ruangan menjadi penanda tangan Bukti Pelayanan.

Bahasa visual: *maritime "Cord"* (navy + harbor-blue), font Figtree, **mode terang**.

## Arsitektur singkat

- **Dua database, dua klien Prisma.** SIMGOS (banyak DB: `pendaftaran`, `medicalrecord`,
  `layanan`, `master`, `pembayaran`, `regonline`, `bpjs`, `aplikasi`, …) diakses
  **read-only** lewat satu koneksi, query ter-kualifikasi (`db.tabel` / `db.sp()`).
  `reporthub` (read-write) menyimpan data aplikasi.
- **Auth custom** (bukan NextAuth): access token 15 mnt + refresh 7 hari (jose,
  rotasi + reuse-detection), cookie **httpOnly**. Sandi lokal = **bcrypt**; akun
  SIMGOS diverifikasi memakai skema hashing SIMGOS (HMAC-SHA256 + bcrypt dengan
  kunci rahasia dari env).
- Layering: **API route → validasi (Zod) → service → DAL**.

## Persiapan

Prasyarat: Node.js 20+ dan akses jaringan ke server MySQL SIMGOS (read-only) &
`reporthub` (read-write).

```bash
npm install
cp .env.example .env    # lalu isi nilai-nilainya
npm run dev             # http://localhost:3000
```

Variabel `.env` (lihat [`.env.example`](.env.example)):

| Variabel                                    | Keterangan                                                                 |
| ------------------------------------------- | -------------------------------------------------------------------------- |
| `DATABASE_URL_SIMGOS`                       | Koneksi SIMGOS — user MySQL **hanya** `GRANT SELECT, EXECUTE`.             |
| `SIMGOS_PASSWORD_KEY`                        | `private_key` rahasia SIMGOS (`Aplikasi\Password`) untuk verifikasi login akun SIMGOS. |
| `DATABASE_URL_APP`                          | Koneksi database aplikasi `reporthub` (read-write).                        |
| `AUTH_ACCESS_SECRET` / `AUTH_REFRESH_SECRET`| Secret acak kuat untuk JWT access & refresh.                               |

## Skrip

| Perintah                      | Fungsi                                             |
| ----------------------------- | -------------------------------------------------- |
| `npm run dev`                 | Server pengembangan (Turbopack).                   |
| `npm run build` / `start`     | Build & jalankan produksi.                         |
| `npm run lint`                | ESLint.                                            |
| `npm run db:app:generate`     | Generate Prisma client aplikasi (`reporthub`).     |
| `npm run db:simgos:generate`  | Generate Prisma client SIMGOS (read-only).         |

> ⚠️ **Migrasi DB aplikasi:** `schema.prisma` bisa *drift* dari struktur live —
> `prisma db push` dapat menuntut perubahan destruktif. Untuk menambah kolom/tabel,
> gunakan **ALTER TABLE aditif manual** lalu `db:app:generate`, dan **restart** dev
> server setelah menambah model/kolom Prisma.

## Dokumentasi

Perencanaan & desain di [`docs/`](docs/README.md):

| Dokumen                                                     | Isi                                                |
| ----------------------------------------------------------- | -------------------------------------------------- |
| [docs/README.md](docs/README.md)                            | Ikhtisar, HIGH ALERT, scope                        |
| [01-arsitektur.md](docs/01-arsitektur.md)                   | Arsitektur sistem, dual-database, layering         |
| [02-tech-stack-struktur.md](docs/02-tech-stack-struktur.md) | Stack & struktur folder                            |
| [03-database-prisma.md](docs/03-database-prisma.md)         | Multi-DB SIMGOS, guard read-only, stored procedure |
| [04-backend-layering.md](docs/04-backend-layering.md)       | Layer API/Validation/Service/DAL                   |
| [05-frontend-design.md](docs/05-frontend-design.md)         | Design system & UI                                 |
| [06-security-konvensi.md](docs/06-security-konvensi.md)     | Keamanan & konvensi                                |
| [07-roadmap.md](docs/07-roadmap.md)                         | Roadmap bertahap                                   |
| [docs/rbac/](docs/rbac/)                                    | Model data & konvensi RBAC                          |
| [workflows/](docs/workflows/)                               | Workflow tiap fitur                                |

## Keamanan

- SIMGOS **read-only** mutlak; seluruh penulisan hanya ke `reporthub`.
- RBAC per-modul, penjaga anti-lockout superadmin, audit trail aksi administratif.
- Sandi tak pernah disimpan plaintext; refresh token disimpan sebagai hash.
- `.env` (berisi rahasia & `SIMGOS_PASSWORD_KEY`) **tidak** di-commit.

## Developer

Febriansyah Dirgantara Amu

## Versi

**v1.0.0** — rilis stabil pertama.

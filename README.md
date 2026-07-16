# ReportHub RSB

Aplikasi **SaaS pelaporan & cetak** untuk melengkapi cetakan report yang tidak
disediakan SIMRS **SIMGOS**. Aplikasi membaca **langsung** dari database SIMGOS
(stored procedure & query **read-only**) lalu menyajikannya dalam UI modern serta
output cetak.

> 🚨 **HIGH ALERT — READ-ONLY.** Dilarang menambah tabel, mengubah struktur, atau
> menulis data apa pun ke database SIMGOS. Semua state milik aplikasi (user, audit,
> konfigurasi) disimpan di **database aplikasi terpisah**. Detail: [docs/03-database-prisma.md](docs/03-database-prisma.md).

## Tech Stack

**Next.js 16** (App Router) · **React 19** · **TypeScript** · **Prisma** ·
**MySQL** · **Tailwind CSS v4** · **Framer Motion** · **Zod**

## Fitur (fase ini)

- **Kunjungan Pasien** — daftar/list kunjungan pasien.
- **Report**
  - **Laporan Kunjungan Pasien** — rekap kunjungan dengan filter.
  - **Cetak Resume Medik** — cari kunjungan yang sudah selesai, lalu cetak.

## Dokumentasi

Perencanaan & desain lengkap ada di folder [`docs/`](docs/README.md):

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
| [workflows/](docs/workflows/)                               | Workflow tiap fitur                                |

## Developer

Febriansyah Dirgantara Amu

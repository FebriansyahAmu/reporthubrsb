# AuditTrail RS BOLTIM — ReportHub RSB

Aplikasi web pelaporan, kelengkapan berkas, dan pengisian dokumen untuk RSUD Bolaang
Mongondow Timur. ReportHub membaca data SIMRS **SIMGOS** secara langsung untuk
menyajikan laporan dan cetakan yang tidak disediakan SIMGOS. Data milik aplikasi
sendiri (akun, form isian, tanda tangan, inventaris, audit) disimpan di database
terpisah **`reporthub`**.

Modul utama: Dashboard, Monitoring Pelayanan & Antrean BPJS, Laporan (RL 3.2, 3.5, 4.1,
5.1, pendapatan, domisili), Berkas & Verifikasi Klaim BPJS, Audit Trail RME, Form RM
(isian rekam medis + tanda tangan), BCKH, Inventarisasi Barang, dan Master (pengguna &
peran).

> 🚨 **SIMGOS hanya dibaca.** Aplikasi hanya menjalankan `SELECT`/`EXECUTE` ke SIMGOS;
> semua penulisan masuk ke `reporthub`. Jangan pernah memberi user SIMGOS hak tulis.

Teknologi: Next.js 16 · React 19 · TypeScript · Prisma 7 · MySQL/MariaDB · Tailwind
CSS v4. Dokumentasi teknis lengkap ada di [`docs/`](docs/README.md).

## Instalasi

### Prasyarat

- **Produksi:** Docker + Docker Compose (image sudah berisi Node.js).
- **Pengembangan:** Node.js 24 LTS (≥ 24.22.1).
- **Database MySQL/MariaDB:**
  - user SIMGOS dengan hak **hanya** `SELECT, EXECUTE`;
  - database `reporthub` dengan user baca-tulis.

### 1. Isi konfigurasi `.env`

```bash
cp .env.example .env
```

| Variabel | Wajib | Keterangan |
| --- | --- | --- |
| `DATABASE_URL_SIMGOS` | Ya | Koneksi SIMGOS (user `SELECT, EXECUTE` saja). |
| `DATABASE_URL_APP` | Ya | Koneksi database `reporthub`. |
| `AUTH_ACCESS_SECRET`, `AUTH_REFRESH_SECRET` | Ya | Dua secret acak yang berbeda. |
| `FORM_RM_KUNCI_INTEGRITAS` | Ya | Secret acak ≥ 32 karakter. **Jangan diganti** setelah dipakai. |
| `SIMGOS_PASSWORD_KEY` | Untuk login akun SIMGOS | Kunci hashing sandi dari instalasi SIMGOS. |
| `PUBLIC_APP_ORIGIN` | Untuk QR ruangan | Alamat aplikasi yang bisa dijangkau HP, mis. `https://reporthub.contoh.go.id`. |

Buat secret acak dengan:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

Pengaturan opsional lain (masa sesi, folder penyimpanan, aplikasi desktop) dijelaskan
di [`.env.example`](.env.example).

### 2. Produksi (Docker)

Pertama kali di server:

```bash
mkdir -p storage && sudo chown -R 1001:1001 storage   # folder unggahan (sekali saja)
docker compose build
docker compose run --rm migrate                        # migrasi database, lihat langkah 4
docker compose up -d
```

Aplikasi berjalan di `127.0.0.1:3003`. Pasang reverse proxy (HTTPS) di depannya.

Memperbarui ke versi baru:

```bash
git pull
docker compose build
docker compose run --rm migrate    # selalu jalankan; aman diulang
docker compose up -d
```

### 3. Pengembangan (lokal)

```bash
npm install                                  # sekaligus membuat Prisma client
node scripts/db/migrate-inventaris-all.mjs   # dan migrasi lain di langkah 4 bila perlu
npm run dev                                  # http://localhost:3000
```

Pemeriksaan: `npm run lint` dan `npm test`. Setelah mengubah `prisma/app/schema.prisma`,
jalankan `npm run db:app:generate` lalu restart `npm run dev`.

### 4. Migrasi database `reporthub`

Semua skrip hanya menulis ke `reporthub` (tidak pernah ke SIMGOS), idempoten, dan aman
diulang.

| Modul | Docker | Lokal |
| --- | --- | --- |
| Inventarisasi Barang | `docker compose run --rm migrate` | `node scripts/db/migrate-inventaris-all.mjs` |
| Form RM | `docker compose run --rm migrate scripts/db/migrate-form-rm.mjs` | `node scripts/db/migrate-form-rm.mjs` |
| BCKH | `docker compose run --rm migrate scripts/db/migrate-bckh.mjs` | `node scripts/db/migrate-bckh.mjs` |
| Laporan RL 3.2 & 3.5 | `docker compose run --rm migrate scripts/db/migrate-laporan-rl.mjs` | `node scripts/db/migrate-laporan-rl.mjs` |
| Verifikasi Klaim BPJS | `docker compose run --rm migrate scripts/db/migrate-verifikasi-klaim.mjs` | `node scripts/db/migrate-verifikasi-klaim.mjs` |
| Rekap Klaim BPJS | `docker compose run --rm migrate scripts/db/migrate-rekap-klaim.mjs` | `node scripts/db/migrate-rekap-klaim.mjs` |

Skrip di atas menambah tabel per modul; tabel inti (akun, peran, sesi, audit) sudah harus
ada di `reporthub`. **Jangan** memakai `prisma db push` ke `reporthub`: skema Prisma bisa
berbeda dari struktur live sehingga perintah itu dapat menghapus data.

## Versi

**v2.4.0** — 23 November 2026

- Redesign layar isian Form RM: RM.01, RM.03, RM.04, RM.21, RM.22, RM.33, RM.50.
- Checklist Pemeliharaan: pilihan ruangan bisa diketik dan langsung terbuka sesuai
  ruangan petugas; ruangan tugas kini juga diatur dari Master › Pengguna.
- Termasuk patch keamanan Next.js 16.4.6.
- **Saat memperbarui:** jalankan `docker compose run --rm migrate` (tabel baru
  `inv_ruangan_petugas`).

Riwayat versi sebelumnya ada di daftar tag Git (`git tag -n`).

Pengembang: Febriansyah Dirgantara Amu

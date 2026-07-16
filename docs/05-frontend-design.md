# 05 — Frontend & Design System

UI bergaya **SaaS modern**: bersih, cepat, responsif, animasi halus, dengan **mode
cetak khusus** untuk report. Stack: Next.js App Router + Tailwind CSS v4 + Framer
Motion.

---

## 1. Arsitektur UI

### 1.1 Dua "dunia" layout

| Dunia | Route | Layout | Tujuan |
|---|---|---|---|
| **Dashboard** | `app/(dashboard)/**` | Sidebar + Topbar (shell SaaS) | Kerja sehari-hari: lihat data, filter, aksi |
| **Print** | `app/print/**` | Tanpa chrome, layout kertas | Render bersih untuk cetak / PDF |

Halaman cetak **memakai DTO yang sama** dari service; hanya presentasi & CSS berbeda.

### 1.2 Server vs Client Component

- **Default = Server Component.** Ambil data di server (fetch ke service/API),
  kirim HTML minim JS.
- **Client Component** hanya untuk yang butuh interaktivitas: form filter, tabel
  interaktif, tombol cetak, animasi Framer Motion.
- Pola: page (server) memuat data awal → melempar ke komponen client untuk
  interaksi (filter, sort, paginate) yang memanggil API.

```
app/(dashboard)/laporan/kunjungan/page.tsx        (Server: render shell + data awal)
  └─ features/laporan-kunjungan/LaporanKunjunganView.tsx   (Client: filter, tabel, paginasi)
```

---

## 2. Struktur Komponen

```
src/components/            # Design system (reusable, tanpa logika fitur)
  ui/        → Button, Input, Select, DateRangePicker, Card, Badge,
               Table, Pagination, Modal, Tabs, Tooltip, Skeleton
  layout/    → AppShell, Sidebar, Topbar, PageHeader, Breadcrumb
  feedback/  → EmptyState, ErrorState, LoadingState, Toast

src/features/              # Komponen spesifik fitur (pakai components/ui)
  kunjungan/         → KunjunganTable, KunjunganFilters
  laporan-kunjungan/ → LaporanKunjunganView, LaporanFilters, LaporanSummaryCards
  resume-medik/      → ResumeMedikSearch, ResumeMedikPreview, PrintButton
```

Aturan: `features/*` tidak menaruh style mentah berulang — pakai komponen `ui/`.

---

## 3. Design System

### 3.1 Arah rasa (design direction)

Produk ini adalah **alat operasional rumah sakit**, bukan landing page marketing.
Rasa yang dituju: **profesional, tenang, presisi, kredibel** — mirip tool operasional
kelas atas (data-dense tapi lapang, bukan ramai). Prinsipnya:

- **Restrained, bukan dekoratif.** Netral mendominasi; satu warna aksen dipakai
  dengan sengaja untuk aksi & penanda status — bukan menghias.
- **Data yang mudah dipindai.** Angka & tabel adalah bintang utama: tipografi jelas,
  garis pemisah halus, alignment rapi, angka rata kanan (tabular).
- **Permukaan datar & bersih.** Andalkan **hierarki via spacing + border + shadow
  halus**, bukan gradien warna-warni.
- **Konsisten light & dark.** Token yang sama, bukan dua desain berbeda.

#### 🚫 Yang dihindari (aturan tegas)

- **Tanpa indigo / violet / ungu** sebagai brand, aksen, maupun link.
- **Tanpa gradien multi-hue generik** ala template SaaS (indigo→violet→pink,
  "aurora/mesh gradient", glow warna-warni). Kalau butuh kedalaman, gunakan **tonal
  halus satu-hue** (mis. teal gelap→teal lebih gelap) atau netral saja.
- Tanpa glassmorphism berlebihan, neon, drop-shadow tebal, atau emoji sebagai ikon UI.
- Tanpa warna dekoratif tanpa makna — setiap warna punya arti (status/aksi).

### 3.2 Palet warna

**Brand: Teal** (klinis, tenang, terpercaya) di atas **netral Slate** (cool gray).
Teal dipilih justru karena menjauh dari klise indigo/violet dan cocok konteks medis.
Aksen sekunder memakai **biru laut/cyan** yang jelas *bukan* indigo — hanya untuk
info/link, dipakai hemat.

| Peran | Token | Light | Keterangan |
|---|---|---|---|
| Brand/primary | `--brand-600` | `#0f766e` | teal-700, warna aksi utama |
| Brand hover | `--brand-700` | `#115e59` | state hover/active |
| Brand soft | `--brand-50` | `#f0fdfa` | latar badge/hover lembut |
| Accent (info) | `--accent-600` | `#0369a1` | sky-700, link & info (bukan indigo) |
| Netral fg | `--fg` | `#0f172a` | slate-900, teks utama |
| Netral muted | `--muted` | `#64748b` | slate-500, teks sekunder |
| Latar app | `--bg` | `#f8fafc` | slate-50 |
| Surface/card | `--surface` | `#ffffff` | kartu, panel, tabel |
| Border | `--border` | `#e2e8f0` | slate-200, garis halus |
| Success | `--success-600` | `#059669` | emerald-600 |
| Warning | `--warning-600` | `#d97706` | amber-600 |
| Danger | `--danger-600` | `#dc2626` | red-600 |

> Skala penuh (50–900) untuk teal, slate, dan warna semantik didefinisikan saat
> implementasi. Semua pasangan teks/latar wajib lolos kontras WCAG AA (§8).

### 3.3 Design tokens (CSS variables)

Didefinisikan di `globals.css`, dipakai lewat util Tailwind (v4 `@theme`). Dark mode
override token yang sama — komponen tidak perlu tahu tema.

```css
:root {
  /* Warna — light */
  --bg:            #f8fafc;   /* slate-50  */
  --surface:       #ffffff;
  --surface-2:     #f1f5f9;   /* slate-100 (header tabel, zebra) */
  --border:        #e2e8f0;   /* slate-200 */
  --border-strong: #cbd5e1;   /* slate-300 */
  --fg:            #0f172a;   /* slate-900 */
  --fg-muted:      #64748b;   /* slate-500 */

  --brand:         #0f766e;   /* teal-700  */
  --brand-hover:   #115e59;   /* teal-800  */
  --brand-fg:      #ffffff;
  --brand-soft:    #f0fdfa;   /* teal-50   */
  --brand-ring:    #99f6e4;   /* teal-200  (focus ring) */

  --accent:        #0369a1;   /* sky-700 — info/link, HEMAT */
  --success:       #059669;
  --warning:       #d97706;
  --danger:        #dc2626;

  /* Radius */
  --radius-sm: 6px; --radius-md: 10px; --radius-lg: 14px; --radius-full: 9999px;

  /* Elevation — halus, berlapis (bukan shadow tebal) */
  --shadow-xs: 0 1px 2px rgba(15,23,42,.04);
  --shadow-sm: 0 1px 2px rgba(15,23,42,.06), 0 1px 3px rgba(15,23,42,.08);
  --shadow-md: 0 2px 4px rgba(15,23,42,.06), 0 4px 12px rgba(15,23,42,.08);

  /* Spacing (base-4): 4 8 12 16 20 24 32 40 48 64 — pakai skala Tailwind */
}

/* Dark mode — override token yang sama (fase lanjut, sudah disiapkan).
   Definisikan nilai gelap sekali, lalu picu via preferensi OS ATAU toggle manual. */
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) { /* nilai dark di bawah */ }
}
:root[data-theme="dark"] {
  --bg:            #0b1220;
  --surface:       #0f172a;   /* slate-900 */
  --surface-2:     #111c30;
  --border:        #1e293b;   /* slate-800 */
  --border-strong: #334155;   /* slate-700 */
  --fg:            #e2e8f0;   /* slate-200 */
  --fg-muted:      #94a3b8;   /* slate-400 */
  --brand:         #14b8a6;   /* teal-500 (lebih terang di gelap) */
  --brand-hover:   #2dd4bf;   /* teal-400 */
  --brand-soft:    #042f2e;
  --accent:        #38bdf8;   /* sky-400 */
}
```

> Pola final (OS + toggle) dikunci saat implementasi. Intinya: **satu set token
> gelap**, dipicu preferensi sistem maupun toggle `data-theme` — komponen tetap
> memakai `var(--*)` tanpa tahu temanya.

### 3.4 Tipografi

Dua keluarga maksimal. Geist Sans (sudah ada) untuk UI, **Geist Mono untuk angka**
di tabel/laporan agar rapi & mudah dibandingkan (tabular-nums).

| Peran | Ukuran | Weight | Line-height |
|---|---|---|---|
| Display / judul halaman | 24–28px | 600 | 1.2 |
| Section heading | 18–20px | 600 | 1.25 |
| Body | 14–16px | 400–450 | 1.5 |
| Label / meta | 12–13px | 500 | 1.4 |
| Angka tabel/statistik | 14–16px | 500, `tabular-nums`, rata kanan | 1.4 |

Skala modular: 12 · 13 · 14 · 16 · 18 · 20 · 24 · 28 · 32. Judul memakai tracking
sedikit ketat (`-0.01em`); teks kecil jangan di bawah 12px.

### 3.5 Status badge (dipakai di kunjungan/report)

Badge = teks + **titik/ikon warna**, jangan hanya warna (aksesibilitas §8). Gaya:
latar `*-soft`, teks warna pekat, border tipis — bukan blok warna penuh.

| Status | Warna | Bentuk | Label |
|---|---|---|---|
| `SELESAI` | success (emerald) | dot hijau + teks | Selesai |
| `DALAM_PROSES` | accent (sky) | dot biru + teks | Dalam Proses |
| `BARU` | netral (slate) | dot abu + teks | Baru |
| `BATAL` | danger (red) | dot merah + teks | Batal |

### 3.6 State komponen (wajib untuk setiap kontrol)

Setiap elemen interaktif mendesain **7 state**: default · hover · focus-visible ·
active · disabled · loading · error.

- **Focus terlihat jelas:** ring `2px` warna `--brand-ring` + offset — tidak pernah
  `outline: none` tanpa pengganti.
- **Hover halus:** pergeseran latar/border, bukan lompatan warna drastis.
- **Disabled:** turunkan opasitas + `cursor-not-allowed`, tetap terbaca.
- **Loading:** spinner/spinner-inline atau skeleton, tombol non-aktif saat submit.

Contoh anatomi tombol (varian sebagai prop eksplisit, bukan override ad-hoc):

| Varian | Penggunaan | Gaya |
|---|---|---|
| `primary` | aksi utama (Terapkan, Cetak) | latar `--brand`, teks putih, hover `--brand-hover` |
| `secondary` | aksi sekunder | latar `--surface`, border, teks `--fg` |
| `ghost` | aksi tersier / toolbar | transparan, hover `--surface-2` |
| `danger` | aksi destruktif | latar `--danger` |

Ukuran: `sm` (32px) · `md` (36–40px) · `lg` (44px). Radius `--radius-md`.

---

## 4. Framer Motion — Pola Animasi

Gunakan **untuk memperjelas, bukan menghias berlebihan**. Jaga cepat (150–250ms),
hormati `prefers-reduced-motion`.

| Elemen | Animasi |
|---|---|
| Transisi halaman / tab | fade + slide-up halus |
| Baris tabel muncul | stagger fade-in ringan saat data load |
| Modal / drawer filter | scale/opacity in, backdrop fade |
| Kartu ringkasan report | count-up angka + fade |
| Skeleton → data | crossfade |

Contoh pola (client component):

```tsx
"use client";
import { motion } from "framer-motion";

export function FadeIn({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
    >
      {children}
    </motion.div>
  );
}
```

> **Halaman cetak tidak beranimasi** — cetak butuh render statis & stabil.

---

## 5. State UI Wajib (setiap layar data)

Setiap tampilan data **harus** menangani keempat state ini secara eksplisit:

1. **Loading** — skeleton (bukan spinner kosong) menyerupai bentuk konten.
2. **Empty** — pesan ramah + saran aksi (mis. "Ubah rentang tanggal").
3. **Error** — pesan aman (tanpa detail DB) + tombol coba lagi.
4. **Data** — konten sebenarnya.

Komponen: `LoadingState`, `EmptyState`, `ErrorState` di `components/feedback`.

---

## 6. Pola Filter Report

Report memakai panel filter yang konsisten:

- **DateRangePicker** (rentang tanggal) — hampir semua report butuh ini.
- **Select unit/poli, dokter, status** — di-fetch dari data master (bisa di-cache).
- Tombol **Terapkan** & **Reset**; opsi **Simpan Filter** (SavedFilter di DB aplikasi).
- Filter tersinkron ke **URL query string** → bisa di-bookmark & di-share, dan jadi
  sumber kebenaran untuk fetch.

```
/laporan/kunjungan?from=2026-07-01&to=2026-07-16&unit=IGD&status=SELESAI&page=1
```

---

## 7. Halaman & Mode Cetak

### 7.1 Print CSS

`src/styles/print.css` (di-load di layout `print/`):

```css
@media print {
  @page { size: A4; margin: 14mm; }
  html, body { background: #fff; }
  .no-print { display: none !important; }
  .page-break { break-after: page; }
  /* Pastikan warna badge/tabel ikut tercetak */
  * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
}
```

### 7.2 Alur cetak (fase 1 — browser)

1. User buka `/print/resume-medik/[kunjunganId]` (layout tanpa sidebar).
2. Data resume di-fetch server-side (service yang sama).
3. Tombol **Cetak** (client, `.no-print`) memanggil `window.print()`.
4. Header kop RS, identitas pasien, isi resume, tanda tangan — tersusun rapi A4.

### 7.3 Fase 2 — PDF server-side

Route yang sama dirender Puppeteer menjadi PDF (endpoint `/api/resume-medik/[id]/pdf`),
untuk arsip/konsistensi lintas browser. Detail di
[workflows/cetak-resume-medik.md](./workflows/cetak-resume-medik.md).

---

## 8. Aksesibilitas & Responsif

- Kontras warna memenuhi WCAG AA (khusus teks status & badge).
- Semua kontrol dapat diakses keyboard; fokus terlihat.
- Tabel report: horizontal scroll pada layar kecil (bukan memaksa layout pecah).
- Target utama pemakaian: desktop (operator RS), tetap layak di tablet.

Lanjut ke → [06-security-konvensi.md](./06-security-konvensi.md)

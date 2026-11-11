# Font aplikasi (di-host sendiri)

Dimuat lewat `next/font/local` di `src/app/layout.tsx`. Semuanya berlisensi SIL OFL 1.1 (lihat `OFL-*.txt`).

| Berkas | Keluarga | Dipakai | Sumber (Google Fonts, subset latin, variabel `wght`) |
| --- | --- | --- | --- |
| `geist-latin-wght.woff2` | Geist v5, 100–900 | `--font-sans` (sejak 11 Nov 2026) | `https://fonts.gstatic.com/s/geist/v5/gyByhwUxId8gMEwcGFU.woff2` |
| `geist-mono-latin-wght.woff2` | Geist Mono v6, 100–900 | `--font-mono` | `https://fonts.gstatic.com/s/geistmono/v6/or3nQ6H-1_WfwkMZI_qYFrcdmhHkjko.woff2` |

Alasan tidak memakai `next/font/google`: Google kadang membalas URL `fonts.gstatic.com/l/font?kit=…&skey=…`, dan Turbopack gagal memprosesnya (`next/font/google queries have exactly one entry`). Selain itu, build produksi jadi tidak butuh akses internet.

Untuk memperbarui, ambil CSS `https://fonts.googleapis.com/css2?family=Geist:wght@100..900&display=swap` dengan User-Agent Chrome, salin URL pada blok `/* latin */`, lalu unduh berkasnya ke sini.

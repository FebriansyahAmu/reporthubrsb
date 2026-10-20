# Font aplikasi (di-host sendiri)

Dimuat lewat `next/font/local` di `src/app/layout.tsx`. Keduanya berlisensi SIL OFL 1.1 (lihat `OFL-*.txt`).

| Berkas | Keluarga | Sumber (Google Fonts, subset latin, variabel `wght`) |
| --- | --- | --- |
| `figtree-latin-wght.woff2` | Figtree v9, 300–900 | `https://fonts.gstatic.com/s/figtree/v9/_Xms-HUzqDCFdgfMm4S9DaRvzig.woff2` |
| `geist-mono-latin-wght.woff2` | Geist Mono v6, 100–900 | `https://fonts.gstatic.com/s/geistmono/v6/or3nQ6H-1_WfwkMZI_qYFrcdmhHkjko.woff2` |

Alasan tidak memakai `next/font/google`: Google kadang membalas URL `fonts.gstatic.com/l/font?kit=…&skey=…`, dan Turbopack gagal memprosesnya (`next/font/google queries have exactly one entry`). Selain itu, build produksi jadi tidak butuh akses internet.

Untuk memperbarui, ambil CSS `https://fonts.googleapis.com/css2?family=Figtree:wght@300..900&display=swap` dengan User-Agent Chrome, salin URL pada blok `/* latin */`, lalu unduh berkasnya ke sini.

# RM.03 General Consent — tampilan pengisian (redesign 19 Nov 2026)

Branch `feat/form-rm-consent-ui`. Hanya **layar pengisian** yang berubah. Cetak
(`ConsentDocument`, `/print/form-rm/isian/[id]`), skema data, path kolom, simpan
gabung per kolom, penanda SIMRS, log perubahan, dan tanda tangan tidak berubah.

## Masalah pada tampilan lama

| # | Masalah | Akibat |
|---|---|---|
| 1 | Isi persetujuan I–X disembunyikan dalam satu bilah lipat di tengah halaman, sementara III dan IV tampil lebih dulu sebagai isian. | Penomoran melompat (III, IV, lalu "I–X"); penjelasan kepada pasien mudah terlewat. |
| 2 | Kolom wajib untuk Finalkan tidak ditandai. | Petugas baru tahu kekurangannya saat dialog Finalkan menolak. |
| 3 | Halaman panjang tanpa navigasi atau gambaran kemajuan. | Petugas tidak tahu posisi dan apa yang tersisa. |
| 4 | Instruksi kertas "(coret yang tidak perlu)" ikut tampil; pilihan privasi berupa tombol toggle. | Membingungkan; pilihan eksklusif tidak tampil sebagai radio. |
| 5 | Telepon tanpa keyboard angka; jenis kelamin dropdown untuk 2 pilihan; tidak ada isi cepat nama penanda tangan atau tanggal. | Lebih banyak ketukan, terutama di tablet. |

## Tampilan baru

Empat langkah berurutan sesuai alur di meja admisi:

1. **Pasien & pendaftaran** — identitas (baca-saja), NIK (peringatan lunak bila bukan 16 digit), waktu, ruang, kelas.
2. **Penanggung jawab** — tombol **Pasien sendiri** (hanya saat nama PJ kosong), jenis kelamin sebagai radio, telepon `type=tel`, alamat yang tingginya mengikuti isi.
3. **Isi persetujuan I–IX** — poin I, II, V–IX berupa akordeon `<details>` (bisa **Buka/Tutup semua**; IX memuat daftar hak & kewajiban pasien). Poin III dan IV selalu terbuka, ditandai **Ada isian**, dengan isian di tempatnya.
4. **Pernyataan & tanda tangan** — teks X tampil penuh, tanggal (+ **Hari ini**), dua kartu tanda tangan berstatus "Sudah/Belum ditandatangani", isi cepat nama penanda tangan (pasien / penanggung jawab), kolom wajib bertanda `*`.

**Navigasi langkah** (scrollspy):
- **Layar ≥ 1280 px:** kolom samping lengket berisi 4 langkah dengan status (`n dari m terisi`), ditambah panel **Syarat finalisasi**. Panel ini memuat `<progress>` dan daftar syarat; butir yang belum terpenuhi memindahkan fokus ke kolomnya.
- **Layar lebih kecil:** bilah lengket di bawah topbar. Di bawah 640 px hanya tampil 4 bulatan bernomor (44 px) dan teks "Langkah n dari 4", tanpa geser samping. Panel syarat tampil di awal langkah 4.
- **Pengguna tanpa izin ubah:** daftar syarat dan semua pintasan isi disembunyikan; navigasi dan akordeon tetap bisa dipakai.

## Catatan teknis

- **Syarat FINAL satu sumber.** `SYARAT_FINAL_CONSENT` / `kekuranganConsent` (`consent.constants.ts`) dipakai registri (diperiksa server saat FINALKAN) dan layar. Teks pesannya sama dengan sebelumnya (`consent.test.ts`).
- **Scrollspy.** `scroll-target-group: auto` + `:target-current` bila didukung (Chrome 140+); `aria-current` diselaraskan saat `scrollend`. Peramban lain memakai IntersectionObserver dan kelas `.target-current`. Lightning CSS memberi peringatan build bahwa `:target-current` belum dikenal, tetapi aturannya tetap terbawa ke CSS hasil build.
- **`scroll-padding`.** Diberlakukan pada halaman yang memuat `[data-bilah-aksi-isian]` (semua form isian), di `globals.css`, supaya kolom yang difokus tidak tertutup topbar, bilah langkah, atau bilah aksi (WCAG 2.4.11).
- **Gotcha:** teks `sr-only` (berposisi absolut) di dalam wadah `overflow-x-auto` harus punya leluhur `relative` di wadah itu. Tanpa itu, teks tersebut lolos dari pemotongan dan melebarkan halaman ponsel.
- **`SelectOther`** (komponen bersama) kini memberi nama aksesibel pada kolom teks "Lainnya…" (`otherAriaLabel`; bawaan: placeholder tanpa "…").

## Verifikasi

- Unit: 746/746.
- UI RM.03: 57/57 (desktop, ponsel 390/360 px dengan emulasi sentuh, baca-saja, cetak).
- Regresi Form RM:

  | Uji | Hasil |
  |---|---|
  | Berlanjut L1 UI | 23/23 |
  | 10 formulir E2E | 154/154 |
  | 10 formulir UI | 81/81 |
  | Gabung per kolom E2E | 71/71 |
  | Keamanan berlanjut | 49/49 |

- Build produksi :3100. Data uji dibersihkan; SIMGOS hanya dibaca.

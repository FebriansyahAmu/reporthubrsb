# Tagihan Berkas Klaim & Gabung Tagihan IGD

Berkas & Klaim RS › Berkas Klaim RM › detail (`/berkas-klaim/rm/[nopen]`): total tagihan, rincian, dan opsi **Gabungkan Tagihan IGD** untuk episode rawat inap. Semua data dibaca dari SIMGOS (hanya SELECT). Perbaikan ini dibuat 27 Okt 2026.

## Tagihan sebuah pendaftaran

Tagihan yang menagih sebuah NOPEN diambil dari **`pembayaran.tagihan_pendaftaran`** (`PENDAFTARAN` = NOPEN, `STATUS = 1` → `TAGIHAN`), lalu `pembayaran.tagihan` dengan `STATUS IN (1, 2)`. Laporan Pendapatan memakai sumber yang sama.

Dulu kode memakai `tagihan.ID = NOPEN`. Nomornya memang biasanya sama, tetapi asumsi itu salah pada dua kasus. Data 120 hari, 2.287 pendaftaran aktif:

| Kasus | Jumlah | Akibat cara lama |
| --- | --- | --- |
| Nomor tagihan bergeser satu (mis. NOPEN 2610240017 ditagih di tagihan 2610240018) | 22 | Tampil tagihan **pasien lain** (21 kasus) |
| Tagihan digabung kasir (`pembayaran.gabung_tagihan` DARI → KE) | 102 | Tagihan asal jadi STATUS 0 dan rinciannya pindah ke tagihan tujuan, sehingga halaman menampilkan "Belum ada tagihan" |

Rincian item diambil dengan ID tagihan (`rincian_tagihan.TAGIHAN`), bukan NOPEN. Modal rincian menampilkan nomor tagihan bila berbeda dari NOPEN.

## Mencari IGD asal episode RI

Di SIMGOS, IGD dan rawat inap adalah pendaftaran (NOPEN) yang berbeda. `queryIgdAsalByRiNopen` mencarinya berurutan:

1. **SPRI langsung:** `perencanaan_rawat_inap.PENDAFTARAN_RI_NOMOR` = NOPEN RI.
2. **Satu tagihan di SIMRS:** kasir sudah menggabung IGD dan RI.
3. **IGD tepat sebelum masuk RI:**
   - pasien sama;
   - leg IGD dimulai sebelum leg RI pertama dan berakhir paling lama 24 jam sebelumnya;
   - bukan milik RI lain lewat SPRI.

   Labelnya "SPRI IGD belum tertaut" bila IGD itu punya SPRI, atau "tanpa SPRI" bila tidak.

**Mengapa langkah 3 perlu:** kolom `PENDAFTARAN_RI_NOMOR` baru terisi sejak Juli 2026 dan sering tidak menunjuk NOPEN RI final. Data 120 hari, 739 episode RI:

| Pola | Jumlah |
| --- | --- |
| SPRI langsung | 529 |
| Tanpa SPRI, ada IGD sebelum masuk RI | 126 |
| SPRI tanpa NOPEN RI | 54 |
| Tanpa SPRI, sudah satu tagihan | 21 |
| SPRI ke pendaftaran kosong (RI didaftar ulang) | 5 |
| SPRI ke pendaftaran **batal** (mis. RI 2609220012, SPRI → 2609220011) | 2 |
| Tanpa IGD | 1 |

**Akurasi langkah 3:** diuji terhadap 550 pasangan yang sudah pasti (SPRI langsung dan tagihan gabungan SIMGOS); hasilnya 550 cocok, 0 salah, 0 terlewat. Langkah 3 menemukan IGD untuk 188 dari 189 episode tanpa tautan. Tiap kueri ≤ 7 ms, karena memakai indeks NORM, NOPEN, dan KUNJUNGAN.

`perencanaan_rawat_inap.DIBUAT_TANGGAL` ber-`ON UPDATE CURRENT_TIMESTAMP`, jadi tidak dipakai sebagai waktu SPRI.

Resolver yang sama dipakai untuk opsi **Sertakan CPPT IGD**. Leg yang dipilih adalah leg ber-CPPT di episode IGD itu.

## Gabung tagihan

| Keadaan | Tampilan |
| --- | --- |
| IGD dan RI tagihan berbeda | Centang **Gabungkan Tagihan IGD (Rp …)**, NOPEN IGD, dan dasar penautannya. Bawaan tidak dicentang. `?igd=1` menjumlahkan total, komponen, dan item (badge IGD/RI). |
| IGD dan RI sudah satu tagihan di SIMRS | Keterangan "Sudah termasuk tagihan IGD NOPEN … — digabung di SIMRS". Tanpa centang, supaya tidak dijumlah dua kali. |
| Tagihan juga mencakup NOPEN lain | Keterangan "Tagihan ini juga mencakup NOPEN …". |

Hasil untuk 739 episode RI dalam 120 hari:

| Hasil | Jumlah |
| --- | --- |
| Bisa digabung | 636 (dulu ±448) |
| Sudah satu tagihan | 102 |
| Tanpa IGD | 1 |

API `/api/berkas-klaim/tagihan/[nopen]` (izin `berkas-klaim:view`) kini `no-store` + `nosniff`.

Kelengkapan "tagihan ada" di Verifikasi Klaim (`queryTagihanAda`) juga beralih ke `tagihan_pendaftaran`.

## Kode

- `src/server/modules/berkas-klaim/berkas-klaim.dal.ts`: `queryIgdAsalByRiNopen`, `queryCpptIgdSourceByNopen`, `queryTagihanHeader`, `queryRincianTagihan(tagihanId)`.
- `berkas-klaim.tagihan.service.ts`: `getTagihanRingkas`, `getTagihanLengkap`, `getTagihanIgdRingkas` (`sudahDigabung`), `getTagihanGabungan`.
- `src/features/berkas-klaim/TagihanPanel.tsx`, `TagihanRincian.tsx`.
- `src/server/modules/verifikasi-klaim/verifikasi.dal.ts` (`queryTagihanAda`).

## Validasi

- **E2E** (`scratchpad/gabung-e2e.mjs`) 25/25:
  - kasus pengguna;
  - 4 kasus khusus;
  - sudah digabung SIMGOS (tanpa hitung ganda);
  - RI digabung ke tagihan IGD;
  - 5 NOPEN bertagihan bergeser;
  - oracle SQL independen untuk **semua 739 episode RI**: tunggal 739/739, gabung 636/636, SPRI 529/529;
  - RBAC 401/403;
  - header.
- **UI** (`scratchpad/gabung-ui.mjs`) 7/7:
  - centang → total RI + IGD;
  - modal 21 item IGD + 161 RI;
  - opsi CPPT IGD;
  - keterangan sudah digabung;
  - ponsel 390 px;
  - tanpa galat JS.

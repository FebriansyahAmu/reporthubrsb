# PRD — Form RM Berlanjut IGD → Rawat Inap

**Versi:** 1.0, 11 Nov 2026. Disetujui untuk dikerjakan langkah demi langkah (§13).
**Sifat data SIMGOS:** **read-only.** Fitur ini tidak menulis apa pun ke SIMGOS. Bacaan SIMGOS hanya untuk menemukan episode IGD asal (SPRI / pendaftaran ≤ 24 jam), jenis leg, dan nama ruang, semuanya lewat SELECT berparameter.
**Terkait:** `PRD_Form_RM_Terpadu.md` (K8 — di episode mana RM.21/RM.01/RM.03 diisi; PRD ini menjawabnya), `PRD_TTD_Perangkat_Siaga.md` (pola hub SSE).

---

## 0. Keputusan pemilik (11 Nov 2026)

| #   | Keputusan                                                                                                                                                                                                                                         |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| K1  | Form berlanjut tahap ini: **RM.03 General Consent**, **RM.21 Edukasi Pasien & Keluarga Terintegrasi**, **RM.01 Ringkasan Masuk & Keluar**. RM.22 (persetujuan per tindakan) **tidak** ikut.                                                    |
| K2  | Dua petugas menyunting bersamaan → **gabung per kolom + langsung**. Perubahan disiarkan lewat SSE, kolom berbeda digabung otomatis di server (transaksi + kunci baris), pilihan "milik saya / milik mereka" hanya bila kolom yang **sama** bentrok. |
| K3  | Penautan episode: **SPRI otomatis**; tanpa SPRI, pendaftaran IGD pasien yang sama **≤ 24 jam** sebelumnya hanya **disarankan** dan wajib **dikonfirmasi** petugas RI. Pengelola RM dapat melepas tautan yang salah.                              |
| K4  | **Dua tabel baru** di DB `reporthub`: `form_rm_tautan_episode` dan `form_rm_isian_log` (log per kolom, **nilai lama → baru**). Tidak ada tabel lama yang diubah bentuknya. SIMGOS tidak disentuh.                                                |

**Keputusan sementara (bisa diubah tanpa merombak):**

| #   | Bawaan                                                                                                                                                                         | Cara mengubah                          |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------- |
| K5  | `wajibUntuk` ketiga form **tetap IGD** — hitungan kelengkapan tidak berubah. Sasaran (pemilih pasien) diperluas ke IGD **dan** Rawat Inap.                                       | satu baris registri per form           |
| K6  | FINALKAN boleh dari IGD maupun RI. Dialog memperingatkan bila pasien masih dirawat (RM.01/RM.21 biasanya difinalkan saat pulang) atau ada petugas lain sedang membuka isian.     | aturan di `syaratFinal`/dialog         |
| K7  | Simpan beruntun oleh orang yang sama dari unit yang sama dalam **≤ 5 menit** digabung menjadi satu entri log (nilai awal tetap tercatat).                                         | konstanta `JEDA_GABUNG_LOG_MS`         |

## 1. Latar belakang dan tujuan

**Kondisi sekarang (data SIMGOS & reporthub, dibaca 11 Nov 2026):**
- SIMGOS membuat **NOPEN baru** saat pasien IGD dirawat inap. Dari 560 episode RI dalam 90 hari, **514 (92 %)** punya SPRI dari IGD; **tidak satu pun** berbagi NOPEN dengan leg IGD. Satu episode IGD selalu berlanjut ke **tepat satu** episode RI (525/525).
- RM.03/RM.21/RM.01 diisi admisi di episode IGD (sasaran = IGD saja). Petugas RI tidak bisa membuka isian yang sama; kalau membuat sendiri, terjadi dua dokumen untuk satu perawatan.
- Bila dua petugas menyimpan isian yang sama, yang kalah mendapat 409 dan diminta "Muat ulang"; **perubahannya yang belum tersimpan hilang**.
- Data saat ini kecil: 25 isian ketiga form (24 DRAF, 1 FINAL); 1 isian sudah dibuat di episode rawat inap.

**Tujuan.**
- Satu perawatan IGD → RI = **satu dokumen** per form. Petugas IGD dan RI membuka, menyunting, dan mencetak dokumen yang sama.
- Perubahan dari satu unit **langsung terlihat** di unit lain, tanpa kehilangan ketikan siapa pun.
- Setiap perubahan **tercatat**: siapa, kapan, dari unit/ruang mana, kolom apa, nilai sebelum → sesudah.

**Ukuran keberhasilan.**
- Petugas RI membuka RM.03 pasien yang berasal dari IGD dan mendapati isian IGD, tanpa membuat isian baru (untuk episode ber-SPRI: tanpa langkah tambahan).
- Dua petugas menyunting kolom berbeda bersamaan: **0 perubahan hilang, 0 dialog konflik**.
- Perubahan tampil di layar petugas lain **< 1 detik** (LAN).
- Lulus seluruh uji §9.5 di build produksi.

## 2. Ruang lingkup

**Termasuk:**
- tautan episode RI ↔ episode IGD asal (otomatis SPRI, konfirmasi ≤ 24 jam, keputusan "isian terpisah", lepas tautan oleh pengelola RM);
- isian bersama untuk RM.03/RM.21/RM.01: dibuka dari IGD maupun RI, profil & pemilih pasien RI menampilkan isian IGD;
- isi otomatis SIMRS mengikuti rantai (episode terakhir lebih dulu, cadangan episode IGD);
- simpan gabung per kolom dalam transaksi, konflik per kolom, "timpa" eksplisit;
- log perubahan per kolom bersegel HMAC berantai + tab **Perubahan** di riwayat isian;
- SSE per isian: perubahan, status, kehadiran ("juga membuka: …");
- audit, uji keamanan, uji beban, panduan deploy.

**Tidak termasuk:**
- penyuntingan per karakter (CRDT/OT) — satuan gabung adalah **kolom**;
- sorotan langsung di dalam kotak isian yang berubah (T2; tahap ini memakai pemberitahuan berisi daftar kolom);
- form lain (cukup menambah penanda di registri bila kelak diperlukan, §8.1);
- perubahan hitungan kelengkapan (K5);
- penulisan apa pun ke SIMGOS.

## 3. Istilah

| Istilah             | Arti                                                                                                                         |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Episode akar        | Episode (NOPEN) IGD tempat perawatan dimulai. Isian bersama disimpan dengan `subjek` = NOPEN akar.                           |
| Episode lanjutan    | Episode RI yang ditautkan ke episode akar.                                                                                   |
| Rantai              | Episode akar + episode lanjutan aktifnya.                                                                                    |
| Form berlanjut      | Form yang ditandai `berlanjut` di registri (K1). Hanya form ini yang memakai rantai, simpan gabung, log, dan SSE.            |
| Konteks             | Episode (anggota rantai) tempat petugas membuka isian. Menentukan label unit/ruang di log dan kehadiran. Divalidasi server. |
| Dasar (base)        | Isi isian dari server yang terakhir dilihat klien. Pembanding gabung tiga arah.                                             |

## 4. Model: satu isian bersama, bukan salinan

| Opsi                                             | Keputusan   | Alasan                                                                                                                                                    |
| ------------------------------------------------ | ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Satu baris isian per rantai** (subjek = akar) | ✅ dipilih  | Satu sumber kebenaran. Tidak ada sinkronisasi antarbaris yang bisa meleset. Kunci unik `(form_kode, subjek, urutan)` yang sudah ada menjamin satu isian aktif. |
| Isian per episode + salin/sinkron                | ❌          | Dua dokumen bisa berbeda isi; sinkron dua arah butuh resolusi konflik antarbaris; cetak dan segel jadi ganda.                                             |
| Isian per episode tanpa sinkron                  | ❌          | Itulah masalah sekarang.                                                                                                                                  |

Akibatnya:
- Kolom `nopen` isian = NOPEN akar. Episode RI menemukan isian lewat `form_rm_tautan_episode`.
- Revisi tersegel (`form_rm_revisi`), TTD (`form_rm_ttd`), dan cetak tetap satu per isian — tidak berubah.
- Bila episode RI **sudah** punya isian sendiri untuk form itu (data lama), isian itu tetap dipakai untuk episode RI dan profil menandai **"Ada dua isian untuk perawatan ini"**; pengelola RM membatalkan salah satu. Tidak ada penggabungan data otomatis.

## 5. Alur pengguna

### 5.1 IGD mengisi

Sama seperti sekarang. Bila episode lanjutan sudah ada, pita di atas form menulis: **"Isian bersama IGD → Rawat Inap · Perawatan dilanjutkan di <ruang RI> (NOPEN …)."**

### 5.2 Rawat inap membuka form

Petugas RI memilih pasien rawat inap di pemilih RM.03/RM.21/RM.01 (sasaran kini IGD + RI). Server menentukan rantai:

| Keadaan episode RI                                       | Hasil                                                                                                                                                          |
| -------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Sudah punya tautan aktif                                 | Buka isian di episode akar (atau buat di sana bila belum ada).                                                                                                 |
| Belum bertautan, **ada SPRI** dari episode IGD pasien sama | Tautan dibuat otomatis (`SPRI`), lalu seperti baris pertama.                                                                                                  |
| Tanpa SPRI, ada pendaftaran IGD pasien sama ≤ 24 jam sebelumnya | Dialog **"Lanjutkan isian dari IGD?"** menampilkan tanggal masuk, ruang IGD, dan status isian di sana. Pilihan: **Lanjutkan isian IGD** (`WAKTU`) atau **Isi terpisah** (`TANPA`). Keputusan disimpan; tidak ditanya lagi. |
| Tidak ada asal IGD (masuk langsung dari poli)            | Isian dibuat di episode RI sendiri seperti biasa (tanpa tautan).                                                                                               |

Profil pasien RI menampilkan isian bersama dengan label **"dari IGD · NOPEN …"**. Daftar pemilih menampilkan statusnya juga (tautan dari tabel, kandidat SPRI dibaca sekaligus per halaman).

### 5.3 Dua petugas bersamaan

| Skenario                                                                                   | Yang terjadi                                                                                                                                                                                                                                                       |
| ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| A. Keduanya membuka isian                                                                  | Masing-masing melihat **"Juga membuka: Ns. Rina (Rawat Inap · Bougenville)"**.                                                                                                                                                                                      |
| B. IGD mengubah Alamat, RI tidak sedang mengetik                                          | Simpan otomatis IGD (3 dtk) → server menyiarkan → layar RI memuat isi terbaru < 1 dtk dan menampilkan **"Ns. Budi (IGD) mengubah: Alamat · 10:42"**.                                                                                                              |
| C. IGD mengubah Alamat, RI mengubah Diagnosa sementara, hampir bersamaan                  | Server menggabung keduanya per kolom dalam satu transaksi berkunci baris. **Tidak ada konflik**, tidak ada ketikan hilang. Masing-masing menerima isi gabungan.                                                                                                    |
| D. Keduanya mengubah **kolom yang sama** sebelum melihat perubahan yang lain               | Simpan pertama menang. Simpan kedua mendapat **konflik kolom**: panel menampilkan "Milik Anda" dan "Milik Ns. Budi (IGD, 10:42)" per kolom. Pilih **Pakai milik saya** (disimpan sebagai **TIMPA**, tercatat) atau **Pakai milik Ns. Budi**. Kolom lain tetap tersimpan. |
| E. Satu pihak memfinalkan saat pihak lain masih menyunting                                 | Dialog FINALKAN memperingatkan "Ns. Rina sedang membuka isian ini". Setelah final, layar pihak lain terkunci seketika. Bila ia punya perubahan yang belum tersimpan, pita mendaftar kolomnya agar bisa disampaikan ke pengelola RM (koreksi lewat **Buka koreksi**). |
| F. Satu pihak sedang luring / tab tersembunyi                                             | Aliran ditutup saat tab tersembunyi. Saat terlihat lagi, klien mengambil isi terbaru dan menggabungkannya dengan ketikan lokal (aturan sama dengan C/D).                                                                                                         |

### 5.4 Finalkan dan koreksi

Aturan status tidak berubah (`isian.status.ts`): FINAL hanya bisa dibuka lagi oleh pengelola RM. K6 menambah peringatan, bukan larangan.

### 5.5 Pengelola RM: lepas tautan

Di profil pasien RI, pengelola RM (`hak.kelola`) dapat **Lepas tautan** dengan alasan wajib. Baris tautan tidak dihapus: diberi `dilepas_at`, oleh, dan alasan. Setelah dilepas, episode RI diperlakukan seperti belum bertautan (dialog §5.2 muncul lagi untuk kandidat ≤ 24 jam; SPRI tidak otomatis menautkan ulang tautan yang pernah dilepas).

### 5.6 Log dan riwayat perubahan

Laci **Riwayat** isian mendapat tab **Perubahan**:
- per entri: waktu, petugas, unit + ruang konteks, aksi (Simpan / Timpa / Muat ulang SIMRS), daftar kolom dengan **sebelum → sesudah**;
- TTD ditampilkan sebagai "tanda tangan diganti", bukan gambar;
- status integritas rantai segel log (utuh / masalah), sama seperti revisi.

## 6. Aturan penautan

1. **Verifikasi server** setiap tautan (otomatis maupun konfirmasi):
   - episode lanjutan aktif (`pendaftaran.STATUS = 1`) dan punya leg RI, tanpa leg IGD;
   - episode akar aktif dan punya leg IGD;
   - **NORM sama** di kedua episode — tidak pernah menautkan pasien berbeda;
   - `WAKTU`: akar terdaftar sebelum lanjutan, selisih ≤ 24 jam; **akar yang dikirim klien harus sama dengan kandidat yang dihitung server** saat itu.
2. Satu episode lanjutan punya paling banyak **satu tautan aktif** (kolom `aktif_kunci` UNIQUE, §8.2).
3. Satu episode akar boleh punya lebih dari satu lanjutan (data tidak pernah menunjukkannya, tetapi tidak dilarang); semua lanjutan berbagi isian yang sama.
4. Tautan dibuat **saat dibutuhkan** (membuka form dari episode RI), tidak lewat proses latar. Daftar pemilih hanya **membaca** kandidat SPRI untuk tampilan.
5. Isian BATAL di akar → isian baru dibuat di akar dengan urutan berikutnya (perilaku sekarang).
6. Form tak berlanjut (RM.04, RM.22, …) tidak memakai tautan sama sekali.

## 7. Isi otomatis SIMRS pada rantai

- **Episode SIMRS** isian = episode lanjutan aktif terbaru bila ada, selain itu episode akar. Episode ini dipakai untuk isi otomatis isian baru, **Muat ulang dari SIMRS**, panel rujukan baca-saja, dan kolom **tertaut**.
- Sumber asesmen yang kosong tetap mengambil cadangan episode IGD (perilaku `ambilSumber` sekarang) — kini otomatis karena episode SIMRS = RI dan akarnya = IGD.
- **RM.01:** kolom tertaut *Keadaan keluar* mengikuti `pasien_pulang` episode **RI** (kepulangan akhir), bukan episode IGD. Tanggal/jam keluar, lama rawat, DPJP, dan diagnosa akhir dari RI lewat **Muat ulang dari SIMRS**.
- **RM.03:** *Kelas* dan *Ruangan rawat* tersedia setelah episode RI ada (sebelumnya kosong di IGD) lewat **Muat ulang dari SIMRS**.
- Isi isian yang sudah diketik petugas **tidak pernah ditimpa otomatis** — perbandingan SIMRS tetap pilihan petugas.

## 8. Arsitektur teknis

### 8.1 Berkas (rencana)

| Berkas                                                        | Isi                                                                                                       |
| ------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `features/form-rm/registry.ts`                                | penanda `berlanjut: "igd-ri"` di RM.01/RM.03/RM.21; sasaran `[2, 3]`                                      |
| `features/form-rm/gabung.ts` (+ test)                         | MURNI: daun path, beda dasar→lokal, gabung tiga arah, rebase, validasi path aman                          |
| `features/form-rm/label-kolom.ts` (+ test)                    | label manusiawi per path untuk ketiga form (log, konflik, pemberitahuan)                                  |
| `server/modules/form-rm/rantai.inti.ts` (+ test)              | MURNI: keputusan tautan dari baris SIMGOS + tautan tersimpan                                              |
| `server/modules/form-rm/rantai.dal.ts`                        | SELECT SIMGOS: kandidat akar (SPRI/WAKTU), satu & batch; verifikasi pasangan                              |
| `server/modules/form-rm/rantai.service.ts`                    | buka rantai, buat/konfirmasi/lepas tautan, episode SIMRS, konteks                                         |
| `server/modules/form-rm/isian.gabung.ts`                      | simpan mode gabung dalam transaksi + `FOR UPDATE`, konflik, TIMPA                                          |
| `server/modules/form-rm/isian.log.ts` (+ test inti)           | tulis/gabung entri log, segel berantai, baca + periksa integritas                                         |
| `server/modules/form-rm/isian.hub.ts`                         | hub SSE per isian (globalThis), kehadiran, batas                                                          |
| `app/api/form-rm/isian/[id]/aliran`, `/terkini`, `/log`        | rute SSE, isi terkini untuk rebase, log perubahan                                                         |
| `app/api/form-rm/tautan-episode` (+ `[id]/lepas`)             | konfirmasi `WAKTU`/`TANPA`, lepas tautan                                                                   |
| `features/form-rm/isian/useIsian.ts`                          | mode berlanjut: dasar, kirim ubah, rebase, konflik, aliran                                                 |
| `features/form-rm/isian/` (komponen baru)                     | `PitaBerlanjut`, `KehadiranIsian`, `PanelKonflik`, `DialogLanjutkanIgd`, tab Perubahan di `RiwayatIsianDrawer` |
| `scripts/db/form-rm.sql`, `scripts/db/migrate-form-rm.mjs`    | DDL dua tabel baru (idempoten)                                                                             |

### 8.2 Model data (dua tabel baru, K4)

DDL manual di `scripts/db/form-rm.sql` (bukan `prisma db push` — lihat catatan drift di memori proyek).

**`form_rm_tautan_episode`**

| Kolom                                   | Tipe            | Keterangan                                                                                 |
| --------------------------------------- | --------------- | ------------------------------------------------------------------------------------------ |
| `id`                                    | VARCHAR(30) PK  | cuid                                                                                       |
| `nopen_lanjutan`                        | VARCHAR(20)     | episode RI                                                                                 |
| `nopen_akar`                            | VARCHAR(20) NULL| episode IGD; NULL bila `dasar = TANPA`                                                     |
| `norm`                                  | VARCHAR(20)     | snapshot, sama di kedua episode                                                            |
| `dasar`                                 | VARCHAR(10)     | `SPRI` \| `WAKTU` \| `TANPA`                                                               |
| `aktif_kunci`                           | VARCHAR(20) NULL UNIQUE | = `nopen_lanjutan` selama aktif, NULL setelah dilepas (MariaDB tak punya indeks unik parsial) |
| `dibuat_oleh_id`, `dibuat_oleh_nama`    | VARCHAR(191)    | petugas yang membuka form (`SPRI` otomatis) atau yang mengonfirmasi (`WAKTU`/`TANPA`)       |
| `created_at`                            | DATETIME(3)     |                                                                                            |
| `dilepas_at`, `dilepas_oleh_id`, `dilepas_oleh_nama`, `alasan_lepas` | NULL | jejak pelepasan (VARCHAR(500) untuk alasan)                                   |

Indeks: `UNIQUE(aktif_kunci)`, `INDEX(nopen_akar)`, `INDEX(nopen_lanjutan)`.

**`form_rm_isian_log`** — append-only, kecuali entri **terakhir** yang boleh digabung (K7).

| Kolom                                   | Tipe            | Keterangan                                                                        |
| --------------------------------------- | --------------- | --------------------------------------------------------------------------------- |
| `id`                                    | VARCHAR(30) PK  | cuid                                                                              |
| `isian_id`                              | VARCHAR(30) FK  | → `form_rm_isian.id`, ON DELETE RESTRICT                                          |
| `urut`                                  | INT             | urutan per isian; `UNIQUE(isian_id, urut)`                                        |
| `rev_awal`, `rev_akhir`                 | INT             | rentang rev yang dicakup entri                                                    |
| `aksi`                                  | VARCHAR(20)     | `SIMPAN` \| `TIMPA` \| `MUAT_SIMRS` \| `BEKU_TERTAUT`                             |
| `oleh_id`, `oleh_nama`                  | VARCHAR(191)    |                                                                                   |
| `konteks_nopen`                         | VARCHAR(20)     | anggota rantai, divalidasi server                                                 |
| `konteks_unit`                          | VARCHAR(3)      | `IGD` \| `RI` \| `RJ`                                                             |
| `konteks_ruang`                         | VARCHAR(191) NULL | snapshot nama ruang leg konteks                                                 |
| `perubahan`                             | JSON            | `[{ p, s, j }]` = path, sebelum, sesudah (TTD sebagai referensi `ttd:<id>`)       |
| `hash`, `hash_sebelum`                  | CHAR(64)        | HMAC-SHA256 berantai per isian (domain terpisah dari segel revisi)                |
| `created_at`, `updated_at`              | DATETIME(3)     | diisi aplikasi, ikut disegel                                                      |

Indeks: `UNIQUE(isian_id, urut)`, `INDEX(isian_id, created_at)`.

Transisi status (FINALKAN, BUKA_KOREKSI, BATALKAN) tetap dicatat di `form_rm_revisi`; tab Perubahan menampilkan keduanya dalam satu linimasa.

### 8.3 Simpan gabung per kolom

**Permintaan** (form berlanjut): `PATCH /api/form-rm/isian/[id]`

```json
{ "revDasar": 12, "konteks": "<nopen>", "ubah": [{ "p": "alamat", "d": "<nilai dasar>", "n": "<nilai baru>" }], "timpa": ["diagnosaSementara"] }
```

Mode lama `{ rev, data }` tetap diterima untuk semua form (form tak berlanjut tidak berubah).

**Daun dan path** (`gabung.ts`, dipakai klien dan server):
- daun = nilai primitif atau larik primitif (mis. `persiapan.bahasa`) — larik primitif digabung **utuh**;
- larik objek berpanjang sama (mis. `entries` RM.21, 5 kategori tetap) ditelusuri per indeks; panjang berbeda → larik itu satu daun;
- segmen path: `[A-Za-z][A-Za-z0-9]{0,40}` atau indeks `0–999`; `__proto__`, `prototype`, `constructor` ditolak; path **harus ada** pada bentuk isian (data tersimpan atau `def.kosong()`) dan menunjuk **daun** (objek → ditolak) — selain itu 422 sebelum objek apa pun diubah;
- **bentuk sama di kedua sisi** (`bentukIsian`): kunci yang hilang dilengkapi dari `def.kosong()`, lalu `def.lengkapi` registri (mis. RM.01 Sebab Kematian II selalu 3 baris) — klien dan server menghasilkan path yang identik;
- paling banyak 500 ubah per permintaan.

**Server, satu transaksi:**
1. `SELECT id, rev, status, data, form_kode, form_versi FROM form_rm_isian WHERE id = ? FOR UPDATE` — data dibaca **lewat baris yang dikunci** (bukan SELECT biasa setelahnya: di REPEATABLE READ, snapshot SELECT biasa bisa tertinggal dari baris yang dikunci).
2. Hak kategori (`update`), status DRAF, path aman, konteks anggota rantai.
3. Per ubah: nilai sekarang `c` di path `p`:
   - `c ≡ d` → pasang `n`;
   - `c ≡ n` → tidak ada perubahan;
   - selain itu → **konflik**.
4. Ada konflik → **409** `CONFLICT` berisi `{ rev, isian, konflik: [{ p, label, mereka, oleh, unit, ruang, waktu }] }`; **tidak ada yang ditulis** (seluruh ubah ditolak agar klien merebase sekali dengan utuh).
   - **Pakai milik saya** = klien mengirim ulang dengan `d` = nilai mereka (dari 409) dan path itu di `timpa` → langkah 3 memasangnya biasa (`c ≡ d`). Bila di antaranya ada perubahan ketiga, konflik muncul lagi — benar.
   - `timpa` hanya menandai aksi log `TIMPA`; harus himpunan bagian dari path `ubah` (selain itu 422). Server tidak menyimpan state konflik antar-permintaan.
5. Kolom tertaut diabaikan (sama seperti sekarang); `def.skema.parse` atas hasil gabung (strict); `cekPerubahan(lama, baru)`; batas 256 KB; `pisahkanTtd`.
6. `UPDATE … SET data, rev = rev + 1, diubah_oleh_id` (baris sudah terkunci → tidak ada balapan).
7. Tulis/gabung entri log (§8.4) dengan nilai sebelum dari langkah 1.
8. Commit → **setelah commit**: audit (`form-rm.isian.simpan`, metadata tanpa isi) dan siarkan `berubah` (§8.5). Tidak pernah menyiarkan sebelum commit.

**Info "oleh siapa" untuk konflik** diambil dari entri log terakhir yang menyentuh path itu.

Kunci baris hanya dipegang selama satu transaksi (milidetik). Tidak ada kunci yang bertahan antar-permintaan.

### 8.4 Log perubahan

- Satu entri per simpan yang benar-benar mengubah kolom. Simpan tanpa beda tidak menulis apa pun.
- **Penggabungan (K7):** bila entri terakhir isian itu dibuat oleh orang yang sama, konteks sama, aksi `SIMPAN`, dan `updated_at` ≤ 5 menit lalu → entri itu diperbarui: `s` tetap nilai paling awal, `j` nilai terbaru, kolom yang kembali ke nilai awal dibuang, `rev_akhir` naik. Hanya entri **terakhir** yang boleh digabung, sehingga rantai tidak pernah ditulis ulang di tengah.
- **Segel:** `hash = HMAC(kunci, "form-rm.log|" + kanonik(isi))`, `isi` memuat `isian_id, urut, rev_awal, rev_akhir, aksi, oleh_id, konteks, perubahan, created_at, updated_at, hash_sebelum`. Kunci = `FORM_RM_KUNCI_INTEGRITAS` (tanpa kunci → 503, sama seperti revisi). Entri terakhir yang digabung disegel ulang; `hash_sebelum` tetap.
- **Baca:** hanya pengguna dengan `view` pada kategori form (404 seragam). Membaca log dicatat di audit (`form-rm.isian.log-lihat`).
- **audit_log umum tetap tanpa isi form** — nilai hanya ada di tabel log ini.

### 8.5 Hub dan protokol SSE

**Hub** (`isian.hub.ts`, memori proses di `globalThis`, pola `ttd-siaga/hub.ts`): `Map<isianId, Set<Koneksi>>`.

| Batas                         | Nilai                                       |
| ----------------------------- | ------------------------------------------- |
| aliran per pengguna           | 8 (tab ke-9 → 429)                          |
| aliran total                  | 400 (→ 503)                                 |
| umur maksimum satu aliran     | 10 menit, lalu event `segarkan` dan ditutup |
| detak                         | 20 dtk (event `detak`)                      |
| antrean macet                 | 64 KB → putus                               |

**Rute:** `GET /api/form-rm/isian/[id]/aliran?konteks=<nopen>` — sesi wajib (`authorizeAny`), asal sama, hak `view` kategori (404 seragam), hanya form berlanjut.

| Event       | Data                                                    | Catatan                                                    |
| ----------- | ------------------------------------------------------- | ---------------------------------------------------------- |
| `awal`      | `{ rev, status }`                                       | klien membandingkan rev dan mengambil isi terbaru bila tertinggal |
| `berubah`   | `{ rev, oleh, unit, ruang, kolom: [path], waktu }`      | **tanpa nilai kolom**                                       |
| `status`    | `{ rev, status, oleh }`                                 | FINAL / DRAF / BATAL                                        |
| `hadir`     | `{ daftar: [{ nama, unit, ruang }] }`                   | dedup per (pengguna, unit), tanpa id pengguna               |
| `segarkan`  | `{}`                                                    | umur aliran habis → sambung ulang (dicek ulang sesi & hak)  |
| `detak`     | `{}`                                                    |                                                             |

- Nilai kolom **tidak pernah** lewat SSE: klien mengambilnya lewat `GET /api/form-rm/isian/[id]/terkini` (hak dicek ulang setiap kali).
- Umur maksimum 10 menit membatasi jendela pengguna yang perannya dicabut masih menerima event `berubah`.
- Klien membuka aliran **hanya saat tab terlihat**, menutupnya saat tersembunyi, dan menyambung ulang manual (EventSource berhenti setelah respons non-200 — gotcha L2 TTD siaga).
- Hub satu proses; bila kelak multi-instance → pub/sub (Redis), antarmuka hub tetap kecil.
- `hadir` disusun **per penerima** (tanpa dirinya sendiri) dan disiarkan **digabung per 300 ms** per isian, sehingga gelombang sambung ulang (mis. server dimulai ulang) tidak membanjiri setiap aliran. Aliran baru langsung menerima daftar hadirnya sendiri.
- `berubah` memuat paling banyak 40 path; sisanya hanya dihitung (`lebih`).
- Laju: sambung aliran 30/menit/pengguna; `terkini` 120/menit/pengguna.
- `terkini` diaudit `form-rm.isian.terkini`, **dirangkum** satu entri per (pengguna, isian) per 10 menit — halaman yang terbuka mengambil isi terkini pada setiap perubahan petugas lain; pembukaan halaman tetap diaudit `lihat`.
- Lepas tautan (§5.5) → aliran yang dibuka dari episode lanjutan itu menerima `segarkan` lalu ditutup; sambung ulang ditolak 422 dan klien menampilkan "Tautan perawatan … sudah berubah. Muat ulang halaman."
- Setelah aliran putus, klien mengambil `terkini` lebih dulu (sekaligus memeriksa hak): 401/403/404/422 → pembaruan langsung dihentikan dengan alasannya; galat jaringan → sambung ulang bertahap 1 → 30 dtk.

### 8.6 Klien (`useIsian` mode berlanjut)

- `dasar` = isi server terakhir (bentuk `siapkan`). Simpan mengirim `ubah = beda(dasar, lokal)`; kosong → tidak ada permintaan.
- Sukses → `lokal = rebase(dasar, lokal, serverBaru)` (kolom yang diubah sejak permintaan dikirim tetap milik lokal), `dasar = serverBaru`.
- Event `berubah`/`status` dengan rev lebih baru (bukan hasil simpan sendiri) → ambil `/terkini` → rebase → pemberitahuan "**<nama> (<unit>) mengubah: <label kolom> · <jam>**".
  - Simpan/aksi sendiri yang sedang berjalan ditunggu dulu: event itu mungkin hasil simpannya sendiri (rev-nya lalu sudah tercakup jawaban simpan).
  - Banyak event beruntun → satu pengambilan `terkini` (antrean rev tertinggi + info siapa/kolom).
  - Kolom yang sama sedang diketik (belum tersimpan) dan diubah petugas lain → **panel konflik langsung**, tanpa menunggu simpan sendiri ditolak 409.
  - Kolom tertaut SIMRS di layar tetap nilai SIMRS terkini (tidak diganti nilai tersimpan server).
- `status` FINAL/BATAL dari pihak lain → layar terkunci seketika; pita menyebut siapa dan kolom yang belum sempat tersimpan (§5.3 E).
- 409 konflik → `dasar` = isi server; kolom bentrok ditampilkan di **PanelKonflik**; simpan otomatis jeda sampai semua kolom bentrok dipilih.
- Perilaku form tak berlanjut **tidak berubah**.

### 8.7 API dan penjaga

| Rute                                         | Metode | Penjaga                                                                    |
| -------------------------------------------- | ------ | -------------------------------------------------------------------------- |
| `/api/form-rm/isian`                         | POST   | sekarang + jawaban `perluKonfirmasi` untuk kandidat `WAKTU`                |
| `/api/form-rm/isian/[id]`                    | PATCH  | sekarang (`jagaTulis`: asal sama + laju 60/mnt) + mode gabung              |
| `/api/form-rm/isian/[id]/terkini`            | GET    | `view` kategori, 404 seragam, `tanpaCache`, laju 120/mnt per pengguna, audit dirangkum |
| `/api/form-rm/isian/[id]/aliran`             | GET    | `view` kategori, asal sama, laju sambung 30/mnt, batas §8.5                |
| `/api/form-rm/isian/[id]/log`                | GET    | `view` kategori, 404 seragam, diaudit                                      |
| `/api/form-rm/tautan-episode`                | POST   | `create` pada kategori salah satu form berlanjut, `jagaTulis`, verifikasi §6 |
| `/api/form-rm/tautan-episode/[id]/lepas`     | POST   | `hak.kelola`, `jagaTulis`, alasan wajib (≥ 10 karakter)                    |

Semua masukan: Zod `strictObject`, batas body (`readJsonTerbatas`), NOPEN `^\d{1,20}$`.

### 8.8 RBAC

Tidak ada modul baru. Hak per kategori form (`form-rm.<kategori>`) dan `form-rm.kelola` yang sudah ada. Petugas IGD dan RI memakai hak yang sama atas kategori yang sama.

## 9. Keamanan — penilaian kerentanan OWASP

### 9.1 Prinsip

- Pasien berbeda **tidak pernah** berbagi isian (NORM wajib sama, diverifikasi server di setiap tautan).
- Klien tidak pernah menentukan tautan, unit, atau ruang secara bebas: konteks hanya dipilih dari anggota rantai, unit/ruang dibaca server.
- Tulis atomik: kunci baris + transaksi; siaran & audit hanya setelah commit.
- Nilai data pasien hanya lewat rute ber-hak; SSE dan audit_log tanpa nilai.

### 9.2 Model ancaman

| Ancaman                                                         | Kendali                                                                                                   |
| --------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Menautkan episode RI ke isian pasien lain (IDOR / salah pasien) | verifikasi NORM + jenis leg + jendela waktu + kandidat server (§6)                                        |
| Konteks palsu untuk memalsukan unit di log                      | konteks harus anggota rantai; unit & ruang dibaca server                                                  |
| Polusi prototipe lewat path                                     | daftar segmen + tolak `__proto__`/`prototype`/`constructor` + path wajib ada + operasi pada salinan       |
| Perubahan hilang karena balapan                                 | `FOR UPDATE` + gabung tiga arah; uji 50 simpan paralel                                                     |
| Pengintaian lewat SSE setelah hak dicabut                       | event tanpa nilai, umur aliran ≤ 10 mnt, hak dicek saat sambung & setiap `/terkini`                       |
| Pemalsuan log oleh orang dengan akses DB                        | segel HMAC berantai, integritas ditampilkan di tab Perubahan                                              |
| Banjir aliran / simpan                                          | batas per pengguna & total, laju tulis 60/mnt, batas body                                                  |
| CSRF                                                            | `jagaTulis` (asal sama) di semua tulis; aliran memeriksa asal sama                                        |

### 9.3 OWASP Top 10:2025

| Risiko                                  | Penerapan                                                                                     |
| --------------------------------------- | --------------------------------------------------------------------------------------------- |
| A01 Broken Access Control               | hak kategori di setiap rute; 404 seragam; lepas tautan hanya `kelola`; tautan diverifikasi    |
| A02 Security Misconfiguration           | SSE `no-store`, `X-Accel-Buffering: no`; tanpa header debug                                   |
| A03 Software Supply Chain Failures      | **tanpa dependensi baru**                                                                      |
| A04 Cryptographic Failures              | HMAC-SHA256 dengan kunci env ≥ 32 karakter; tanpa kunci → 503                                 |
| A05 Injection                           | SQL berparameter (Prisma / `$queryRawUnsafe` dengan placeholder); path tervalidasi            |
| A06 Insecure Design                     | satu isian per rantai; gabung tiga arah; konflik eksplisit; tidak ada timpa diam-diam         |
| A07 Authentication Failures             | sesi wajib; aliran ditutup berkala sehingga sesi kedaluwarsa tidak terus menerima event        |
| A08 Software or Data Integrity Failures | log bersegel berantai; revisi tetap bersegel                                                  |
| A09 Security Logging & Alerting Failures| audit tautan dibuat/dikonfirmasi/dilepas, simpan, timpa, lihat log; tanpa PHI di audit_log    |
| A10 Mishandling of Exceptional Conditions | galat SIMGOS saat menautkan → 503 tanpa membuat tautan; galat gabung → transaksi dibatalkan |

### 9.4 OWASP API Security Top 10:2023

| Risiko                                       | Penerapan                                                                              |
| -------------------------------------------- | -------------------------------------------------------------------------------------- |
| API1 BOLA                                    | setiap id isian dicek kategori; tautan dicek NORM                                      |
| API2 Broken Authentication                   | sesi pada semua rute baru                                                              |
| API3 Broken Object Property Level Authorization | path wajib ada di bentuk form; kolom tertaut diabaikan; skema strict                |
| API4 Unrestricted Resource Consumption       | batas aliran, laju, body, jumlah ubah                                                  |
| API5 Broken Function Level Authorization     | lepas tautan hanya `kelola`; konfirmasi tautan butuh `create`                           |
| API6 Unrestricted Access to Sensitive Business Flows | konfirmasi tautan hanya untuk kandidat server; keputusan disimpan sekali       |
| API7 SSRF                                    | tidak ada URL dari klien                                                                |
| API8 Security Misconfiguration               | sama dengan A02                                                                         |
| API9 Improper Inventory Management           | rute baru tercatat di `docs/rbac/02-otorisasi.md`                                       |
| API10 Unsafe Consumption of APIs             | data SIMGOS dinormalisasi & divalidasi sebelum dipakai                                  |

### 9.5 Uji keamanan wajib (lulus di build produksi)

1. Tanpa sesi → 401 di semua rute baru dan mode gabung.
2. Kategori tanpa `view` → 404 seragam (`terkini`, `aliran`, `log`); `view` tanpa `update` → 403 pada PATCH.
3. Konteks bukan anggota rantai → 422, tidak membocorkan keberadaan episode.
4. Konfirmasi tautan: NORM berbeda, akar bukan IGD, lanjutan bukan RI, selisih > 24 jam, akar ≠ kandidat server → ditolak; tidak ada baris tautan terbentuk.
5. Tautan aktif ganda untuk satu episode lanjutan (permintaan paralel) → tepat satu tercipta.
6. Lepas tautan tanpa `kelola` → 403; alasan kosong → 422.
7. Path `__proto__`, `constructor.prototype.x`, path tak dikenal, indeks di luar batas → 422; `Object.prototype` tidak berubah.
8. Hasil gabung melanggar skema → 422, tidak ada yang tertulis.
9. Kolom tertaut dikirim → diabaikan.
10. Body > batas → 413; > 500 ubah → 422.
11. Dua simpan paralel kolom berbeda → keduanya sukses; hasil memuat keduanya; rev +2.
12. Dua simpan paralel kolom sama → satu sukses, satu 409 berisi nilai pemenang; TIMPA eksplisit tercatat sebagai `TIMPA`.
13. 50 simpan paralel acak (kolom acak) → setiap ubah yang dijawab sukses ada di hasil akhir atau ditimpa oleh entri log yang tercatat.
14. Simpan setelah FINAL (dari pihak lain) → ditolak, tidak ada yang berubah.
15. Log: rantai segel utuh; satu baris diubah langsung di DB → terdeteksi; log tanpa hak → 404.
16. audit_log tidak memuat nilai kolom maupun nama pasien.
17. SSE: event tanpa nilai kolom; aliran ditutup ≤ 10 menit; peran dicabut → sambung ulang ditolak.
18. SSE: aliran ke-9 per pengguna → 429; melewati total → 503.
19. Permintaan lintas situs (PATCH, POST tautan, DELETE tautan) → 403.
20. RM.01 berantai: kolom tertaut *Keadaan keluar* = nilai `pasien_pulang` episode RI.
21. Isi otomatis isian baru yang dibuat dari episode RI memakai episode RI sebagai sumber utama.
22. Form tak berlanjut (RM.22, RM.70, …): perilaku simpan & 409 sama seperti sebelum fitur ini (regresi).
23. Pemeriksaan anti-backdoor: tanpa rute/flag tersembunyi, tanpa dependensi baru, tanpa `eval`/`Function`.

## 10. Kinerja

- Simpan mode gabung p95 < 150 ms (LAN, tanpa TTD baru).
- Event `berubah` sampai di klien lain < 1 dtk; isi terbaru tampil < 1 dtk setelahnya.
- Daftar pemilih RI: satu query SIMGOS batch kandidat SPRI per halaman (≤ ukuran halaman NOPEN).
- Log: perkiraan ±5 entri per isian per hari kerja setelah penggabungan; ukuran entri dibatasi oleh batas data isian (256 KB).

## 11. Hukum dan bukti

- Satu dokumen per perawatan lebih mudah dipertanggungjawabkan daripada dua salinan yang bisa berbeda.
- Prinsip rekam medis (Permenkes 24/2022 tentang Rekam Medis): perubahan isi harus dapat ditelusuri — siapa, kapan — tanpa menghilangkan data semula. Log nilai sebelum → sesudah memenuhi prinsip itu untuk masa DRAF; revisi tersegel tetap menjadi bukti dokumen FINAL. Penafsiran resmi tetap pada unit rekam medis RS.

## 12. Kualitas kode dan definisi selesai (setiap langkah)

- TypeScript strict, `tsc` 0 galat, ESLint 0.
- Modul murni diuji unit (vitest); modul server-only/DB diuji E2E.
- E2E dan UI di build produksi (:3100). Server dev :3000 tidak disentuh.
- Data uji ditandai dan dibersihkan terarah; data nyata tidak disentuh; pengaturan global di-snapshot dan dipulihkan.
- Tanpa PHI di log; nama pasien disamarkan sebelum tangkapan layar.
- Tinjauan keamanan, dokumen, dan memori diperbarui; pesan commit disarankan, commit oleh pemilik.

## 13. Rencana bertahap

| Langkah                                  | Isi                                                                                                                                                                                                                                                                                                                                       | Bukti selesai                                                                                         |
| ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| **L1 — Rantai episode**                  | DDL dua tabel + migrasi + model Prisma; penanda `berlanjut` + sasaran `[2, 3]`; `rantai.inti/dal/service`; buka/buat isian lewat rantai; dialog **Lanjutkan isian dari IGD?** (`WAKTU`/`TANPA`); lepas tautan (kelola); profil & pemilih RI menampilkan isian bersama; episode SIMRS = episode terakhir (isi otomatis, banding, tertaut, rujukan); pita berlanjut; audit; K8 PRD Form RM Terpadu diperbarui | unit `rantai.inti`; E2E uji §9.5 no. 1–6, 20–22; oracle SQL independen untuk kandidat SPRI/WAKTU       |
| **L2 — Simpan gabung + log**             | `gabung.ts` murni; PATCH mode gabung (transaksi + `FOR UPDATE`); 409 konflik per kolom; TIMPA; log + penggabungan 5 mnt + segel; `label-kolom.ts`; `/log` + tab **Perubahan**; `useIsian` mode berlanjut + **PanelKonflik**                                                                                                                        | unit `gabung` & segel log; E2E no. 7–16; UI konflik                                                   |
| **L3 — Langsung (SSE)**                  | `isian.hub.ts`; rute `aliran` & `terkini`; klien: sambung saat tab terlihat, rebase dari event, pemberitahuan "mengubah: …", **KehadiranIsian**, peringatan FINALKAN (K6)                                                                                                                                                                       | E2E no. 17–19; UI dua peramban (IGD & RI) skenario §5.3 A–F                                            |
| **L4 — Pengerasan & kesiapan produksi**  | tinjauan keamanan OWASP; uji beban (400 aliran, 50 simpan paralel); regresi seluruh Form RM; anti-backdoor; panduan deploy (migrasi) + `docs/rbac/02-otorisasi.md`; memori                                                                                                                                                                   | §9.5 lengkap lulus; angka beban tercatat di §15                                                       |

## 14. Risiko dan mitigasi

| Risiko                                                             | Mitigasi                                                                                                   |
| ------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------- |
| Salah tautan pada kandidat ≤ 24 jam                                | wajib konfirmasi (K3), NORM sama, lepas tautan oleh pengelola RM dengan jejak                              |
| Episode RI sudah punya isian sendiri (data lama)                   | dipertahankan, ditandai "dua isian", pengelola RM membatalkan salah satu; tanpa gabung otomatis            |
| RM.01/RM.21 difinalkan terlalu dini di IGD                         | peringatan K6; koreksi lewat Buka koreksi (aturan sekarang)                                                |
| Konflik sering pada kolom panjang yang sama                        | satuan gabung = kolom; panel konflik per kolom; kehadiran membuat petugas tahu ada orang lain             |
| Batas koneksi HTTP/1.1 (6 per origin) dengan banyak tab            | aliran hanya untuk tab terlihat & form berlanjut; nginx HTTP/2 (panduan TTD siaga)                         |
| Hub satu proses                                                    | sama dengan TTD siaga; antarmuka kecil → Redis bila multi-instance                                         |
| Pertumbuhan log                                                    | penggabungan 5 mnt; simpan tanpa beda tidak menulis                                                        |
| Snapshot REPEATABLE READ tertinggal dari baris terkunci            | data dibaca lewat `SELECT … FOR UPDATE` itu sendiri (§8.3)                                                 |

## 15. Status implementasi

### Langkah 1 — Rantai episode ✅ (11 Nov 2026)

**Data.** `form_rm_tautan_episode` dan `form_rm_isian_log` (yang kedua dipakai L2) di `scripts/db/form-rm.sql`, idempoten. Migrasi: `node scripts/db/migrate-form-rm.mjs` (produksi: `docker compose run --rm migrate scripts/db/migrate-form-rm.mjs`). Model Prisma `FormRmTautanEpisode`, `FormRmIsianLog`.

**Kode.**
- Registri: `berlanjut: "igd-ri"` di RM.21/RM.01/RM.03, sasaran IGD + RI, wajib tetap IGD (K5).
- `rantai.inti.ts` (murni, teruji unit): `putuskanRantai`, `cekKonfirmasi`, `ringkasKeputusan`.
- `rantai.dal.ts`: `queryKandidatAkar` (batch, SIMGOS read-only) — kini sumber tunggal aturan asal IGD; `queryIgdAsal` isi otomatis memakainya.
- `rantai.service.ts`: subjek isian berlanjut (SPRI otomatis, konfirmasi, terpisah), konfirmasi & lepas tautan, episode SIMRS, konteks, isian per episode (`dariNopen`, `ganda`), audit `form-rm.tautan.{otomatis,konfirmasi,terpisah,lepas}`.
- `isian.service.ts`: `bukaAtauBuatIsian` lewat rantai (jawaban `perluKonfirmasi`); isi otomatis, muat ulang SIMRS, kolom tertaut, dan pembekuan saat FINALKAN memakai episode SIMRS rantai.
- Rute: `POST /api/form-rm/tautan-episode`, `POST /api/form-rm/tautan-episode/[id]/lepas`. Rute lama `/form-rm/<nopen>/<jenis>` dan `/print/form-rm/<jenis>/<nopen>` mengikuti rantai.
- UI: dialog **Lanjutkan isian dari IGD?**, pita isian bersama di halaman isian (`?dari=` divalidasi server), panel rantai + **Lepas tautan** di profil pasien, penanda "Dokumen bersama dari IGD" & "dua isian" di kartu form, chip rantai di pemilih pasien.

**Hasil uji (build produksi :3100).**

| Uji | Hasil |
| --- | --- |
| Unit (total) | 664/664 (13 baru: rantai & registri) |
| E2E L1 (`berlanjut-l1-e2e.mjs`): §9.5 no. 1–6, 20–22, rute lama, audit | 49/49 |
| Oracle: rantai setiap baris RI pemilih RM.03 vs SQL independen | 62/62 cocok |
| UI L1 (`berlanjut-l1-ui.mjs`): dialog, pita, panel, lepas tautan, chip | 23/23, tanpa galat konsol/CSP |
| Regresi Form RM: E2E detail 38/38, riwayat 61/61, Via HP 67/67; UI detail 27/27, riwayat 47/47 | lulus (setelah segmen status dirapatkan untuk font Geist: `SegmentedControl` `px-2` → `px-1.5` di layar sempit) |

Data uji dibersihkan terarah; isian 42 dan tautan 0 kembali seperti semula.

### Langkah 2 — Simpan gabung per kolom + log ✅ (12 Nov 2026)

**Kode.**
- `features/form-rm/gabung.ts` (murni, teruji unit): validasi path, `bentukIsian`, `daunBeda`, `susunUbah`, `gabungkan` (tiga arah), `rebase`. Registri mendapat `lengkapi` (RM.01: Sebab Kematian II selalu 3 baris) agar bentuk isian klien = server.
- `features/form-rm/label-kolom.ts`: label setiap kolom RM.03/RM.21/RM.01 (diuji: tak ada kolom tanpa label), ringkasan nilai & TTD tanpa gambar.
- `isian.gabung.ts`: `PATCH /api/form-rm/isian/[id]` mode gabung — transaksi + `SELECT … FOR UPDATE`, 409 berisi isi terkini + kolom bentrok + siapa/unit/ruang/jam terakhir mengubahnya, `timpa` → aksi log `TIMPA`. Mode lama `{ rev, data }` tetap jalan untuk semua form.
- `isian.log.inti.ts` + `isian.log.ts`: log per kolom, penggabungan ≤ 5 menit (K7), segel HMAC berantai `form-rm.log|`, pemeriksaan integritas. Log juga ditulis oleh simpan mode lama, **Muat ulang dari SIMRS** (`MUAT_SIMRS`), dan FINALKAN yang membekukan kolom tertaut (`BEKU_TERTAUT`).
- `isian.konteks.ts`: konteks harus anggota rantai (422); unit dari peran rantai (akar = IGD, lanjutan = RI), ruang dibaca server (cache 5 menit).
- `GET /api/form-rm/isian/[id]/log` (hak lihat, 404 seragam, diaudit `form-rm.isian.log-lihat`). `konteks` opsional pada `…/aksi` dan `…/simrs`.
- Klien: `useIsian` mode gabung (dasar, rebase setelah simpan, 409 → kolom bentrok, simpan otomatis jeda, aksi yang ditolak karena rev usang memuat isi terbaru tanpa muat ulang halaman), `PanelKonflik` (Pakai milik saya / milik <nama>, juga untuk semua kolom sekaligus), pita "Perubahan petugas lain ikut dimuat", tab **Perubahan** di Riwayat (satu linimasa dengan revisi), `KonteksIsianProvider`.
- Perbaikan lama: RM.03 "Pihak 3" diisi sebelum Pihak 1–2 menghasilkan larik berlubang yang ditolak skema.

**Hasil uji (build produksi :3100).**

| Uji | Hasil |
| --- | --- |
| Unit (total) | 703/703 (39 baru: gabung, label kolom, segel & penggabungan log) |
| E2E L2 (`berlanjut-l2-e2e.mjs`): §9.5 no. 1–3, 7–16, 19, 22 + K7, mode lama, `MUAT_SIMRS`, `BEKU_TERTAUT`, TTD sebagai referensi | 71/71 |
| 50 simpan paralel acak (5 pengguna, 2 konteks) | 7 sukses / 43 konflik dalam 0,7 dtk; tiap kolom paling banyak satu pemenang; semua sukses ada di hasil & log; rev naik tepat 7 |
| UI L2 dua peramban (`berlanjut-l2-ui.mjs`): §5.3 C & D, TIMPA, pakai milik petugas lain, jeda simpan otomatis, 360 px, tab Perubahan | 25/25, tanpa galat konsol/CSP |
| Regresi: E2E L1 49/49, detail 38/38, riwayat 61/61, Via HP 67/67, permintaan TTD 117/117; UI L1 23/23, detail 27/27, riwayat 47/47, Via HP 18/18, permintaan TTD 39/39 | lulus |

Data uji dibersihkan terarah; isian 42, log 0, tautan 0 seperti semula.

### Langkah 3 — Langsung (SSE) ✅ (12 Nov 2026)

**Kode.**
- `features/form-rm/aliran-isian.ts` (murni, teruji unit): daftar event tetap + penyusun frame (bersama TTD siaga lewat `penyusunFrame` di `ttd-siaga/sse.ts`), batas, pembaca event klien yang memvalidasi bentuk, label unit/tempat.
- `isian.hub.ts`: hub per isian di `globalThis` — batas 8/pengguna & 400 total, umur 10 menit → `segarkan`, detak 20 dtk, `hadir` per penerima & digabung 300 ms, `putuskanKonteks` saat tautan dilepas. Siaran dipanggil service **setelah commit**: simpan gabung, simpan mode lama, muat ulang SIMRS (`berubah`), FINALKAN/BUKA_KOREKSI/BATALKAN (`status`).
- `isian.aliran.ts` + rute `GET …/aliran` (SSE) dan `GET …/terkini`; laju di `isian.jaga.ts`.
- Klien: `useAliranIsian` (tab terlihat saja, watchdog, sambung ulang bertahap, berhenti bila akses berakhir), `useIsian` mode langsung (antrean event → satu `terkini` → rebase; konflik langsung; kolom tertaut tetap nilai SIMRS terkini), `KehadiranIsian` ("Juga membuka: …"), pita "<nama> (<unit · ruang>) mengubah: …", `PitaTertinggal` (difinalkan pihak lain), peringatan FINALKAN K6 (orang lain membuka; pasien masih dirawat untuk RM.01/RM.21 — `FINAL_SAAT_PULANG`, dari data pulang SIMRS episode RI).

**Hasil uji (build produksi :3100).**

| Uji | Hasil |
| --- | --- |
| Unit (total) | 713/713 (10 baru: protokol aliran) |
| E2E L3 (`berlanjut-l3-e2e.mjs`): §9.5 no. 1–3, 17–19, 22 + header SSE, `hadir`, `berubah`/`status`, audit & laju `terkini`, lepas tautan | 54/54 |
| Latensi `berubah` sampai klien lain | 38–66 ms (juga saat 400 aliran terbuka) |
| Batas | tab ke-9 → 429; 400 aliran terbuka dalam 1,1 dtk, ke-401 → 503; sambung ke-31/menit → 429; `terkini` ke-121/menit → 429 |
| Umur aliran | ditutup 600,1 dtk dengan `segarkan`; 29 detak; peran dicabut → sambung ulang & `terkini` 403 |
| UI L3 dua peramban (`berlanjut-l3-ui.mjs`): §5.3 A–F, peringatan K6, 360 px | 30/30, tanpa galat konsol/CSP |
| Regresi E2E: L2 71/71, L1 49/49, detail 38/38, riwayat 61/61, Via HP 67/67, permintaan TTD 117/117, TTD siaga 70/70 | lulus |
| Regresi UI: L2 25/25, L1 23/23, detail 27/27, riwayat 47/47, Via HP 18/18, permintaan TTD 39/39, TTD siaga 28/28 | lulus |

Perubahan perilaku yang disengaja: konflik kolom sama kini muncul **sebelum** simpan (begitu perubahan petugas lain tiba), sehingga uji UI L2 diurutkan ulang (pihak yang kalah mengetik lebih dulu). Uji UI kini menunggu input yang akan diisi terhidrasi (satu kegagalan sekali-jalan di langkah pertama UI L2 tak bisa direproduksi dalam tiga run berikutnya).

Data uji dibersihkan terarah; isian 42, log 0, tautan 0 seperti semula. Tanpa migrasi baru; tanpa dependensi baru.

### Langkah 4 — Pengerasan & kesiapan produksi ✅ (12 Nov 2026)

**Tinjauan keamanan menyeluruh** atas 66 berkas fitur (L1–L3, ±4.400 baris tambahan non-uji). Tidak ditemukan celah yang bisa dieksploitasi. Lima pengerasan diterapkan:

| # | Temuan | Perbaikan |
| --- | --- | --- |
| 1 | Siaran SSE berjalan di jalur respons setelah commit; galat tak terduga akan menjawab 500 untuk simpan yang sudah tersimpan | siaran dibungkus `aman()` (`isian.hub.ts`) — tak pernah menggagalkan permintaan; dicatat tanpa isi |
| 2 | Nama petugas / ruang > 191 karakter membuat klien menolak seluruh event | server memotong teks event ke 191 karakter |
| 3 | Panel konflik memakai `srcTtd(nilai)` apa adanya untuk `<img>` | hanya referensi TTD / PNG data-URL (`ttdSah`, diuji unit) |
| 4 | `readJsonTerbatas` (semua rute tulis aplikasi) menampung seluruh body chunked sebelum memeriksa batas | memakai pembaca streaming yang berhenti begitu batas terlewati (body 24 MB chunked → 413) |
| 5 | Kunci `"__proto__"` di body lolos `strictObject` (dibuang diam-diam oleh Zod; tanpa polusi pada rute ini, tetapi berbahaya bila body mentah di-`Object.assign`) | `readJson`/`parseJson`/`readJsonTerbatas` menolak kunci `__proto__` di kedalaman mana pun → 422 (diuji unit & E2E) |

Pengamatan di luar fitur (tidak diubah): klien Prisma mencatat galat ke log server (`log: ["warn","error"]`); galat validasi Prisma — hanya terjadi bila ada salah program — dapat memuat argumen query. Layak ditinjau tersendiri untuk kebijakan "tanpa PHI di log".

**OWASP Top 10:2025 — bukti.**

| Risiko | Bukti |
| --- | --- |
| A01 Broken Access Control | setiap rute baru `authorizeAny` (statik); 404 seragam (L2/L3); lepas hanya `kelola` (L1); konteks anggota rantai (L2/L3); tautan diverifikasi termasuk akar IGD pasien sama > 24 jam (L1, L4); semua tulis + aliran lintas situs → 403 tanpa efek (L4, 3 varian header) |
| A02 Security Misconfiguration | header SSE (L3); `no-store` + `nosniff`, tanpa `X-Powered-By`, metode tak terdaftar → 405 (L4) |
| A03 Supply Chain | `package.json`/lock tidak berubah sejak awal fitur (statik) |
| A04 Cryptographic Failures | HMAC-SHA256 kunci ≥ 32, tanpa kunci → 503; segel log rusak terdeteksi (L2); token palsu / `alg: none` / kedaluwarsa / kunci lain → 401 di semua rute baru (L4) |
| A05 Injection | SQL hanya template bertag / placeholder, tanpa tulis SIMGOS (statik); `konteks` & id berisi injeksi → 422/404 tanpa detail DB (L4); path aman (L2); frame SSE satu baris (unit); `__proto__` → 422 (L4); tanpa HTML mentah (statik) |
| A06 Insecure Design | gabung tiga arah + kunci baris; 50 simpan paralel dengan 400 aliran terbuka: tiap kolom satu pemenang, event berurutan tanpa celah (L4 beban) |
| A07 Authentication Failures | sesi wajib di semua rute baru (L1–L3); aliran ditutup ≤ 10 menit, hak dicek ulang (L3) |
| A08 Data Integrity | log & revisi bersegel berantai (L2) |
| A09 Logging & Alerting | audit tautan/simpan/timpa/log-lihat/terkini tanpa nilai & nama pasien (L2/L3); percobaan yang ditolak tidak menghasilkan perubahan teraudit (L4) |
| A10 Exceptional Conditions | SIMGOS gagal → 503 tanpa tautan; transaksi dibatalkan saat galat; siaran tak pernah menggagalkan simpan; body raksasa ditolak tanpa ditampung; galat tanpa stack trace / SQL (L4) |

**§9.5 — bukti per butir (build produksi final).**

| No. | Uji | Skrip |
| --- | --- | --- |
| 1 | tanpa sesi → 401 | L1 (tautan, buka isian), L2 (PATCH gabung, log), L3 (aliran, terkini), L4 (token rusak) |
| 2 | 404 seragam / 403 | L1, L2, L3 |
| 3 | konteks bukan anggota rantai → 422 | L1, L2 (PATCH/aksi/simrs), L3 (aliran/terkini), L4 |
| 4 | konfirmasi tautan tidak sah ditolak | L1 (NORM beda, akar bukan IGD, lanjutan bukan RI, tanpa asal), L4 (akar > 24 jam) |
| 5 | tautan ganda paralel → tepat satu | L1 |
| 6 | lepas tanpa `kelola` 403, alasan kosong 422 | L1 |
| 7 | path berbahaya → 422, `Object.prototype` utuh | L2 |
| 8–10 | skema, kolom tertaut, batas body & jumlah ubah | L2, L4 (chunked) |
| 11–13 | paralel kolom berbeda / sama / 50 acak | L2, L4 beban |
| 14 | simpan setelah FINAL | L2, UI L3 (E) |
| 15 | segel log, rusak terdeteksi, tanpa hak 404 | L2 |
| 16 | audit tanpa nilai & nama pasien | L1, L2, L3 |
| 17 | SSE tanpa nilai, ≤ 10 menit, hak dicabut | L3 |
| 18 | aliran ke-9 → 429, total → 503 | L3, L4 beban |
| 19 | lintas situs → 403 | L2, L3, L4 (buka isian, PATCH gabung & lama, aksi, simrs, konfirmasi & lepas tautan, aliran) |
| 20–21 | kolom tertaut & isi otomatis dari RI | L1 |
| 22 | form tak berlanjut tak berubah | L1, L2, L3, regresi 10 formulir |
| 23 | anti-backdoor | `berlanjut-l4-statik.mjs` |

**Hasil uji (build produksi final :3100).**

| Uji | Hasil |
| --- | --- |
| Unit (total) | 731/731 (18 baru: `ttdSah`, parser JSON & batas body) |
| Statis anti-backdoor (`berlanjut-l4-statik.mjs`) | 39/39 |
| Keamanan tambahan (`berlanjut-l4-keamanan.mjs`) | 49/49 |
| Beban (`berlanjut-l4-beban.mjs`) | 17/17 — simpan gabung p95 46 ms (tanpa aliran) / 50 ms (400 aliran); 400 aliran terbuka 1,2 dtk; event ke 300 aliran (6.000 pengiriman) p95 68 ms, maks 96 ms, 0 hilang; 50 paralel 10 sukses / 40 konflik dalam 0,8 dtk; badai sambung ulang 400 aliran ±1,2 dtk, `hadir` maks 2 frame/aliran |
| Siklus memori (`berlanjut-l4-bocor.mjs`): 6× buka 400 aliran + 5 event → tutup | 8/8 — semua siklus 400/400 aliran & 400/400 event lengkap; RSS naik-turun 120–360 MB mengikuti GC dan turun ke 123 MB setelah jeda 1 menit (tanpa pertumbuhan tertahan) |
| E2E berlanjut L1 / L2 / L3 | 49/49, 71/71, 54/54 |
| Regresi seluruh Form RM (10 formulir) E2E / UI | 154/154, 81/81 |
| Regresi E2E lain: detail 38, riwayat 61, Via HP 67, permintaan TTD 117, TTD siaga 70, TTD perangkat 93 | lulus |
| Regresi UI: berlanjut L1 23, L2 25, L3 30, detail 27, riwayat 47, Via HP 18, permintaan TTD 39, TTD siaga 28, TTD perangkat 28 | lulus |

**Kesiapan produksi.** Panduan IT: [form-rm-berlanjut.md](./form-rm-berlanjut.md) (migrasi, env, RBAC, nginx SSE & HTTP/2, satu proses, batas, pemecahan masalah, audit, rollback, daftar periksa).

## 16. Keputusan terbuka

| #   | Pertanyaan                                                                 | Bawaan sementara |
| --- | -------------------------------------------------------------------------- | ---------------- |
| K5  | Apakah RM.03/RM.21/RM.01 dihitung wajib untuk episode RI (kelengkapan)?    | Tidak (tetap IGD) |
| K6  | Haruskah FINALKAN RM.01/RM.21 dari IGD dilarang selama pasien masih dirawat? | Tidak, peringatan saja |
| K8′ | Form lain yang kelak ikut berlanjut (mis. Morse, RM.50)?                   | Belum             |

-- =====================================================================================
-- Analisis RL 3.2 (SIRS 6) Rawat Inap: kenapa laporan.LaporanRL32RuanganRevisi kosong
-- (sementara laporan.LaporanRL32Revisi berisi). Dianalisis 8 Okt 2026, server SIMGOS 10.202.1.5.
--
-- SEMUA query di berkas ini READ ONLY (SELECT). Tidak ada procedure/tabel yang diubah.
-- Bagian 5 (REPLACE) sengaja DIKOMENTARI: itu perubahan DATA SIMGOS, hanya boleh dijalankan
-- setelah pemetaan disetujui pihak RS/IT.
--
-- KESIMPULAN
--   Kedua procedure memakai SQL yang sama, bedanya hanya kunci pemetaan:
--     LaporanRL32Revisi        : pendaftaran.tujuan_pasien.SMF = master.rl32_smf_revisi.ID     (ID SMF)
--     LaporanRL32RuanganRevisi : pendaftaran.kunjungan.RUANGAN = master.rl32_ruangan_revisi.ID (ID RUANGAN)
--                                informasi.tempat_tidur.RUANGAN_ID = master.rl32_ruangan_revisi.ID (jumlah TT)
--   Isi master.rl32_ruangan_revisi IDENTIK dengan rl32_smf_revisi (13 baris ID SMF: 31,1,11,0,4,...),
--   padahal procedure membutuhkan ID ruangan 9 digit (mis. 101020203 = PERAWATAN INTERNA KELAS 3).
--   Akibatnya 0 dari 3.331 kunjungan rawat inap cocok -> semua angka NULL -> laporan tampil 37 baris
--   kategori RL dengan isi kosong. Procedure-nya sendiri benar: dengan pemetaan ruangan yang benar
--   (lihat bagian 4) hasil Sep 2026 langsung terisi dan totalnya identik dengan versi SMF
--   (AWAL 18, MASUK 202, PINDAHAN 2, DIPINDAHKAN 2, HIDUP 195, MATI 4, LD 728, SISA 21, HP 727),
--   ditambah JML_BED 54.
--
-- TINDAK LANJUT (8 Okt 2026): laporan di-port ke ReportHub — Pusat Laporan › RL 3.2 Rawat Inap
--   (/laporan/rl32, modul src/server/modules/rl32). SIMGOS tetap hanya dibaca; pemetaan disimpan di
--   DB reporthub: rl32_ruangan_peta (ruangan → jenis pelayanan, + "Pisah DPJP") dan rl32_smf_peta
--   (SMF DPJP → jenis pelayanan, mis. pasien Saraf/Bedah yang dirawat di ruang Interna). Hasilnya
--   diuji identik sel per sel dengan SQL SP ini (bagian 5 di bawah tidak diperlukan lagi).
-- =====================================================================================


-- 1) Bukti: isi kedua tabel pemetaan sama persis (ID-nya ID SMF, bukan ID ruangan)
SELECT 'ruangan' tabel, rlr.ID, rlr.RL31, ref.DESKRIPSI smf_dengan_id_ini, r.DESKRIPSI ruangan_dengan_id_ini
  FROM master.rl32_ruangan_revisi rlr
  LEFT JOIN master.referensi ref ON ref.JENIS = 26 AND ref.ID = rlr.ID
  LEFT JOIN master.ruangan r ON r.ID = rlr.ID
UNION ALL
SELECT 'smf', s.ID, s.RL31, ref.DESKRIPSI, NULL
  FROM master.rl32_smf_revisi s
  LEFT JOIN master.referensi ref ON ref.JENIS = 26 AND ref.ID = s.ID
ORDER BY RL31, tabel;


-- 2) Bukti: berapa kunjungan rawat inap yang cocok dengan master.rl32_ruangan_revisi (hasil: 0)
SELECT COUNT(*) kunjungan_ri, SUM(rlr.ID IS NOT NULL) cocok_pemetaan
  FROM pendaftaran.kunjungan pk
  JOIN master.ruangan r ON r.ID = pk.RUANGAN AND r.JENIS_KUNJUNGAN = 3
  LEFT JOIN master.rl32_ruangan_revisi rlr ON rlr.ID = pk.RUANGAN
 WHERE pk.STATUS IN (1, 2);


-- 3) "Query SELECT Master" yang benar untuk rl32_ruangan_revisi: ruang rawat inap (level ruang, 9 digit)
--    beserta jumlah TT hari ini dan pemakaian 2026, sebagai bahan penentuan kategori RL tiap ruangan.
SELECT r.ID, r.DESKRIPSI,
       (SELECT b.JUMLAH FROM informasi.tempat_tidur b WHERE b.RUANGAN_ID = r.ID ORDER BY b.TANGGAL DESC LIMIT 1) tt_terakhir,
       (SELECT COUNT(*) FROM pendaftaran.kunjungan pk WHERE pk.RUANGAN = r.ID AND pk.STATUS IN (1, 2)
           AND pk.MASUK >= '2026-01-01') kunjungan_2026,
       rlr.RL31 terpetakan_ke
  FROM master.ruangan r
  LEFT JOIN master.rl32_ruangan_revisi rlr ON rlr.ID = r.ID
 WHERE r.JENIS_KUNJUNGAN = 3 AND r.JENIS = 5 AND r.STATUS = 1 AND INSTR(r.DESKRIPSI, 'IRNA') = 0
 ORDER BY r.ID;

--    Daftar kategori RL 3.2 (SIRS 6) = master.refrl untuk jenis_laporan_detil JENIS 100103 / ID 102
SELECT rl.ID, rl.KODE, rl.DESKRIPSI
  FROM master.refrl rl
  JOIN master.jenis_laporan_detil j ON j.JENIS = rl.JENISRL AND j.ID = rl.IDJENISRL
 WHERE j.KODE = 'RL 3.2 (SIRS 6)'
 ORDER BY rl.KODE_HIRARKI, rl.ID;


-- 4) Pratinjau pemetaan USULAN (tanpa menulis apa pun): kunjungan rawat inap per kategori RL.
--    Ganti periode sesuai kebutuhan. Baris bertanda [konfirmasi] perlu diputuskan pihak RS.
SELECT rl.ID rl_id, rl.DESKRIPSI kategori, m.ID ruangan_id, r.DESKRIPSI ruangan,
       COUNT(pk.NOMOR) kunjungan_masuk_periode
  FROM (          SELECT '101020101' ID, 3 RL31   -- Anak Kelas 1      -> Kesehatan Anak
        UNION ALL SELECT '101020102', 3           -- Anak Kelas 2      -> Kesehatan Anak
        UNION ALL SELECT '101020103', 3           -- Anak Kelas 3      -> Kesehatan Anak
        UNION ALL SELECT '101020201', 2           -- Interna Kelas 1   -> Penyakit Dalam
        UNION ALL SELECT '101020202', 2           -- Interna Kelas 2   -> Penyakit Dalam
        UNION ALL SELECT '101020203', 2           -- Interna Kelas 3   -> Penyakit Dalam
        UNION ALL SELECT '101020204', 2           -- Umum VIP          -> Penyakit Dalam   [konfirmasi]
        UNION ALL SELECT '101020301', 33          -- Isolasi Kelas 3   -> Isolasi
        UNION ALL SELECT '101020401', 5           -- Obgyn Kelas 3     -> Obstetri         [konfirmasi: Obstetri/Ginekologi]
        UNION ALL SELECT '101040101', 27          -- ICU               -> ICU
        UNION ALL SELECT '101040102', 29          -- ICCU              -> ICCU/ICVCU
        UNION ALL SELECT '101040103', 31          -- NICU/Neonati      -> NICU             [konfirmasi: NICU/Perinatologi]
       ) m
  JOIN master.refrl rl ON rl.ID = m.RL31 AND rl.JENISRL = '100103' AND rl.IDJENISRL = 102
  JOIN master.ruangan r ON r.ID = m.ID
  LEFT JOIN pendaftaran.kunjungan pk ON pk.RUANGAN = m.ID AND pk.STATUS IN (1, 2) AND pk.REF IS NULL
        AND pk.MASUK BETWEEN '2026-09-01 00:00:00' AND '2026-09-30 23:59:59'
 GROUP BY rl.ID, rl.DESKRIPSI, m.ID, r.DESKRIPSI
 ORDER BY rl.ID, m.ID;


-- 5) DRAF perbaikan data (TIDAK dijalankan). Mengubah DATA master.rl32_ruangan_revisi di SIMGOS.
--    Jalankan hanya setelah pemetaan di bagian 4 disetujui; struktur tabel & procedure tetap.
--    13 baris lama (ID SMF) tidak memengaruhi hasil, kecuali ID '1' yang kebetulan sama dengan
--    master.ruangan '1' (Direktur, bukan ruang rawat inap), jadi boleh dibiarkan atau dibersihkan.
--
-- REPLACE INTO master.rl32_ruangan_revisi (ID, RL31) VALUES
--   ('101020101', 3), ('101020102', 3), ('101020103', 3),
--   ('101020201', 2), ('101020202', 2), ('101020203', 2), ('101020204', 2),
--   ('101020301', 33), ('101020401', 5),
--   ('101040101', 27), ('101040102', 29), ('101040103', 31);

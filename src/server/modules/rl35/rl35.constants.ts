/**
 * Konstanta laporan **RL 3.5 (SIRS 6) — Rekapitulasi Kunjungan**. Bebas
 * `server-only`: dipakai server (agregasi, Excel, PDF) dan klien (label tabel,
 * pemetaan).
 *
 * Logika di-port dari SP SIMGOS `laporan.LaporanRL35Revisi`. SP itu memetakan
 * poliklinik → jenis kegiatan lewat `master.rl35_ruangan_revisi`, yang di
 * instalasi ini KOSONG sehingga rawat jalan tak pernah terhitung (hanya IGD →
 * "Rawat Darurat"). Pemetaan kini disimpan di DB aplikasi (`rl35_ruangan_peta`);
 * SIMGOS tetap READ-ONLY. Analisis: docs/laporan-rl35.md.
 */

/** Jenis laporan SIMGOS (`master.jenis_laporan_detil`) "RL 3.5 (SIRS 6)" — kategori di `master.refrl`. */
export const RL35_JENIS_LAPORAN = { jenis: "100103", id: 105 } as const;

/** Rentang periode maksimum satu permintaan (hari) — sama dengan pemilih periode RL 3.2. */
export const RL35_MAKS_HARI = 366;

/** Jenis kunjungan ruangan (`master.ruangan.JENIS_KUNJUNGAN`) yang dilaporkan. */
export const JK_RAWAT_JALAN = 1;
export const JK_GAWAT_DARURAT = 2;

/** ID `master.refrl` yang bukan jenis kegiatan (baris rata-rata, total, penanda SIRS). */
export const RL35_RAWAT_DARURAT = 24;
export const RL35_RATA_HARI_BUKA = 66;
export const RL35_RATA_KUNJUNGAN_HARI = 77;
export const RL35_TOTAL = 99;
export const RL35_TIDAK_ADA_DATA = 100;
const BUKAN_KEGIATAN = new Set([RL35_RATA_HARI_BUKA, RL35_RATA_KUNJUNGAN_HARI, RL35_TOTAL, RL35_TIDAK_ADA_DATA]);

/** Jenis kegiatan (baris berisi kunjungan) — selain baris rata-rata/total/penanda. */
export const adalahKegiatan = (id: number) => !BUKAN_KEGIATAN.has(id);

/** Diagnosis (INA_GROUPER = 0, STATUS = 1) episode yang memindahkan kunjungan ke baris khusus. */
export type AlasanReklas = "neonatal" | "gravid" | "stroke";

/** Kode stroke SP (persis, bukan awalan). */
export const KODE_STROKE = ["I61.9", "I63.9", "I64", "I69.3", "I69.4"] as const;
/** Awalan ICD-10 neonatal SP: P00–P89 & P91–P96 (P90 dan P97–P99 tidak). */
export const AWALAN_NEONATAL = ["P0", "P1", "P2", "P3", "P4", "P5", "P6", "P7", "P8", "P91", "P92", "P93", "P94", "P95", "P96"] as const;
/** Awalan ICD-10 kehamilan & persalinan (bab O). */
export const AWALAN_GRAVID = ["O"] as const;

/**
 * Pemindahan baris SP (`IF(RL52=4 AND CEK_NEONATAL=1,3, …)`): kunjungan yang
 * dipetakan ke `dari` pindah ke `ke` bila episodenya ber-diagnosis `alasan`.
 */
export const REKLASIFIKASI: readonly { dari: number; ke: number; alasan: AlasanReklas }[] = [
  { dari: 4, ke: 3, alasan: "neonatal" },
  { dari: 6, ke: 5, alasan: "gravid" },
  { dari: 31, ke: 30, alasan: "stroke" },
  { dari: 33, ke: 32, alasan: "stroke" },
];

export const LABEL_ALASAN: Record<AlasanReklas, string> = {
  neonatal: "diagnosis neonatal (P00–P96)",
  gravid: "diagnosis kehamilan (O)",
  stroke: "diagnosis stroke",
};

/** Jenis kegiatan akhir satu kunjungan: kategori pemetaan, dipindah bila diagnosisnya cocok. */
export function kategoriAkhir(rlId: number, dx: Readonly<Record<AlasanReklas, boolean>>): { id: number; alasan: AlasanReklas | null } {
  const r = REKLASIFIKASI.find((x) => x.dari === rlId && dx[x.alasan]);
  return r ? { id: r.ke, alasan: r.alasan } : { id: rlId, alasan: null };
}

/**
 * Saran jenis kegiatan (ID `master.refrl` RL 3.5) dari ruangan — dipakai sebagai
 * pemetaan BAWAAN selama ruangan belum ditetapkan admin. Ruang IGD selalu
 * "Rawat Darurat" (SP: semua kunjungan IGD → 24). Urutan aturan penting: yang
 * lebih spesifik dulu (BEDAH SARAF sebelum BEDAH & SARAF).
 */
const ATURAN_SARAN: readonly [RegExp, number][] = [
  [/BEDAH SARAF/, 31],
  [/ORTHOPED|ORTOPED/, 18],
  [/BEDAH/, 2],
  [/INTERNA|PENYAKIT DALAM/, 1],
  [/\bKB\b|KELUARGA BERENCANA/, 7],
  [/OBGYN|OBSTETRI|GINEKOLOGI|KANDUNGAN|KEBIDANAN/, 6],
  [/ANAK|PEDIATRI/, 4],
  [/JIWA|PSIKIATRI/, 8],
  [/NAPZA/, 9],
  [/PSIKOLOG/, 10],
  [/\bTHT\b/, 11],
  [/MATA/, 12],
  [/KULIT|KELAMIN/, 13],
  [/GIGI/, 14],
  [/GERIATRI/, 15],
  [/JANTUNG|KARDIO/, 16],
  [/RADIOLOGI/, 17],
  [/PARU/, 19],
  [/KANKER|ONKOLOGI/, 20],
  [/URO|NEFRO/, 21],
  [/KUSTA/, 22],
  [/REHAB|FISIOTERA/, 25],
  [/AKUPUN/, 26],
  [/GIZI/, 27],
  [/DAY CARE|ONE DAY/, 28],
  [/\bMCU\b|MEDICAL CHECK/, 29],
  [/SARAF|NEURO/, 33],
  [/UMUM/, 23],
];

export function saranJenisKegiatan(namaRuangan: string, jenisKunjungan: number, idValid: ReadonlySet<number>): number | null {
  if (jenisKunjungan === JK_GAWAT_DARURAT) return idValid.has(RL35_RAWAT_DARURAT) ? RL35_RAWAT_DARURAT : null;
  const nama = namaRuangan.toUpperCase();
  for (const [re, id] of ATURAN_SARAN) {
    if (re.test(nama)) return idValid.has(id) ? id : null;
  }
  return null;
}

/** Kolom angka formulir SIRS 6 RL 3.5 (urutan tampil). */
export const KOLOM_RL35 = [
  { grup: "Dalam Kab/Kota", sub: "L", ambil: "dalamLk" },
  { grup: "Dalam Kab/Kota", sub: "P", ambil: "dalamPr" },
  { grup: "Luar Kab/Kota", sub: "L", ambil: "luarLk" },
  { grup: "Luar Kab/Kota", sub: "P", ambil: "luarPr" },
  { grup: "Total Kunjungan", sub: "L", ambil: "lk" },
  { grup: "Total Kunjungan", sub: "P", ambil: "pr" },
  { grup: "Total Kunjungan", sub: "Jumlah", ambil: "total" },
] as const;

export type KunciKolom = (typeof KOLOM_RL35)[number]["ambil"];

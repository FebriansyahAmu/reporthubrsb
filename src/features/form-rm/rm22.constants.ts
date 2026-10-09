/**
 * Acuan formulir **RM.22 — Informasi dan Persetujuan / Penolakan Tindakan
 * Kedokteran** (kertas F4 potret, 2 lembar: persetujuan & penolakan). Teks,
 * nomor, dan urutan baris 1:1 dengan formulir resmi RS. Murni & aman untuk
 * klien: dipakai skema, registri (syarat FINAL), tampilan form, dan cetak.
 *
 * Satu isian = satu tindakan (form berulang). Bagian PEMBERIAN INFORMASI sama
 * di kedua lembar; `lembar` menentukan pernyataan yang ditandatangani.
 */

export const RM22_RS = {
  nama: "RSUD BOLTIM",
  alamat: ["Jl. Ratahan-Kotamobagu Desa Sumber Rejo", "E-mail : boltimrsd@gmail.com", "Modayag - Bolaang mongondow timur"],
  kota: "Modayag",
} as const;

export const LEMBAR_RM22 = ["persetujuan", "penolakan"] as const;
export type LembarRm22 = (typeof LEMBAR_RM22)[number];

export const META_LEMBAR: Record<
  LembarRm22,
  { label: string; judul: string; bagian: string; kata: string; ringkas: string }
> = {
  persetujuan: {
    label: "Lembar Persetujuan",
    judul: "INFORMASI DAN PERSETUJUAN TINDAKAN KEDOKTERAN",
    bagian: "PERSETUJUAN TINDAKAN KEDOKTERAN",
    kata: "persetujuan",
    ringkas: "Pasien / wali menyetujui tindakan",
  },
  penolakan: {
    label: "Lembar Penolakan",
    judul: "INFORMASI DAN PENOLAKAN TINDAKAN KEDOKTERAN",
    bagian: "PENOLAKAN TINDAKAN KEDOKTERAN",
    kata: "penolakan",
    ringkas: "Pasien / wali menolak tindakan",
  },
};

/** Baris "Jenis Informasi" (urutan & nomor sesuai formulir). `id` tersimpan di data — JANGAN diubah. */
export const JENIS_INFORMASI = [
  { id: "diagnosis", no: "1.", label: "Diagnosis (WD & DD)", contoh: "WD: … · DD: …" },
  { id: "dasarDiagnosis", no: "2.", label: "Dasar Diagnosis", contoh: "Anamnesis, pemeriksaan fisik, penunjang" },
  { id: "tindakan", no: "3.", label: "Tindakan Kedokteran", contoh: "Nama tindakan yang akan dilakukan" },
  { id: "indikasi", no: "4.", label: "Indikasi Tindakan", contoh: "Alasan medis tindakan diperlukan" },
  { id: "tataCara", no: "5.", label: "Tata Cara", contoh: "Langkah tindakan & pembiusan" },
  { id: "tujuan", no: "6.", label: "Tujuan", contoh: "Diagnostik / terapeutik / paliatif" },
  { id: "risiko", no: "7.", label: "Risiko", contoh: "Risiko yang mungkin terjadi" },
  { id: "komplikasi", no: "8.", label: "Komplikasi", contoh: "Komplikasi yang mungkin timbul" },
  { id: "prognosis", no: "9.", label: "Prognosis", contoh: "Baik / ragu-ragu / buruk" },
  { id: "alternatif", no: "10.", label: "Alternatif & Risiko", contoh: "Pilihan lain beserta risikonya" },
  { id: "lainLain", no: "", label: "Lain-lain", contoh: "Mis. perkiraan biaya (opsional)" },
] as const;

export type IdInformasi = (typeof JENIS_INFORMASI)[number]["id"];
/** Baris 1–10 wajib diisi sebelum FINAL; "Lain-lain" opsional. */
export const INFORMASI_WAJIB = JENIS_INFORMASI.filter((j) => j.id !== "lainLain").map((j) => j.id);

export const TEKS_RM22 = {
  menerangkan:
    "Dengan ini menyatakan bahwa saya telah menerangkan hal-hal diatas secara benar dan jelas dan memberikan kesempatan untuk bertanya dan/atau berdiskusi",
  menerima: "Dengan ini menyatakan bahwa saya telah menerima informasi sebagaimana di atas yang saya beri tanda/paraf",
  catatanPenerima:
    "* Bila pasien tidak kompeten atau tidak mau menerima informasi, maka penerima informasi adalah wali atau keluarga terdekat",
  memahami:
    "Saya memahami perlunya dan manfaat tindakan tersebut sebagaimana telah dijelaskan seperti di atas kepada saya, termasuk risiko dan komplikasi yang mungkin timbul.",
} as const;

export const JK_RM22 = ["Laki-laki", "Perempuan"] as const;
export type JkRm22 = (typeof JK_RM22)[number];

/** Hubungan penanda tangan dengan pasien ("terhadap ___ saya bernama …"). */
export const HUBUNGAN_RM22 = ["Anak", "Istri", "Suami", "Ayah", "Ibu", "Saudara", "Kakek", "Nenek", "Cucu", "Wali"];

/** Data isian RM.22 (sama dengan keluaran `rm22FormSchema`). */
export type BarisInformasi = { isi: string; tanda: boolean };
export type Rm22Data = {
  lembar: "" | LembarRm22;
  dokterPelaksana: string;
  pemberiInformasi: string;
  penerimaInformasi: string;
  informasi: Record<IdInformasi, BarisInformasi>;
  pemberiTtd: string;
  penerimaTtd: string;
  pernyataNama: string;
  pernyataUmur: string;
  pernyataJk: "" | JkRm22;
  pernyataAlamat: string;
  tindakan: string;
  terhadap: "" | "diri" | "keluarga";
  hubungan: string;
  pasienNama: string;
  pasienUmur: string;
  pasienJk: "" | JkRm22;
  pasienAlamat: string;
  tanggal: string;
  pernyataTtd: string;
  saksi1Nama: string;
  saksi1Ttd: string;
  saksi2Nama: string;
  saksi2Ttd: string;
};

export function emptyRm22Form(): Rm22Data {
  return {
    lembar: "",
    dokterPelaksana: "",
    pemberiInformasi: "",
    penerimaInformasi: "",
    informasi: Object.fromEntries(JENIS_INFORMASI.map((j) => [j.id, { isi: "", tanda: false }])) as Record<
      IdInformasi,
      BarisInformasi
    >,
    pemberiTtd: "",
    penerimaTtd: "",
    pernyataNama: "",
    pernyataUmur: "",
    pernyataJk: "",
    pernyataAlamat: "",
    tindakan: "",
    terhadap: "",
    hubungan: "",
    pasienNama: "",
    pasienUmur: "",
    pasienJk: "",
    pasienAlamat: "",
    tanggal: "",
    pernyataTtd: "",
    saksi1Nama: "",
    saksi1Ttd: "",
    saksi2Nama: "",
    saksi2Ttd: "",
  };
}

/* ------------------------------------------------------------ alur pengisian */

/**
 * Alur pengisian (urutan = urutan di layar). Kekurangan tiap langkah juga
 * menjadi syarat FINAL — satu sumber untuk penanda progres dan validasi server.
 */
export const LANGKAH_RM22 = [
  { id: "pihak", judul: "Pemberian informasi", ringkas: "Dokter & penerima" },
  { id: "informasi", judul: "Isi informasi", ringkas: "10 jenis informasi" },
  { id: "ttdInformasi", judul: "Tanda tangan informasi", ringkas: "Dokter & penerima" },
  { id: "lembar", judul: "Keputusan pasien", ringkas: "Setuju / menolak" },
  { id: "pernyataan", judul: "Pernyataan", ringkas: "Yang menyatakan & tindakan" },
  { id: "ttdPernyataan", judul: "Tanda tangan & saksi", ringkas: "Yang menyatakan & saksi" },
] as const;
export type IdLangkah = (typeof LANGKAH_RM22)[number]["id"];

const kosong = (s: string) => s.trim() === "";
const bila = (kondisi: boolean, pesan: string) => (kondisi ? [pesan] : []);

/** Kekurangan per langkah (kosong = langkah lengkap). Defensif terhadap data lama/parsial. */
export function kekuranganRm22(d: Rm22Data): Record<IdLangkah, string[]> {
  const info = (id: IdInformasi): BarisInformasi => d.informasi?.[id] ?? { isi: "", tanda: false };
  const keluarga = d.terhadap === "keluarga";
  const kataTindakan = d.lembar === "penolakan" ? "ditolak" : d.lembar === "persetujuan" ? "disetujui" : "dinyatakan";

  const saksi = (no: 1 | 2, nama: string, ttd: string) => [
    ...bila(!kosong(nama) && ttd === "", `Saksi ${no}: tanda tangan`),
    ...bila(kosong(nama) && ttd !== "", `Saksi ${no}: nama`),
  ];
  const adaSaksi = (!kosong(d.saksi1Nama) && d.saksi1Ttd !== "") || (!kosong(d.saksi2Nama) && d.saksi2Ttd !== "");

  return {
    pihak: [
      ...bila(kosong(d.dokterPelaksana), "Dokter pelaksana tindakan"),
      ...bila(kosong(d.pemberiInformasi), "Pemberi informasi / DPJP"),
      ...bila(kosong(d.penerimaInformasi), "Penerima informasi (pasien / keluarga)"),
    ],
    informasi: [
      ...INFORMASI_WAJIB.flatMap((id) => {
        const j = JENIS_INFORMASI.find((x) => x.id === id)!;
        return bila(kosong(info(id).isi), `Informasi ${j.no.replace(".", "")} ${j.label}`);
      }),
      ...JENIS_INFORMASI.flatMap((j) =>
        bila(!kosong(info(j.id).isi) && !info(j.id).tanda, `Tanda (V) penerima: ${j.label}`),
      ),
    ],
    ttdInformasi: [
      ...bila(d.pemberiTtd === "", "Tanda tangan pemberi informasi"),
      ...bila(d.penerimaTtd === "", "Tanda tangan penerima informasi"),
    ],
    lembar: bila(d.lembar !== "persetujuan" && d.lembar !== "penolakan", "Keputusan: lembar persetujuan atau penolakan"),
    pernyataan: [
      ...bila(kosong(d.pernyataNama), "Nama yang menyatakan"),
      ...bila(kosong(d.pernyataUmur), "Umur yang menyatakan"),
      ...bila(d.pernyataJk === "", "Jenis kelamin yang menyatakan"),
      ...bila(kosong(d.pernyataAlamat), "Alamat yang menyatakan"),
      ...bila(kosong(d.tindakan), `Tindakan yang ${kataTindakan}`),
      ...bila(d.terhadap === "", "Tindakan terhadap diri sendiri atau keluarga"),
      ...(keluarga
        ? [
            ...bila(kosong(d.hubungan), "Hubungan dengan pasien"),
            ...bila(kosong(d.pasienNama), "Nama pasien"),
            ...bila(kosong(d.pasienUmur), "Umur pasien"),
            ...bila(d.pasienJk === "", "Jenis kelamin pasien"),
            ...bila(kosong(d.pasienAlamat), "Alamat pasien"),
          ]
        : []),
      ...bila(kosong(d.tanggal), "Tanggal pernyataan"),
    ],
    ttdPernyataan: [
      ...bila(d.pernyataTtd === "", "Tanda tangan yang menyatakan"),
      ...saksi(1, d.saksi1Nama, d.saksi1Ttd),
      ...saksi(2, d.saksi2Nama, d.saksi2Ttd),
      ...bila(!adaSaksi, "Minimal satu saksi (nama & tanda tangan)"),
    ],
  };
}

/** Slot TTD yang mengikat pernyataan persetujuan/penolakan (bukan TTD pemberian informasi). */
export const TTD_PERNYATAAN = ["pernyataTtd", "saksi1Ttd", "saksi2Ttd"] as const;

export const PESAN_GANTI_LEMBAR =
  "Lembar diganti: tanda tangan yang menyatakan dan saksi harus dibuat ulang untuk lembar yang baru.";
export const PESAN_TTD_LAMA = "Tanda tangan harus dibuat baru, bukan dipindahkan dari slot atau lembar lain.";

/** Slot TTD pemberian informasi (tidak terikat lembar). */
const TTD_INFORMASI = ["pemberiTtd", "penerimaTtd"] as const;

/**
 * Setiap TTD terikat pada slot yang ditandatangani; TTD pernyataan & saksi juga
 * terikat pada lembar. Referensi TTD tersimpan (`ttd:<id>`) hanya sah bila:
 * - sama dengan isi TERSIMPAN slot yang sama (untuk slot pernyataan/saksi: dan
 *   lembar tidak berubah); atau
 * - (slot yang menyatakan) sama dengan TTD penerima informasi yang TERSIMPAN —
 *   pernyataan penerimaan informasi tidak terikat lembar, jadi boleh dipakai
 *   ulang bila orangnya sama. Dibandingkan dengan nilai tersimpan, bukan nilai
 *   kiriman, agar TTD lama tak bisa "dicuci" lewat slot penerima.
 * Selain itu (TTD lama setelah lembar diganti, TTD lembar sebelumnya dipasang
 * lagi, TTD ditukar antar-slot) ditolak: kosongkan atau gambar baru. Dijaga di
 * server saat simpan; UI mengosongkan TTD pernyataan dengan konfirmasi saat
 * ganti lembar. null = perubahan sah.
 */
export function cekTtdPernyataan(
  lama: unknown,
  baru: Pick<Rm22Data, "lembar" | (typeof TTD_INFORMASI)[number] | (typeof TTD_PERNYATAAN)[number]>,
): string | null {
  const l = (lama && typeof lama === "object" ? lama : {}) as Partial<Record<string, unknown>>;
  const lembarSama = (l.lembar ?? "") === baru.lembar;
  // "" atau TTD baru (PNG data-URL) selalu sah; hanya referensi yang diperiksa.
  const ref = (v: string) => v.startsWith("ttd:");
  for (const s of TTD_INFORMASI) {
    if (ref(baru[s]) && baru[s] !== l[s]) return PESAN_TTD_LAMA;
  }
  for (const s of TTD_PERNYATAAN) {
    const v = baru[s];
    if (!ref(v)) continue;
    if (lembarSama && v === l[s]) continue;
    if (s === "pernyataTtd" && v === l.penerimaTtd && v === baru.penerimaTtd) continue;
    return lembarSama ? PESAN_TTD_LAMA : PESAN_GANTI_LEMBAR;
  }
  return null;
}

export type StatusLangkah = "kosong" | "sebagian" | "lengkap";

/** Langkah belum disentuh sama sekali → "kosong" (bukan "sebagian"). */
export function statusLangkah(d: Rm22Data, id: IdLangkah, kurang: readonly string[]): StatusLangkah {
  if (kurang.length === 0) return "lengkap";
  const ada = (...v: string[]) => v.some((s) => !kosong(s));
  const tersentuh: Record<IdLangkah, boolean> = {
    pihak: ada(d.dokterPelaksana, d.pemberiInformasi, d.penerimaInformasi),
    informasi: JENIS_INFORMASI.some((j) => !kosong(d.informasi?.[j.id]?.isi ?? "")),
    ttdInformasi: ada(d.pemberiTtd, d.penerimaTtd),
    lembar: d.lembar !== "",
    pernyataan: ada(d.pernyataNama, d.pernyataUmur, d.pernyataAlamat, d.tindakan, d.hubungan) || d.terhadap !== "",
    ttdPernyataan: ada(d.pernyataTtd, d.saksi1Nama, d.saksi1Ttd, d.saksi2Nama, d.saksi2Ttd),
  };
  return tersentuh[id] ? "sebagian" : "kosong";
}

/** Ringkasan satu isian untuk daftar isian per pasien (form berulang). */
export function ringkasRm22(d: Partial<Rm22Data> | null | undefined): {
  judul: string;
  lencana: { label: string; nada: "success" | "danger" | "warning" };
} {
  const tindakan = (d?.tindakan ?? "").trim() || (d?.informasi?.tindakan?.isi ?? "").trim();
  const lembar = d?.lembar === "persetujuan" || d?.lembar === "penolakan" ? d.lembar : null;
  return {
    judul: tindakan || "Tindakan belum diisi",
    lencana: lembar
      ? { label: lembar === "persetujuan" ? "Persetujuan" : "Penolakan", nada: lembar === "persetujuan" ? "success" : "danger" }
      : { label: "Keputusan belum dipilih", nada: "warning" },
  };
}

/** "45 th 3 bl" (umur kepala formulir) → "45"; "" bila tak terbaca. */
export function umurTahun(umur: string | null | undefined): string {
  const m = /^(\d{1,3})\s*th/.exec((umur ?? "").trim());
  return m ? String(Number(m[1])) : "";
}

/** Jenis kelamin kepala formulir ("Laki-Laki"/"Perempuan") → pilihan RM.22. */
export function jkRm22(jk: string | null | undefined): "" | JkRm22 {
  const t = (jk ?? "").trim().toLowerCase();
  return t === "laki-laki" ? "Laki-laki" : t === "perempuan" ? "Perempuan" : "";
}

/** Perkiraan karakter per baris kolom "Isi Informasi" cetak pada lebar kertas asli (±46 mm, 8 pt). */
export const KARAKTER_PER_BARIS_ISI = 30;
/** Tinggi baris tabel cetak (mm): minimum, per baris teks 8 pt, dan bantalan sel. */
const TINGGI_BARIS_MM = 6.4;
const TINGGI_TEKS_MM = 3.25;
const BANTALAN_MM = 1;
/** Ruang cadangan lembar F4 (mm) di atas tanda tangan untuk baris yang memanjang. */
export const CADANGAN_MM = 13;

/**
 * Kolom "Isi Informasi" cetak diperlebar bila isinya panjang: kertas dirancang
 * untuk tulisan tangan singkat (kolom ±46 mm), sedangkan isian ketik bisa lebih
 * panjang. Lebar asli dipertahankan selama perkiraan tambahan tinggi tabel
 * masih muat di ruang cadangan satu lembar.
 */
export function kolomIsiLebar(informasi: Partial<Record<IdInformasi, BarisInformasi>> | undefined): boolean {
  let tambahan = 0;
  for (const j of JENIS_INFORMASI) {
    const baris = (informasi?.[j.id]?.isi ?? "").split("\n");
    const n = baris.reduce((s, b) => s + Math.max(1, Math.ceil(b.trim().length / KARAKTER_PER_BARIS_ISI)), 0);
    tambahan += Math.max(0, n * TINGGI_TEKS_MM + BANTALAN_MM - TINGGI_BARIS_MM);
  }
  return tambahan > CADANGAN_MM;
}

/** Pecah teks di batas kata: bagian pertama ≤ `n` karakter (rumpang baris 1 cetak), sisanya ke baris 2. */
export function pecahBaris(teks: string, n: number): [string, string] {
  const t = teks.trim().replace(/\s+/g, " ");
  if (t.length <= n) return [t, ""];
  const potong = t.lastIndexOf(" ", n);
  const i = potong > n * 0.5 ? potong : n;
  return [t.slice(0, i).trim(), t.slice(i).trim()];
}

const BULAN = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];

/** "2026-10-09" → "9 Oktober 2026"; "" bila tak valid. */
export function tanggalPanjang(ymd: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd.trim());
  if (!m || Number(m[2]) < 1 || Number(m[2]) > 12) return "";
  return `${Number(m[3])} ${BULAN[Number(m[2]) - 1]} ${m[1]}`;
}

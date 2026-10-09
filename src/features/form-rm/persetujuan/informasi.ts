/**
 * Bagian BERSAMA formulir "Informasi dan Persetujuan" — RM.22 (tindakan
 * kedokteran) dan RM.33 (rujukan) memakai kop, tabel PEMBERIAN INFORMASI,
 * pernyataan pemberi/penerima informasi, blok "Saya yang bertandatangan…",
 * dan saksi yang teksnya sama persis. Murni & aman untuk klien: dipakai skema,
 * registri (syarat FINAL & aturan TTD), tampilan form, cetak, dan pemetaan SIMRS.
 */

export const KOP_RS = {
  nama: "RSUD BOLTIM",
  alamat: ["Jl. Ratahan-Kotamobagu Desa Sumber Rejo", "E-mail : boltimrsd@gmail.com", "Modayag - Bolaang mongondow timur"],
} as const;

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

export type BarisInformasi = { isi: string; tanda: boolean };
export type TabelInformasi = Record<IdInformasi, BarisInformasi>;

export function informasiKosong(): TabelInformasi {
  return Object.fromEntries(JENIS_INFORMASI.map((j) => [j.id, { isi: "", tanda: false }])) as TabelInformasi;
}

/** Data tersimpan (bisa parsial/lama) → 11 baris lengkap. */
export function lengkapiInformasi(x: unknown): TabelInformasi {
  const ada = (x && typeof x === "object" ? x : {}) as Partial<Record<IdInformasi, Partial<BarisInformasi>>>;
  return Object.fromEntries(
    JENIS_INFORMASI.map((j) => {
      const b = ada[j.id];
      return [j.id, { isi: typeof b?.isi === "string" ? b.isi : "", tanda: b?.tanda === true }];
    }),
  ) as TabelInformasi;
}

export const TEKS_INFORMASI = {
  menerangkan:
    "Dengan ini menyatakan bahwa saya telah menerangkan hal-hal diatas secara benar dan jelas dan memberikan kesempatan untuk bertanya dan/atau berdiskusi",
  menerima: "Dengan ini menyatakan bahwa saya telah menerima informasi sebagaimana di atas yang saya beri tanda/paraf",
  catatanPenerima:
    "* Bila pasien tidak kompeten atau tidak mau menerima informasi, maka penerima informasi adalah wali atau keluarga terdekat",
} as const;

export const JK_PILIHAN = ["Laki-laki", "Perempuan"] as const;
export type JkPilihan = (typeof JK_PILIHAN)[number];

/** Hubungan penanda tangan dengan pasien ("terhadap ___ saya bernama …"). */
export const HUBUNGAN_KELUARGA = ["Anak", "Istri", "Suami", "Ayah", "Ibu", "Saudara", "Kakek", "Nenek", "Cucu", "Wali"];

/* ------------------------------------------------------- bagian data bersama */

/** PEMBERIAN INFORMASI: pihak, 11 baris informasi, TTD pemberi & penerima. */
export type DataPemberianInformasi = {
  dokterPelaksana: string;
  pemberiInformasi: string;
  penerimaInformasi: string;
  informasi: TabelInformasi;
  pemberiTtd: string;
  penerimaTtd: string;
};

/** "Saya yang bertandatangan di bawah ini …" + "terhadap saya / ___ saya bernama …". */
export type DataYangMenyatakan = {
  pernyataNama: string;
  pernyataUmur: string;
  pernyataJk: "" | JkPilihan;
  pernyataAlamat: string;
  terhadap: "" | "diri" | "keluarga";
  hubungan: string;
  pasienNama: string;
  pasienUmur: string;
  pasienJk: "" | JkPilihan;
  pasienAlamat: string;
};

export type DataSaksi = { saksi1Nama: string; saksi1Ttd: string; saksi2Nama: string; saksi2Ttd: string };

export function pemberianInformasiKosong(): DataPemberianInformasi {
  return { dokterPelaksana: "", pemberiInformasi: "", penerimaInformasi: "", informasi: informasiKosong(), pemberiTtd: "", penerimaTtd: "" };
}

export function yangMenyatakanKosong(): DataYangMenyatakan {
  return {
    pernyataNama: "",
    pernyataUmur: "",
    pernyataJk: "",
    pernyataAlamat: "",
    terhadap: "",
    hubungan: "",
    pasienNama: "",
    pasienUmur: "",
    pasienJk: "",
    pasienAlamat: "",
  };
}

export const saksiKosong = (): DataSaksi => ({ saksi1Nama: "", saksi1Ttd: "", saksi2Nama: "", saksi2Ttd: "" });

/* ------------------------------------------------- kekurangan (syarat FINAL) */

export const kosong = (s: string | null | undefined) => (s ?? "").trim() === "";
export const bila = (kondisi: boolean, pesan: string) => (kondisi ? [pesan] : []);
/** Ada nilai yang terisi (penentu langkah "sebagian" vs "kosong"). */
export const adaIsi = (...v: string[]) => v.some((s) => !kosong(s));

export function kurangPihak(d: DataPemberianInformasi): string[] {
  return [
    ...bila(kosong(d.dokterPelaksana), "Dokter pelaksana tindakan"),
    ...bila(kosong(d.pemberiInformasi), "Pemberi informasi / DPJP"),
    ...bila(kosong(d.penerimaInformasi), "Penerima informasi (pasien / keluarga)"),
  ];
}

/** Baris 1–10 wajib diisi; setiap baris berisi (termasuk Lain-lain) wajib ditandai (V) penerima. */
export function kurangInformasi(d: Pick<DataPemberianInformasi, "informasi">): string[] {
  const info = (id: IdInformasi): BarisInformasi => d.informasi?.[id] ?? { isi: "", tanda: false };
  return [
    ...INFORMASI_WAJIB.flatMap((id) => {
      const j = JENIS_INFORMASI.find((x) => x.id === id)!;
      return bila(kosong(info(id).isi), `Informasi ${j.no.replace(".", "")} ${j.label}`);
    }),
    ...JENIS_INFORMASI.flatMap((j) => bila(!kosong(info(j.id).isi) && !info(j.id).tanda, `Tanda (V) penerima: ${j.label}`)),
  ];
}

export function kurangTtdInformasi(d: Pick<DataPemberianInformasi, "pemberiTtd" | "penerimaTtd">): string[] {
  return [
    ...bila(d.pemberiTtd === "", "Tanda tangan pemberi informasi"),
    ...bila(d.penerimaTtd === "", "Tanda tangan penerima informasi"),
  ];
}

/** Nama · umur · JK · alamat yang menyatakan. */
export function kurangYangMenyatakan(d: DataYangMenyatakan): string[] {
  return [
    ...bila(kosong(d.pernyataNama), "Nama yang menyatakan"),
    ...bila(kosong(d.pernyataUmur), "Umur yang menyatakan"),
    ...bila(d.pernyataJk === "", "Jenis kelamin yang menyatakan"),
    ...bila(kosong(d.pernyataAlamat), "Alamat yang menyatakan"),
  ];
}

/** "terhadap saya / keluarga" — identitas pasien wajib bila yang menyatakan adalah keluarga. */
export function kurangTerhadap(d: DataYangMenyatakan, objek: string): string[] {
  return [
    ...bila(d.terhadap === "", `${objek} terhadap diri sendiri atau keluarga`),
    ...(d.terhadap === "keluarga"
      ? [
          ...bila(kosong(d.hubungan), "Hubungan dengan pasien"),
          ...bila(kosong(d.pasienNama), "Nama pasien"),
          ...bila(kosong(d.pasienUmur), "Umur pasien"),
          ...bila(d.pasienJk === "", "Jenis kelamin pasien"),
          ...bila(kosong(d.pasienAlamat), "Alamat pasien"),
        ]
      : []),
  ];
}

/** Saksi setengah terisi ditandai; minimal satu saksi lengkap (nama & TTD). */
export function kurangSaksi(d: DataSaksi): string[] {
  const saksi = (no: 1 | 2, nama: string, ttd: string) => [
    ...bila(!kosong(nama) && ttd === "", `Saksi ${no}: tanda tangan`),
    ...bila(kosong(nama) && ttd !== "", `Saksi ${no}: nama`),
  ];
  const ada = (!kosong(d.saksi1Nama) && d.saksi1Ttd !== "") || (!kosong(d.saksi2Nama) && d.saksi2Ttd !== "");
  return [
    ...saksi(1, d.saksi1Nama, d.saksi1Ttd),
    ...saksi(2, d.saksi2Nama, d.saksi2Ttd),
    ...bila(!ada, "Minimal satu saksi (nama & tanda tangan)"),
  ];
}

export type StatusLangkah = "kosong" | "sebagian" | "lengkap";

/** Langkah lengkap bila tanpa kekurangan; belum disentuh sama sekali → "kosong" (bukan "sebagian"). */
export const statusDari = (kurang: readonly string[], tersentuh: boolean): StatusLangkah =>
  kurang.length === 0 ? "lengkap" : tersentuh ? "sebagian" : "kosong";

/* ------------------------------------------------------------ aturan TTD */

export const PESAN_TTD_LAMA = "Tanda tangan harus dibuat baru, bukan dipindahkan dari slot atau lembar lain.";

/**
 * Aturan TTD antar-simpan (hook registri `cekPerubahan`). Setiap TTD terikat
 * pada slot yang ditandatangani; TTD PERNYATAAN juga terikat pada nilai
 * `kunci` (lembar/keputusan yang ditandatangani). Referensi TTD tersimpan
 * (`ttd:<id>`) hanya sah bila:
 * - sama dengan isi TERSIMPAN slot yang sama (slot pernyataan: dan `kunci`
 *   tidak berubah); atau
 * - (slot pernyataan dalam `pakaiUlang`) sama dengan TTD slot informasi
 *   pasangannya yang TERSIMPAN — pernyataan pemberian informasi tidak terikat
 *   lembar, jadi boleh dipakai ulang bila orangnya sama. Dibandingkan dengan
 *   nilai tersimpan, bukan nilai kiriman, agar TTD lama tak bisa "dicuci"
 *   lewat slot informasi.
 * Selain itu (TTD lama setelah keputusan diganti, TTD keputusan sebelumnya
 * dipasang lagi, TTD ditukar antar-slot) ditolak: kosongkan atau gambar baru.
 * "" dan TTD baru (data-URL PNG) selalu sah. null = perubahan sah.
 */
export function aturanTtd<K extends string, I extends string, P extends string>(c: {
  kunci: K;
  informasi: readonly I[];
  pernyataan: readonly P[];
  pakaiUlang: Partial<Record<P, I>>;
  pesanGanti: string;
}) {
  return (lama: unknown, baru: Record<K | I | P, string>): string | null => {
    const l = (lama && typeof lama === "object" ? lama : {}) as Partial<Record<string, unknown>>;
    const kunciSama = (l[c.kunci] ?? "") === baru[c.kunci];
    const ref = (v: string) => v.startsWith("ttd:");
    for (const s of c.informasi) {
      if (ref(baru[s]) && baru[s] !== l[s]) return PESAN_TTD_LAMA;
    }
    for (const s of c.pernyataan) {
      const v = baru[s];
      if (!ref(v)) continue;
      if (kunciSama && v === l[s]) continue;
      const pasangan = c.pakaiUlang[s];
      if (pasangan && v === l[pasangan] && v === baru[pasangan]) continue;
      return kunciSama ? PESAN_TTD_LAMA : c.pesanGanti;
    }
    return null;
  };
}

/* ------------------------------------------------------- bantu isi & cetak */

/** "45 th 3 bl" (umur kepala formulir) → "45"; "" bila tak terbaca. */
export function umurTahun(umur: string | null | undefined): string {
  const m = /^(\d{1,3})\s*th/.exec((umur ?? "").trim());
  return m ? String(Number(m[1])) : "";
}

/** Jenis kelamin kepala formulir ("Laki-Laki"/"Perempuan") → pilihan formulir. */
export function jkDariHeader(jk: string | null | undefined): "" | JkPilihan {
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

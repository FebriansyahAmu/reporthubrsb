import { adaIsi, bila, kosong, PESAN_TTD_LAMA, statusDari, tanggalPanjang, type StatusLangkah } from "./persetujuan/informasi";

/**
 * Acuan formulir **RM.50 — Monitoring Pemberian Transfusi Darah / Produk
 * Darah** (kertas F4 lanskap, 2 halaman). Halaman 1: kop, data transfusi,
 * riwayat & penerimaan kantong, tabel 10 baris; halaman 2: lanjutan tabel 13
 * baris + catatan. Satu baris = satu kantong darah dengan tanda vital pada
 * empat waktu. Teks 1:1 dengan formulir resmi RS. Murni & aman untuk klien.
 *
 * Satu isian = satu pemberian transfusi (form berulang); paling banyak 23
 * kantong — kapasitas kedua halaman kertas.
 */

export const BARIS_HAL1 = 10;
export const BARIS_HAL2 = 13;
export const MAKS_KANTONG = BARIS_HAL1 + BARIS_HAL2;

export const TEKS_RM50 = {
  judul: "MONITORING PEMBERIAN TRANSFUSI DARAH/PRODUK DARAH",
  petunjuk: "(Diisi oleh petugas yang melakukan Transfuse, Penulisan harus jelas dan lengkap)",
  catatan: ["Identifikasi dengan benar", "Cek set transfusi darah", "Surat ijin transfusi", "Isi form monitoring transfusi"],
} as const;

/** Empat waktu pengukuran tanda vital (urutan kolom kertas). `menit` = selisih dari mulai transfusi kantong. */
export const FASE_TTV = [
  { id: "sebelum", baris: ["30 Menit", "Sebelum Transfusi"], singkat: "30 mnt sebelum", menit: -30 },
  { id: "awal", baris: ["15 Menit pertama", "dimulai Transfusi"], singkat: "15 mnt pertama", menit: 15 },
  { id: "saat", baris: ["60 Menit", "Saat Transfusi"], singkat: "60 mnt saat", menit: 60 },
  { id: "setelah", baris: ["60 Menit", "Setelah Transfusi"], singkat: "60 mnt setelah", menit: null },
] as const;
export type IdFase = (typeof FASE_TTV)[number]["id"];

/** TD (mmHg) · N nadi (x/mnt) · R napas (x/mnt) · S suhu (°C). "-" = tidak diukur. */
export const KOLOM_TTV = ["td", "n", "r", "s"] as const;
export type KolomTtv = (typeof KOLOM_TTV)[number];
export type TtvRm50 = Record<KolomTtv, string>;

export const POLA_TTV: Record<KolomTtv, RegExp> = {
  td: /^(\d{2,3}\/\d{2,3}|-)?$/,
  n: /^(\d{1,3}|-)?$/,
  r: /^(\d{1,3}|-)?$/,
  s: /^(\d{2}([.,]\d{1,2})?|-)?$/,
};

/** Golongan darah (referensi SIMGOS JENIS 6, tanpa "Tidak Tahu"). */
export const GOLONGAN_DARAH = ["A", "B", "AB", "O", "A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"] as const;
export type GolonganDarah = (typeof GOLONGAN_DARAH)[number];

/** Saran isian "Jenis Darah" (produk darah lazim); kolom tetap teks bebas. */
export const SARAN_JENIS_DARAH = ["WB", "PRC", "TC", "FFP"] as const;

export const YA_TIDAK = ["tidak", "ya"] as const;
export type YaTidak = (typeof YA_TIDAK)[number];
export const KEADAAN_KANTONG = ["utuh", "tidakUtuh"] as const;
export type KeadaanKantong = (typeof KEADAAN_KANTONG)[number];

export type KantongRm50 = {
  /** Pengenal baris (kunci tampilan), bukan bagian kertas. */
  id: string;
  /** "Tanggal/Jam" mulai transfusi kantong ini — "YYYY-MM-DDTHH:mm". */
  waktu: string;
  jenis: string;
  noSeri: string;
  /** "YYYY-MM-DD". */
  kadaluarsa: string;
  /** Isi (ml). */
  isi: string;
  ttv: Record<IdFase, TtvRm50>;
  reaksi: string;
  /** Nama petugas yang memaraf (tak tercetak; penjaga pakai ulang paraf). */
  parafNama: string;
  paraf: string;
};

/** Data isian RM.50 (sama dengan keluaran `rm50FormSchema`). */
export type Rm50Data = {
  /** "Tanggal : … Jam : …" — "YYYY-MM-DDTHH:mm". */
  waktu: string;
  ruangRawat: string;
  dokter: string;
  alergi: "" | YaTidak;
  alergiKet: string;
  pernahTransfusi: "" | YaTidak;
  transfusiTahun: string;
  golonganDarah: "" | GolonganDarah;
  kantongKeadaan: "" | KeadaanKantong;
  kantongKet: string;
  /** "Tanggal Darah diterima : … Jam : …" — "YYYY-MM-DDTHH:mm". */
  diterimaWaktu: string;
  kantong: KantongRm50[];
};

export const ttvKosong = (): TtvRm50 => ({ td: "", n: "", r: "", s: "" });

export function kantongKosong(id: string, waktu = ""): KantongRm50 {
  return {
    id,
    waktu,
    jenis: "",
    noSeri: "",
    kadaluarsa: "",
    isi: "",
    ttv: { sebelum: ttvKosong(), awal: ttvKosong(), saat: ttvKosong(), setelah: ttvKosong() },
    reaksi: "",
    parafNama: "",
    paraf: "",
  };
}

export function emptyRm50Form(): Rm50Data {
  return {
    waktu: "",
    ruangRawat: "",
    dokter: "",
    alergi: "",
    alergiKet: "",
    pernahTransfusi: "",
    transfusiTahun: "",
    golonganDarah: "",
    kantongKeadaan: "",
    kantongKet: "",
    diterimaWaktu: "",
    kantong: [],
  };
}

/* ------------------------------------------------------------------ waktu */

const WAKTU_RE = /^(\d{4}-\d{2}-\d{2})T([01]\d|2[0-3]):([0-5]\d)$/;
const p2 = (n: number) => String(n).padStart(2, "0");

/** "2026-10-09T14:05" → { tanggal: "9 Oktober 2026", jam: "14.05", ymd }; kosong bila tak valid. */
export function pisahWaktu(waktu: string): { tanggal: string; jam: string; ymd: string } {
  const m = WAKTU_RE.exec((waktu ?? "").trim());
  const tanggal = m ? tanggalPanjang(m[1]) : "";
  return tanggal ? { tanggal, jam: `${m![2]}.${m![3]}`, ymd: m![1] } : { tanggal: "", jam: "", ymd: "" };
}

/** "2026-10-09T14:05" → "09/10/26" & "14.05" (sel tabel cetak yang sempit). */
export function waktuRingkas(waktu: string): { tgl: string; jam: string } {
  const m = WAKTU_RE.exec((waktu ?? "").trim());
  if (!m || !tanggalPanjang(m[1])) return { tgl: "", jam: "" };
  const [y, mo, d] = m[1].split("-");
  return { tgl: `${d}/${mo}/${y.slice(2)}`, jam: `${m[2]}.${m[3]}` };
}

/** Jam sasaran pengukuran fase (dari mulai transfusi kantong), "HH.mm"; null bila tak bisa dihitung. */
export function jamFase(waktu: string, menit: number | null): string | null {
  const m = WAKTU_RE.exec((waktu ?? "").trim());
  if (!m || menit === null) return null;
  const total = (((Number(m[2]) * 60 + Number(m[3]) + menit) % 1440) + 1440) % 1440;
  return `${p2(Math.floor(total / 60))}.${p2(total % 60)}`;
}

/* ------------------------------------------------------------ penanda klinis */

/** Reaksi berisi selain "tidak ada" / "-" → ada reaksi transfusi. */
export const adaReaksi = (reaksi: string): boolean => !kosong(reaksi) && !/^(tidak( ada)?|-)$/i.test(reaksi.trim());

const angkaSuhu = (s: string): number | null => {
  const n = Number(s.trim().replace(",", "."));
  return s.trim() && s.trim() !== "-" && Number.isFinite(n) ? n : null;
};

/** Suhu naik ≥ 1 °C dibanding 30 menit sebelum transfusi pada salah satu pengukuran berikutnya. */
export function suhuNaik(k: Pick<KantongRm50, "ttv">): boolean {
  const awal = angkaSuhu(k.ttv?.sebelum?.s ?? "");
  if (awal === null) return false;
  return (["awal", "saat", "setelah"] as const).some((f) => {
    const v = angkaSuhu(k.ttv?.[f]?.s ?? "");
    return v !== null && v - awal >= 1;
  });
}

/** Tanggal kedaluwarsa sebelum tanggal transfusi kantong. */
export function kedaluwarsa(k: Pick<KantongRm50, "kadaluarsa" | "waktu">): boolean {
  const tgl = pisahWaktu(k.waktu).ymd;
  return !!tgl && !!tanggalPanjang(k.kadaluarsa ?? "") && k.kadaluarsa < tgl;
}

/** TTV satu fase terisi semua (angka atau "-"). */
export const ttvLengkap = (t: TtvRm50 | undefined) => KOLOM_TTV.every((c) => !kosong(t?.[c]));

/**
 * Nilai TTV yang terisi tetapi tidak sesuai pola kertas (mis. "120/" atau "3,7").
 * Skema server menolak pola ini → SELURUH isian gagal tersimpan; layar menandai
 * sel yang bersangkutan agar petugas tahu yang harus dibetulkan.
 */
export const ttvSalahFormat = (c: KolomTtv, v: string | undefined) => !!v && !POLA_TTV[c].test(v);

/** Petunjuk format per kolom TTV (pesan di bawah sel yang salah). */
export const CONTOH_TTV: Record<KolomTtv, string> = {
  td: "Tulis seperti 120/80, atau “-”",
  n: "Tulis angka, mis. 88, atau “-”",
  r: "Tulis angka, mis. 20, atau “-”",
  s: "Tulis seperti 36,5, atau “-”",
};

/** Jumlah sel TTV yang salah format pada satu kantong. */
export const jumlahTtvSalah = (k: Pick<KantongRm50, "ttv">) =>
  FASE_TTV.reduce((n, f) => n + KOLOM_TTV.filter((c) => ttvSalahFormat(c, k.ttv?.[f.id]?.[c])).length, 0);

/* ------------------------------------------------------------ alur pengisian */

export const LANGKAH_RM50 = [
  { id: "transfusi", judul: "Data transfusi" },
  { id: "riwayat", judul: "Riwayat & golongan darah" },
  { id: "penerimaan", judul: "Penerimaan kantong" },
  { id: "monitoring", judul: "Monitoring per kantong" },
] as const;
export type IdLangkahRm50 = (typeof LANGKAH_RM50)[number]["id"];

/** "Kantong 2" — label baris pada daftar kekurangan. */
export const labelKantong = (i: number) => `Kantong ${i + 1}`;

/**
 * Satu kekurangan syarat FINAL + kolom asalnya (`kolom`; `kantong` = id baris
 * bila kolom milik kartu kantong). Layar isian memetakan ke id elemen untuk
 * memindahkan fokus; server hanya memakai `pesan` (lewat `kekuranganRm50`).
 */
export type KurangRm50 = { pesan: string; kolom: string; kantong?: string };

const butir = (syarat: boolean, pesan: string, kolom: string, kantong?: string): KurangRm50[] =>
  bila(syarat, pesan).map((p) => (kantong ? { pesan: p, kolom, kantong } : { pesan: p, kolom }));

/** Tahun lalu yang sah untuk "Pernah transfusi … Tahun": 19xx/20xx dan tidak sesudah tahun transfusi ini. */
export function tahunTransfusiSah(tahun: string, waktuTransfusi: string): boolean {
  const kini = pisahWaktu(waktuTransfusi).ymd.slice(0, 4);
  return /^(19|20)\d{2}$/.test(tahun) && !(kini && tahun > kini);
}

export function kurangKantongRinci(k: KantongRm50, i: number): KurangRm50[] {
  const L = labelKantong(i);
  const id = k.id;
  return [
    ...butir(!pisahWaktu(k.waktu).tanggal, `${L}: tanggal/jam`, "waktu", id),
    ...butir(kosong(k.jenis), `${L}: jenis darah`, "jenis", id),
    ...butir(kosong(k.noSeri), `${L}: no. seri kantong`, "seri", id),
    ...butir(!tanggalPanjang(k.kadaluarsa ?? ""), `${L}: tanggal kadaluarsa`, "kadaluarsa", id),
    ...butir(kosong(k.isi), `${L}: isi (ml)`, "isi", id),
    // Fokus ke sel TTV pertama yang masih kosong pada fase itu.
    ...FASE_TTV.flatMap((f) =>
      butir(!ttvLengkap(k.ttv?.[f.id]), `${L}: TTV ${f.singkat}`, `${f.id}-${KOLOM_TTV.find((c) => kosong(k.ttv?.[f.id]?.[c])) ?? "td"}`, id),
    ),
    ...butir(kosong(k.reaksi), `${L}: reaksi (tulis "Tidak ada" bila tidak ada)`, "reaksi", id),
    ...butir(kosong(k.parafNama), `${L}: nama petugas`, "paraf-nama", id),
    ...butir(k.paraf === "", `${L}: paraf`, "paraf", id),
  ];
}

export const kurangKantong = (k: KantongRm50, i: number): string[] => kurangKantongRinci(k, i).map((x) => x.pesan);

/** Kekurangan syarat FINAL per langkah beserta kolomnya (sumber tunggal — server & layar). */
export function kekuranganRinciRm50(d: Rm50Data): Record<IdLangkahRm50, KurangRm50[]> {
  return {
    transfusi: [
      ...butir(!pisahWaktu(d.waktu).tanggal, "Tanggal & jam transfusi", "waktu"),
      ...butir(kosong(d.ruangRawat), "Ruang rawat", "ruang"),
      ...butir(kosong(d.dokter), "Dokter yang merawat", "dokter"),
    ],
    riwayat: [
      ...butir(d.alergi === "", "Riwayat alergi: tidak / ya", "alergi"),
      ...butir(d.alergi === "ya" && kosong(d.alergiKet), "Sebutkan alergi", "alergi-ket"),
      ...butir(d.pernahTransfusi === "", "Pernah transfusi darah: tidak / ya", "pernah"),
      ...butir(d.pernahTransfusi === "ya" && !tahunTransfusiSah(d.transfusiTahun, d.waktu), "Tahun transfusi sebelumnya", "tahun"),
      ...butir(d.golonganDarah === "", "Golongan darah", "golongan"),
    ],
    penerimaan: [
      ...butir(d.kantongKeadaan === "", "Keadaan kantong darah: utuh / tidak utuh", "keadaan"),
      ...butir(d.kantongKeadaan === "tidakUtuh" && kosong(d.kantongKet), "Keterangan kantong tidak utuh", "kantong-ket"),
      ...butir(!pisahWaktu(d.diterimaWaktu).tanggal, "Tanggal & jam darah diterima", "diterima"),
    ],
    monitoring: [
      ...butir((d.kantong ?? []).length === 0, "Minimal satu kantong darah", "tambah"),
      ...(d.kantong ?? []).flatMap(kurangKantongRinci),
    ],
  };
}

export function kekuranganRm50(d: Rm50Data): Record<IdLangkahRm50, string[]> {
  const r = kekuranganRinciRm50(d);
  return {
    transfusi: r.transfusi.map((x) => x.pesan),
    riwayat: r.riwayat.map((x) => x.pesan),
    penerimaan: r.penerimaan.map((x) => x.pesan),
    monitoring: r.monitoring.map((x) => x.pesan),
  };
}

/** Status satu kartu kantong: lengkap / sebagian (ada isi) / kosong. */
export function statusKantong(k: KantongRm50, i: number): StatusLangkah {
  const terisi =
    adaIsi(k.waktu, k.jenis, k.noSeri, k.kadaluarsa, k.isi, k.reaksi, k.parafNama, k.paraf) ||
    FASE_TTV.some((f) => KOLOM_TTV.some((c) => !kosong(k.ttv?.[f.id]?.[c])));
  return statusDari(kurangKantong(k, i), terisi);
}

export function statusLangkahRm50(d: Rm50Data, id: IdLangkahRm50, kurang: readonly string[]): StatusLangkah {
  const tersentuh: Record<IdLangkahRm50, boolean> = {
    transfusi: adaIsi(d.waktu, d.ruangRawat, d.dokter),
    riwayat: d.alergi !== "" || d.pernahTransfusi !== "" || d.golonganDarah !== "",
    penerimaan: d.kantongKeadaan !== "" || adaIsi(d.diterimaWaktu),
    monitoring: (d.kantong ?? []).length > 0,
  };
  return statusDari(kurang, tersentuh[id]);
}

/* ------------------------------------------------------------ aturan paraf */

const namaSama = (a: unknown, b: string) => typeof a === "string" && !kosong(a) && a.trim().toLowerCase() === b.trim().toLowerCase();

/**
 * Paraf terikat pada nama petugas baris. Referensi paraf tersimpan (`ttd:<id>`)
 * hanya sah bila ada baris TERSIMPAN berparaf sama dengan nama petugas yang
 * sama — baris yang sama, atau baris lain milik petugas yang sama (pakai ulang
 * paraf). Mengganti nama petugas, atau memasang paraf petugas lain, ditolak.
 * Dibandingkan dengan data tersimpan, bukan kiriman. "" & paraf baru selalu sah.
 */
export function cekParafRm50(lama: unknown, baru: Pick<Rm50Data, "kantong">): string | null {
  const l = (lama && typeof lama === "object" ? lama : {}) as { kantong?: unknown };
  const tersimpan = (Array.isArray(l.kantong) ? l.kantong : []) as Partial<KantongRm50>[];
  for (const k of baru.kantong) {
    if (!k.paraf.startsWith("ttd:")) continue;
    const sah = tersimpan.some((t) => t && t.paraf === k.paraf && namaSama(t.parafNama, k.parafNama));
    if (!sah) return PESAN_PARAF;
  }
  return null;
}

export const PESAN_PARAF = `${PESAN_TTD_LAMA} Paraf hanya dapat dipakai ulang dari baris tersimpan dengan nama petugas yang sama.`;

/* -------------------------------------------------------------- ringkasan */

/** Ringkasan satu isian untuk daftar isian per pasien (form berulang). */
export function ringkasRm50(d: Partial<Rm50Data> | null | undefined): {
  judul: string;
  lencana: { label: string; nada: "success" | "warning" | "danger" | "neutral" };
} {
  const kantong = Array.isArray(d?.kantong) ? (d.kantong as Partial<KantongRm50>[]) : [];
  const tgl = pisahWaktu(typeof d?.waktu === "string" ? d.waktu : "").tanggal;
  const jenis = [...new Set(kantong.map((k) => (typeof k?.jenis === "string" ? k.jenis.trim() : "")).filter(Boolean))].slice(0, 3);
  const judul = [`Transfusi${tgl ? ` ${tgl}` : ""}`, kantong.length ? `${kantong.length} kantong${jenis.length ? ` (${jenis.join(", ")})` : ""}` : ""]
    .filter(Boolean)
    .join(" · ");
  if (kantong.some((k) => typeof k?.reaksi === "string" && adaReaksi(k.reaksi))) return { judul, lencana: { label: "Ada reaksi", nada: "danger" } };
  if (kantong.length === 0) return { judul, lencana: { label: "Belum ada kantong", nada: "neutral" } };
  if (kantong.every((k) => typeof k?.reaksi === "string" && !kosong(k.reaksi))) return { judul, lencana: { label: "Tanpa reaksi", nada: "success" } };
  return { judul, lencana: { label: `${kantong.length} kantong`, nada: "neutral" } };
}

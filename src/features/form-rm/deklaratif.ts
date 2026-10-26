import { z } from "zod";
import type { BagianSimrs } from "./asal";
import type { KategoriForm } from "./kategori";
import type { CakupanForm, DefinisiForm, JenisKunjungan, Kertas, KodeForm, SasaranPasien } from "./registry";
import { ttdSchema } from "./skema";
import type { JenisTtdSaya } from "./ttd-saya";

/**
 * MESIN FORM DEKLARATIF (PRD §8.2) — murni & aman untuk klien. Form
 * deklaratif hanya berupa struktur bagian & kolom; skema simpan (strict), isian
 * kosong, slot tanda tangan, syarat FINAL, dan skor terhitung diturunkan dari
 * struktur itu. Renderer form & dokumen cetak generik membaca struktur yang sama
 * → menambah form = menambah satu berkas definisi di `forms/`.
 */

export type Opsi = { readonly nilai: string; readonly label: string; readonly skor?: number };
export type NadaSkor = "rendah" | "sedang" | "tinggi";
/** Pita kategori skor: berlaku untuk skor ≥ `min` (urut naik). */
export type KategoriSkor = { readonly min: number; readonly label: string; readonly nada: NadaSkor };

type Dasar = {
  /** Nama kunci di data isian (huruf + angka, unik dalam lingkupnya). */
  readonly id: string;
  readonly label: string;
  readonly keterangan?: string;
  /** Wajib terisi sebelum FINAL. */
  readonly wajib?: boolean;
  /** Lebar di grid bagian (jumlah kolom grid yang ditempati). */
  readonly lebar?: 1 | 2 | 3;
};

/** Kolom yang nilainya disimpan. */
export type KolomIsian =
  | (Dasar & { readonly jenis: "teks"; readonly maks?: number; readonly baris?: number; readonly placeholder?: string })
  | (Dasar & { readonly jenis: "angka"; readonly min?: number; readonly maks?: number; readonly satuan?: string })
  | (Dasar & { readonly jenis: "tanggal" })
  | (Dasar & { readonly jenis: "tanggalJam" })
  | (Dasar & { readonly jenis: "pilihan"; readonly opsi: readonly Opsi[] })
  | (Dasar & { readonly jenis: "pilihanGanda"; readonly opsi: readonly Opsi[] })
  | (Dasar & { readonly jenis: "centang" })
  | (Dasar & { readonly jenis: "ttd"; readonly petugas?: TtdPetugasDeklaratif });

/**
 * TTD/paraf PETUGAS RS: tawarkan "tanda tangan saya" milik pengguna login.
 * `kolomNama` = id kolom teks nama penanda tangan di lingkup yang sama (diisi
 * nama pengguna saat TTD tersimpan dipakai, atau saat menandatangani bila
 * `isiNamaOtomatis` & nama masih kosong).
 */
export type TtdPetugasDeklaratif = {
  readonly jenis?: JenisTtdSaya;
  readonly kolomNama?: string;
  readonly isiNamaOtomatis?: boolean;
};

/** Skor terhitung — TIDAK disimpan; dihitung dari kolom pilihan berskor di lingkup yang sama. */
export type KolomSkor = Omit<Dasar, "wajib"> & {
  readonly jenis: "skor";
  readonly dari: readonly string[];
  readonly kategori: readonly KategoriSkor[];
};

/** Teks keterangan tetap (tidak disimpan). */
export type KolomInfo = { readonly jenis: "info"; readonly id: string; readonly teks: string };

export type KolomBaris = KolomIsian | KolomSkor;

/** Tabel berulang: setiap baris berisi kolom yang sama (mis. pengkajian ulang per waktu). */
export type KolomTabel = Omit<Dasar, "wajib" | "lebar"> & {
  readonly jenis: "tabel";
  readonly kolom: readonly KolomBaris[];
  /** Sebutan satu baris, mis. "Pengkajian". */
  readonly namaBaris: string;
  readonly maksBaris: number;
  /** Baris tetap di awal (tak bisa dihapus), mis. pengkajian awal. */
  readonly barisAwal?: number;
  /** Jumlah baris minimal sebelum FINAL. */
  readonly minBarisFinal?: number;
  /** Cetak: `baris` = satu baris per entri; `lajur` = entri sebagai kolom (gaya lembar pengkajian). */
  readonly cetak?: "baris" | "lajur";
};

export type KolomDeklaratif = KolomIsian | KolomSkor | KolomInfo | KolomTabel;

export type BagianDeklaratif = {
  readonly id: string;
  readonly judul: string;
  readonly keterangan?: string;
  /** Jumlah kolom grid di layar lebar. */
  readonly grid?: 1 | 2 | 3;
  readonly kolom: readonly KolomDeklaratif[];
};

export type StrukturDeklaratif = { readonly bagian: readonly BagianDeklaratif[] };

export type DataDeklaratif = Record<string, unknown>;
export type BarisDeklaratif = Record<string, unknown>;

/* -------------------------------------------------------------- validasi */

const ID_RE = /^[a-z][A-Za-z0-9]{0,39}$/;
const DICADANGKAN = new Set(["constructor", "prototype", "toString", "valueOf", "hasOwnProperty"]);

const disimpan = (k: KolomDeklaratif): k is KolomIsian | KolomTabel => k.jenis !== "skor" && k.jenis !== "info";

/** Kolom tersimpan tingkat atas (urut tampil). */
export function kolomAtas(s: StrukturDeklaratif): (KolomIsian | KolomTabel)[] {
  return s.bagian.flatMap((b) => b.kolom.filter(disimpan));
}

/**
 * Struktur harus sah sejak modul dimuat (gagal cepat, juga diuji unit): id
 * unik & aman sebagai path, opsi unik, skor hanya dari pilihan berskor di
 * lingkupnya, pita kategori naik, batas baris tabel masuk akal.
 */
export function validasiStruktur(s: StrukturDeklaratif): void {
  const salah = (m: string): never => {
    throw new Error(`Struktur form deklaratif tidak sah: ${m}`);
  };
  const cekLingkup = (kolom: readonly KolomDeklaratif[], lingkup: string) => {
    const ids = new Set<string>();
    for (const k of kolom) {
      if (!ID_RE.test(k.id) || DICADANGKAN.has(k.id)) salah(`id "${k.id}" (${lingkup})`);
      if (ids.has(k.id)) salah(`id ganda "${k.id}" (${lingkup})`);
      ids.add(k.id);
      if (k.jenis === "pilihan" || k.jenis === "pilihanGanda") {
        if (k.opsi.length === 0) salah(`opsi kosong "${k.id}"`);
        const nilai = k.opsi.map((o) => o.nilai);
        if (new Set(nilai).size !== nilai.length || nilai.some((n) => n === "" || n.length > 60)) salah(`opsi "${k.id}"`);
      }
      if (k.jenis === "tabel") {
        if (lingkup !== "form") salah(`tabel bersarang "${k.id}"`);
        if (k.maksBaris < 1 || k.maksBaris > 50) salah(`maksBaris "${k.id}"`);
        const awal = k.barisAwal ?? 0;
        if (awal > k.maksBaris || (k.minBarisFinal ?? 0) > k.maksBaris) salah(`batas baris "${k.id}"`);
        if (k.kolom.some((x) => (x as { jenis: string }).jenis === "tabel" || (x as { jenis: string }).jenis === "info")) salah(`kolom tabel "${k.id}"`);
        cekLingkup(k.kolom, `tabel ${k.id}`);
      }
    }
    for (const k of kolom) {
      if (k.jenis !== "skor") continue;
      for (const d of k.dari) {
        const sumber = kolom.find((x) => x.id === d);
        if (!sumber || (sumber.jenis !== "pilihan" && sumber.jenis !== "pilihanGanda") || sumber.opsi.some((o) => typeof o.skor !== "number")) {
          salah(`skor "${k.id}" dari "${d}"`);
        }
      }
      const min = k.kategori.map((x) => x.min);
      if (min.length === 0 || min.some((m, i) => i > 0 && m <= min[i - 1])) salah(`kategori skor "${k.id}"`);
    }
  };
  cekLingkup(
    s.bagian.flatMap((b) => b.kolom),
    "form",
  );
  if (new Set(s.bagian.map((b) => b.id)).size !== s.bagian.length) salah("id bagian ganda");
}

/* ----------------------------------------------------------------- skema */

const RE_TANGGAL = /^\d{4}-\d{2}-\d{2}$/;
const RE_TANGGAL_JAM = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;
const RE_ANGKA = /^-?\d{1,7}([.,]\d{1,3})?$/;

export const angkaDari = (v: string): number => Number(v.replace(",", "."));

function skemaKolom(k: KolomIsian): z.ZodType {
  switch (k.jenis) {
    case "teks":
      return z.string().max(k.maks ?? 300).default("");
    case "angka":
      return z
        .string()
        .max(12)
        .refine(
          (v) => v === "" || (RE_ANGKA.test(v) && angkaDari(v) >= (k.min ?? -Infinity) && angkaDari(v) <= (k.maks ?? Infinity)),
          `${k.label}: angka tidak valid`,
        )
        .default("");
    case "tanggal":
      return z.string().refine((v) => v === "" || RE_TANGGAL.test(v), `${k.label}: tanggal tidak valid`).default("");
    case "tanggalJam":
      return z.string().refine((v) => v === "" || RE_TANGGAL_JAM.test(v), `${k.label}: tanggal & jam tidak valid`).default("");
    case "pilihan":
      return z.enum(["", ...k.opsi.map((o) => o.nilai)] as [string, ...string[]]).default("");
    case "pilihanGanda":
      return z
        .array(z.enum(k.opsi.map((o) => o.nilai) as [string, ...string[]]))
        .max(k.opsi.length)
        .refine((a) => new Set(a).size === a.length, `${k.label}: pilihan ganda`)
        .default([]);
    case "centang":
      return z.boolean().default(false);
    case "ttd":
      return ttdSchema;
  }
}

function skemaLingkup(kolom: readonly KolomDeklaratif[]): z.ZodType {
  const bentuk: Record<string, z.ZodType> = {};
  for (const k of kolom) {
    if (k.jenis === "skor" || k.jenis === "info") continue;
    bentuk[k.id] =
      k.jenis === "tabel"
        ? z
            .array(skemaLingkup(k.kolom))
            .min(k.barisAwal ?? 0)
            .max(k.maksBaris)
        : skemaKolom(k);
  }
  return z.strictObject(bentuk);
}

/** Skema simpan strict seluruh form (kunci asing di tingkat mana pun → ditolak). */
export const skemaDeklaratif = (s: StrukturDeklaratif) => skemaLingkup(s.bagian.flatMap((b) => b.kolom)) as z.ZodType<DataDeklaratif>;

/* ---------------------------------------------------------------- kosong */

function nilaiKosong(k: KolomIsian): unknown {
  return k.jenis === "pilihanGanda" ? [] : k.jenis === "centang" ? false : "";
}

export function barisKosong(t: KolomTabel): BarisDeklaratif {
  return Object.fromEntries(t.kolom.filter(disimpan).map((k) => [k.id, nilaiKosong(k as KolomIsian)]));
}

export function kosongDeklaratif(s: StrukturDeklaratif): DataDeklaratif {
  return Object.fromEntries(
    kolomAtas(s).map((k) => [k.id, k.jenis === "tabel" ? Array.from({ length: k.barisAwal ?? 0 }, () => barisKosong(k)) : nilaiKosong(k)]),
  );
}

/** Data tersimpan → bentuk lengkap untuk UI: kunci yang belum ada dilengkapi nilai kosong, termasuk per baris tabel. */
export function siapkanDeklaratif(s: StrukturDeklaratif, data: unknown): DataDeklaratif {
  const d = data && typeof data === "object" ? (data as DataDeklaratif) : {};
  const hasil: DataDeklaratif = { ...kosongDeklaratif(s), ...d };
  for (const k of kolomAtas(s)) {
    if (k.jenis !== "tabel" || !Array.isArray(d[k.id])) continue;
    hasil[k.id] = (d[k.id] as BarisDeklaratif[]).map((r) => ({ ...barisKosong(k), ...r }));
  }
  return hasil;
}

/* ------------------------------------------------------------------- TTD */

/** Kunjungi setiap slot TTD (path stabil: `id` atau `tabel.i.kolom`), nilai kembalian menggantikan isinya. */
export function petaTtdDeklaratif(s: StrukturDeklaratif, data: DataDeklaratif, f: (nilai: string, slot: string) => string): DataDeklaratif {
  const hasil: DataDeklaratif = { ...data };
  for (const k of kolomAtas(s)) {
    if (k.jenis === "ttd") hasil[k.id] = f(String(data[k.id] ?? ""), k.id);
    if (k.jenis === "tabel" && k.kolom.some((x) => x.jenis === "ttd")) {
      const rows = Array.isArray(data[k.id]) ? (data[k.id] as BarisDeklaratif[]) : [];
      hasil[k.id] = rows.map((r, i) => {
        const b = { ...r };
        for (const x of k.kolom) if (x.jenis === "ttd") b[x.id] = f(String(r[x.id] ?? ""), `${k.id}.${i}.${x.id}`);
        return b;
      });
    }
  }
  return hasil;
}

/* ----------------------------------------------------------- skor & syarat */

export type HasilSkor = { nilai: number; lengkap: boolean; kategori: KategoriSkor | null };

/** Skor = jumlah skor opsi terpilih pada kolom `dari` dalam satu lingkup (form atau satu baris tabel). */
export function hitungSkor(k: KolomSkor, kolomLingkup: readonly KolomDeklaratif[], nilai: Record<string, unknown>): HasilSkor {
  let total = 0;
  let lengkap = true;
  for (const id of k.dari) {
    const sumber = kolomLingkup.find((x) => x.id === id);
    if (!sumber || (sumber.jenis !== "pilihan" && sumber.jenis !== "pilihanGanda")) continue;
    const v = nilai[id];
    const dipilih = sumber.jenis === "pilihan" ? (typeof v === "string" && v ? [v] : []) : Array.isArray(v) ? v : [];
    if (sumber.jenis === "pilihan" && dipilih.length === 0) lengkap = false;
    for (const p of dipilih) total += sumber.opsi.find((o) => o.nilai === p)?.skor ?? 0;
  }
  const kategori = [...k.kategori].reverse().find((x) => total >= x.min) ?? null;
  return { nilai: total, lengkap, kategori };
}

/**
 * Skor yang mewakili isian (untuk ringkasan, mis. bilah aksi): skor tingkat
 * atas pertama, atau skor baris TERAKHIR tabel pertama yang punya skor.
 */
export function skorTerakhir(s: StrukturDeklaratif, data: DataDeklaratif): HasilSkor | null {
  const semua = s.bagian.flatMap((b) => b.kolom);
  for (const k of semua) {
    if (k.jenis === "skor") return hitungSkor(k, semua, data);
    if (k.jenis === "tabel") {
      const ks = k.kolom.find((x): x is KolomSkor => x.jenis === "skor");
      const rows = Array.isArray(data[k.id]) ? (data[k.id] as BarisDeklaratif[]) : [];
      if (ks && rows.length > 0) return hitungSkor(ks, k.kolom, rows[rows.length - 1]);
    }
  }
  return null;
}

/** Label opsi terpilih ("" bila tak ada). */
export const labelOpsi = (opsi: readonly Opsi[], nilai: unknown): string => opsi.find((o) => o.nilai === nilai)?.label ?? "";

const kosongNilai = (k: KolomIsian, v: unknown) =>
  k.jenis === "centang" ? v !== true : k.jenis === "pilihanGanda" ? !Array.isArray(v) || v.length === 0 : typeof v !== "string" || v.trim() === "";

/** Kekurangan yang menghalangi FINAL (kosong = boleh difinalkan). */
export function syaratFinalDeklaratif(s: StrukturDeklaratif, data: DataDeklaratif): string[] {
  const kurang: string[] = [];
  for (const k of kolomAtas(s)) {
    if (k.jenis !== "tabel") {
      if (k.wajib && kosongNilai(k, data[k.id])) kurang.push(k.label);
      continue;
    }
    const rows = Array.isArray(data[k.id]) ? (data[k.id] as BarisDeklaratif[]) : [];
    if (rows.length < (k.minBarisFinal ?? 0)) kurang.push(`${k.label}: minimal ${k.minBarisFinal} ${k.namaBaris.toLowerCase()}`);
    rows.forEach((r, i) => {
      for (const x of k.kolom) {
        if (x.jenis !== "skor" && x.wajib && kosongNilai(x, r[x.id])) kurang.push(`${k.namaBaris} ${i + 1}: ${x.label}`);
      }
    });
  }
  return kurang;
}

/* --------------------------------------------------------------- definisi */

/** Metadata form deklaratif; skema, isian kosong, TTD & syarat FINAL diturunkan dari `struktur`. */
export type MetaDeklaratif = {
  readonly kode: KodeForm;
  readonly versi: number;
  readonly judul: string;
  readonly kategori: KategoriForm;
  readonly cakupan: CakupanForm;
  readonly berulang: boolean;
  readonly sasaran: SasaranPasien;
  readonly wajibUntuk: readonly JenisKunjungan[];
  readonly kertas: Kertas;
  readonly simrs: readonly BagianSimrs[];
  readonly struktur: StrukturDeklaratif;
};

export function definisiDeklaratif(m: MetaDeklaratif): DefinisiForm<DataDeklaratif> {
  validasiStruktur(m.struktur);
  const skema = skemaDeklaratif(m.struktur);
  return {
    ...m,
    skema,
    kosong: () => skema.parse(kosongDeklaratif(m.struktur)),
    petaTtd: (d, f) => petaTtdDeklaratif(m.struktur, d, f),
    syaratFinal: (d) => syaratFinalDeklaratif(m.struktur, d),
  };
}

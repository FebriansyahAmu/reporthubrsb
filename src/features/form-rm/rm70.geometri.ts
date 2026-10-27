import { GARIS_AKHIR, KOLOM_GRAFIK, SUMBU, WASPADA, JARAK_BERTINDAK } from "./rm70.constants";

/**
 * GEOMETRI GRAFIK PARTOGRAF RM.70 — satuan mm, sama dengan kertas F4 (area
 * cetak 199 mm). Satu sumber untuk gambar SVG (layar & cetak) dan pemetaan
 * klik → lajur, waktu, nilai. Murni & aman untuk klien.
 */

export const LEBAR = 199;
/** Kolom label kiri, lebar kolom setengah jam, awal & akhir kisi. */
export const X0 = 29;
export const KOL = 5.2;
export const XN = X0 + KOLOM_GRAFIK * KOL;

export type IdPita =
  | "djj"
  | "ketuban"
  | "penyusupan"
  | "serviks"
  | "angkaJam"
  | "waktu"
  | "kontraksi"
  | "oksitosin"
  | "tetes"
  | "obat"
  | "ibu"
  | "suhu"
  | "protein"
  | "aseton"
  | "volume"
  | "makan"
  | "minum"
  | "paraf";

export type Pita = { id: IdPita; atas: number; tinggi: number; baris: number; bawah: number };

/** Urutan pita dari atas: [id, jumlah baris, tinggi baris] atau jarak kosong (mm). */
const SUSUNAN: readonly (readonly [IdPita, number, number] | number)[] = [
  3,
  ["djj", 12, 3.85],
  1.5,
  ["ketuban", 1, 3.9],
  ["penyusupan", 1, 3.9],
  5,
  ["serviks", 10, 4.5],
  ["angkaJam", 1, 3.2],
  ["waktu", 1, 5.4],
  4,
  ["kontraksi", 5, 4],
  3,
  ["oksitosin", 1, 3.9],
  ["tetes", 1, 3.9],
  3,
  ["obat", 1, 7.5],
  3.2,
  ["ibu", 12, 3.9],
  2.5,
  ["suhu", 1, 4.6],
  2.5,
  ["protein", 1, 4.2],
  ["aseton", 1, 4.2],
  ["volume", 1, 4.2],
  2.5,
  ["makan", 1, 4.2],
  ["minum", 1, 4.2],
  2.5,
  ["paraf", 1, 9],
  1,
];

function susun(): { pita: Record<IdPita, Pita>; tinggi: number } {
  const pita = {} as Record<IdPita, Pita>;
  let y = 0;
  for (const s of SUSUNAN) {
    if (typeof s === "number") {
      y += s;
      continue;
    }
    const [id, baris, t] = s;
    pita[id] = { id, atas: y, tinggi: baris * t, baris, bawah: y + baris * t };
    y += baris * t;
  }
  return { pita, tinggi: Math.round(y * 10) / 10 };
}

const HASIL = susun();
export const PITA = HASIL.pita;
export const TINGGI = HASIL.tinggi;
export const DAFTAR_PITA = Object.values(PITA);

/** Kelompok label kanan kertas (panah vertikal). */
export const KELOMPOK_KANAN = [
  { label: "Kondisi Janin", atas: PITA.djj.atas, bawah: PITA.penyusupan.bawah },
  { label: "Kemajuan persalinan", atas: PITA.serviks.atas, bawah: PITA.kontraksi.bawah },
  { label: "Kondisi Ibu", atas: PITA.oksitosin.atas, bawah: PITA.minum.bawah },
] as const;

export const xGaris = (k: number) => X0 + k * KOL;
export const xSel = (c: number) => X0 + c * KOL;
export const xTengahSel = (c: number) => X0 + (c + 0.5) * KOL;

/** Pita bergrafik nilai → sumbunya. */
export const SUMBU_PITA = {
  djj: SUMBU.djj,
  serviks: SUMBU.pembukaan,
  ibu: SUMBU.nadi,
} as const;

const jepit = (n: number, a: number, b: number) => Math.min(b, Math.max(a, n));

/** Nilai → y pada pita bergrafik; nilai di luar sumbu dijepit ke tepi. */
export function yNilai(id: keyof typeof SUMBU_PITA, v: number): number {
  const p = PITA[id];
  const s = SUMBU_PITA[id];
  return p.atas + ((s.max - jepit(v, s.min, s.max)) / (s.max - s.min)) * p.tinggi;
}

/** Penurunan kepala (per lima, 0–5) memakai baris 0–5 grafik serviks. */
export const yPenurunan = (v: number) => yNilai("serviks", jepit(v, 0, 5));

/** y → nilai pada pita bergrafik (tanpa pembulatan). */
export function nilaiDariY(id: keyof typeof SUMBU_PITA, y: number): number {
  const p = PITA[id];
  const s = SUMBU_PITA[id];
  return s.max - ((y - p.atas) / p.tinggi) * (s.max - s.min);
}

/** Pita di bawah posisi y (dengan toleransi setengah baris di tepi pita bergrafik). */
export function pitaDi(y: number): IdPita | null {
  for (const p of DAFTAR_PITA) {
    const tol = p.id in SUMBU_PITA ? p.tinggi / p.baris / 2 : 0;
    if (y >= p.atas - tol && y <= p.bawah + tol) return p.id;
  }
  return null;
}

/** x → garis waktu terdekat (0..30) & kotak (0..29); null di luar kisi. */
export function posisiX(x: number): { k: number; c: number } | null {
  if (x < X0 - KOL / 2 || x > XN + KOL / 2) return null;
  const rel = (x - X0) / KOL;
  return { k: jepit(Math.round(rel), 0, GARIS_AKHIR), c: jepit(Math.floor(rel), 0, KOLOM_GRAFIK - 1) };
}

/** Ujung garis waspada & bertindak pada grafik serviks. */
export const GARIS_WASPADA = {
  x1: xGaris(WASPADA.k0),
  y1: yNilai("serviks", WASPADA.v0),
  x2: xGaris(WASPADA.k1),
  y2: yNilai("serviks", WASPADA.v1),
};
export const GARIS_BERTINDAK = {
  x1: xGaris(WASPADA.k0 + JARAK_BERTINDAK),
  y1: yNilai("serviks", WASPADA.v0),
  x2: xGaris(WASPADA.k1 + JARAK_BERTINDAK),
  y2: yNilai("serviks", WASPADA.v1),
};
/** Sudut garis waspada (derajat, SVG: negatif = naik ke kanan). */
export const SUDUT_WASPADA =
  (Math.atan2(GARIS_WASPADA.y2 - GARIS_WASPADA.y1, GARIS_WASPADA.x2 - GARIS_WASPADA.x1) * 180) / Math.PI;

/** Perkiraan lebar teks Arial (mm) untuk menyesuaikan tulisan dengan kotak. */
export const lebarTeks = (teks: string, ukuran: number) => teks.length * ukuran * 0.53;

/**
 * ASAL KOLOM ISIAN (PRD §6.4) — murni & aman untuk klien. Isian menyimpan, per
 * path kolom yang terisi dari SIMRS, sumber dan NILAI SIMRS-nya saat diisi:
 * kolom bertanda "SIMRS" selama nilainya masih sama dan "diubah" begitu petugas
 * menggantinya. Nilai disimpan (bukan hash) agar perbandingan cukup di klien.
 */

/** Sumber isi otomatis (SIMGOS, read-only). Satu sumber = satu query di server. */
export const SUMBER_SIMRS = [
  "identitas",
  "sosial",
  "keluarga",
  "episode",
  "diagnosa",
  "pulang",
  "triase",
  "edukasi",
] as const;
export type SumberId = (typeof SUMBER_SIMRS)[number];

export const LABEL_SUMBER: Record<SumberId, string> = {
  identitas: "Identitas & pendaftaran",
  sosial: "Data sosial pasien",
  keluarga: "Keluarga pasien",
  episode: "Episode perawatan",
  diagnosa: "Diagnosa",
  pulang: "Pasien pulang",
  triase: "Triase IGD",
  edukasi: "Edukasi pasien & keluarga",
};

export type AsalKolom = {
  /** null = isian sebelum pustaka isi otomatis (sumber & nilai tak tercatat). */
  sumber: SumberId | null;
  /** Nilai dari SIMRS saat kolom diisi; tak ada pada isian lama. */
  nilai?: unknown;
  /** NOPEN episode IGD asal bila nilai diambil dari sana, bukan dari episode isian. */
  nopen?: string;
};

/** path kolom ("alamat", "persiapan.bahasa") → asal. */
export type AsalIsian = Record<string, AsalKolom>;

/** Satu kolom yang dapat diisi dari SIMRS (deklarasi di registri form). */
export type KolomSimrs = { readonly path: string; readonly label: string; readonly sumber: SumberId };
/** Kelompok kolom untuk "Muat ulang dari SIMRS" (PRD §6.4 butir 3). */
export type BagianSimrs = { readonly id: string; readonly judul: string; readonly kolom: readonly KolomSimrs[] };

/* --------------------------------------------------------------------- path */

/** Segmen nama kolom atau indeks larik; prototipe tak pernah bisa dicapai. */
export const PATH_RE = /^[A-Za-z][A-Za-z0-9]*(\.(\d{1,2}|[A-Za-z][A-Za-z0-9]*))*$/;
const TERLARANG = new Set(["__proto__", "prototype", "constructor"]);

function segmen(path: string): string[] | null {
  if (!PATH_RE.test(path)) return null;
  const s = path.split(".");
  return s.some((x) => TERLARANG.has(x)) ? null : s;
}

/** Nilai di `path`; undefined bila path tak sah / tak ada. Hanya properti milik sendiri. */
export function ambilPath(akar: unknown, path: string): unknown {
  const s = segmen(path);
  if (!s) return undefined;
  let o: unknown = akar;
  for (const k of s) {
    if (o === null || typeof o !== "object" || !Object.hasOwn(o, k)) return undefined;
    o = (o as Record<string, unknown>)[k];
  }
  return o;
}

/**
 * Ganti nilai kolom yang SUDAH ADA di `akar` (mutasi). Tidak pernah membuat
 * kunci baru → isian tetap sesuai bentuk skema. false bila path tak ada.
 */
export function pasangPath(akar: object, path: string, nilai: unknown): boolean {
  const s = segmen(path);
  if (!s) return false;
  let o: unknown = akar;
  for (const k of s.slice(0, -1)) {
    if (o === null || typeof o !== "object" || !Object.hasOwn(o, k)) return false;
    o = (o as Record<string, unknown>)[k];
  }
  const akhir = s[s.length - 1];
  if (o === null || typeof o !== "object" || !Object.hasOwn(o, akhir)) return false;
  (o as Record<string, unknown>)[akhir] = nilai;
  return true;
}

/* -------------------------------------------------------------------- nilai */

/** Kolom dianggap terisi: teks tak kosong, larik tak kosong, `true`, atau angka. */
export function terisi(v: unknown): boolean {
  if (typeof v === "string") return v.trim() !== "";
  if (Array.isArray(v)) return v.length > 0;
  if (typeof v === "number") return Number.isFinite(v);
  return v === true;
}

/** Kesamaan struktural nilai JSON (urutan larik berpengaruh, urutan kunci objek tidak). */
export function samaNilai(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (Array.isArray(a) || Array.isArray(b)) {
    return Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((x, i) => samaNilai(x, b[i]));
  }
  if (a && b && typeof a === "object" && typeof b === "object") {
    const ka = Object.keys(a);
    const kb = Object.keys(b);
    return (
      ka.length === kb.length &&
      ka.every((k) => Object.hasOwn(b, k) && samaNilai((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]))
    );
  }
  return false;
}

export type StatusAsal = "simrs" | "diubah";

/** Tanda kolom: "simrs" selama nilainya masih nilai SIMRS, "diubah" setelah petugas menggantinya. */
export function statusAsal(asal: AsalIsian, data: unknown, path: string): StatusAsal | null {
  const a = Object.hasOwn(asal, path) ? asal[path] : undefined;
  if (!a) return null;
  if (!("nilai" in a)) return "simrs"; // isian lama: nilai awal tak diketahui
  return samaNilai(ambilPath(data, path), a.nilai) ? "simrs" : "diubah";
}

/** Gabungan beberapa kolom satu kontrol (mis. sistolik/diastolik): satu diubah → "diubah". */
export function statusAsalGabung(asal: AsalIsian, data: unknown, paths: readonly string[]): StatusAsal | null {
  const st = paths.map((p) => statusAsal(asal, data, p)).filter((s): s is StatusAsal => s !== null);
  if (st.length === 0) return null;
  return st.includes("diubah") ? "diubah" : "simrs";
}

const SUMBER_SET = new Set<string>(SUMBER_SIMRS);
const NOPEN_RE = /^\d{6,20}$/;

/**
 * Kolom `asal` tersimpan → bentuk baku. Isian lama menyimpan daftar path saja
 * (tanpa sumber/nilai); entri yang tak dikenali dibuang.
 */
export function normalkanAsal(raw: unknown): AsalIsian {
  // Objek biasa (props Server→Client Component menolak null-prototype); kunci
  // berbahaya sudah tertolak oleh `segmen`.
  const hasil: AsalIsian = {};
  if (Array.isArray(raw)) {
    for (const p of raw) if (typeof p === "string" && segmen(p)) hasil[p] = { sumber: null };
    return hasil;
  }
  if (!raw || typeof raw !== "object") return hasil;
  for (const [p, v] of Object.entries(raw)) {
    if (!segmen(p) || !v || typeof v !== "object") continue;
    const e = v as Record<string, unknown>;
    const kolom: AsalKolom = { sumber: typeof e.sumber === "string" && SUMBER_SET.has(e.sumber) ? (e.sumber as SumberId) : null };
    if ("nilai" in e) kolom.nilai = e.nilai;
    if (typeof e.nopen === "string" && NOPEN_RE.test(e.nopen)) kolom.nopen = e.nopen;
    hasil[p] = kolom;
  }
  return hasil;
}

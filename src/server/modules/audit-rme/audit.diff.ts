/**
 * Perbandingan snapshot SEBELUM → SESUDAH (audit CRUD SIMGOS).
 *
 * Fungsi murni (tanpa I/O) — mudah diuji. Nilai bisa berupa string HTML klinis,
 * skalar, atau array/objek bersarang. Teks HTML dibersihkan jadi teks polos agar
 * fokus ke "apa yang berubah", bukan markup.
 */

export type DiffStatus = "added" | "removed" | "changed" | "unchanged";
export type DiffField = {
  key: string;
  label: string;
  before: string | null;
  after: string | null;
  status: DiffStatus;
};

const MAX_LEN = 4000;

/** Ubah nilai apa pun → teks polos ringkas (buang tag HTML, decode entitas umum). */
export function sanitizeValue(v: unknown): string | null {
  if (v == null) return null;
  let s: string;
  if (typeof v === "string") {
    s = v
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/gi, " ")
      .replace(/&amp;/gi, "&")
      .replace(/&lt;/gi, "<")
      .replace(/&gt;/gi, ">")
      .replace(/&quot;/gi, '"')
      .replace(/&#0?39;/gi, "'")
      .replace(/&apos;/gi, "'")
      .replace(/\s+/g, " ")
      .trim();
  } else {
    try {
      s = JSON.stringify(v);
    } catch {
      s = String(v);
    }
  }
  if (s.length > MAX_LEN) s = `${s.slice(0, MAX_LEN)}…`;
  return s;
}

/** "SELESAI_RAWAT_BERSAMA" → "Selesai Rawat Bersama". */
export function humanizeKey(k: string): string {
  return k
    .replace(/[_-]+/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

type Parsed = { obj: Record<string, unknown> | null; raw: string | null };
function parseSnapshot(raw: string | null): Parsed {
  if (raw == null || raw.trim() === "") return { obj: {}, raw: null };
  try {
    const v = JSON.parse(raw);
    if (v && typeof v === "object" && !Array.isArray(v)) return { obj: v as Record<string, unknown>, raw: null };
    return { obj: null, raw };
  } catch {
    return { obj: null, raw };
  }
}

function eq(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  try {
    return JSON.stringify(a) === JSON.stringify(b);
  } catch {
    return false;
  }
}

/**
 * True bila snapshot SESUDAH menyetel `STATUS` LEVEL ATAS → 0 (pembatalan/hapus
 * lunak record itu sendiri). Sengaja tidak memakai regex teks: snapshot tindakan
 * memuat `STATUS` bersarang milik petugas yang bukan status record.
 */
export function setsStatusNonaktif(sesudah: string | null): boolean {
  const { obj } = parseSnapshot(sesudah);
  if (!obj) return false;
  const key = Object.keys(obj).find((k) => k.toUpperCase() === "STATUS");
  if (!key) return false;
  const v = obj[key];
  return v === 0 || v === "0" || v === false;
}

/** Diff field-per-field (union kunci: SESUDAH dulu, lalu kunci khusus SEBELUM). */
export function computeDiff(sebelum: string | null, sesudah: string | null): DiffField[] {
  const a = parseSnapshot(sebelum);
  const b = parseSnapshot(sesudah);

  // Salah satu bukan objek → tampilkan sebagai satu field mentah.
  if (!a.obj || !b.obj) {
    const before = sanitizeValue(a.obj ? null : a.raw);
    const after = sanitizeValue(b.obj ? null : b.raw);
    if (before == null && after == null) return [];
    let status: DiffStatus = "changed";
    if (before == null) status = "added";
    else if (after == null) status = "removed";
    else if (before === after) status = "unchanged";
    return [{ key: "(data)", label: "Data", before, after, status }];
  }

  const ao = a.obj;
  const bo = b.obj;
  const keys: string[] = [];
  const seen = new Set<string>();
  for (const k of Object.keys(bo)) {
    keys.push(k);
    seen.add(k);
  }
  for (const k of Object.keys(ao)) if (!seen.has(k)) keys.push(k);

  return keys.map((k): DiffField => {
    const hasB = Object.prototype.hasOwnProperty.call(ao, k);
    const hasA = Object.prototype.hasOwnProperty.call(bo, k);
    let status: DiffStatus;
    if (!hasB) status = "added";
    else if (!hasA) status = "removed";
    else status = eq(ao[k], bo[k]) ? "unchanged" : "changed";
    return {
      key: k,
      label: humanizeKey(k),
      before: hasB ? sanitizeValue(ao[k]) : null,
      after: hasA ? sanitizeValue(bo[k]) : null,
      status,
    };
  });
}

const STATUS_KEY = /^(status|aktif|is_?deleted|deleted|dibatalkan|batal|is_?active|active)$/i;
function isFalsy(v: string | null): boolean {
  if (v == null) return false;
  const s = v.trim().toLowerCase();
  return s === "0" || s === "false";
}

/** Heuristik soft-delete/pembatalan: field status/aktif berubah dari truthy → 0/false. */
export function detectSoftDelete(fields: DiffField[]): boolean {
  return fields.some(
    (f) => f.status === "changed" && STATUS_KEY.test(f.key) && isFalsy(f.after) && !isFalsy(f.before),
  );
}

/**
 * Konstanta Modul Audit Trail RME (read-only atas log SIMGOS).
 *
 * File ini BEBAS server-only (dipakai juga oleh view untuk label/tone). Jangan
 * impor modul Node-only / klien DB di sini.
 *
 * Sumber & keputusan lengkap: docs/PRD_Modul_Audit_Trail_RME.md
 */

export const AUDIT_MODULE_KEY = "audit-rme";

/* ------------------------------------------------------------- objek (scope) */

/** Kelompok sumber objek yang diaudit. */
export type AuditKelompok = "RME";

export type AuditObjek = {
  /** aplikasi.objek.ID (char 5) — kunci di logs.pengguna_akses_log.OBJEK */
  objek: string;
  /** Nama tabel nyata SIMGOS. */
  tabel: string;
  /** Label ramah untuk UI. */
  label: string;
  kelompok: AuditKelompok;
};

/**
 * Allow-list objek dalam scope (TERKUNCI Stage awal: 3 tabel medicalrecord).
 * Menambah objek = menambah satu entri di sini.
 */
export const AUDIT_OBJEKS: readonly AuditObjek[] = [
  { objek: "21002", tabel: "medicalrecord.cppt", label: "CPPT", kelompok: "RME" },
  { objek: "21003", tabel: "medicalrecord.diagnosa", label: "Diagnosa", kelompok: "RME" },
  { objek: "21032", tabel: "medicalrecord.tanda_vital", label: "Tanda Vital", kelompok: "RME" },
] as const;

export const AUDIT_OBJEK_IDS: readonly string[] = AUDIT_OBJEKS.map((o) => o.objek);
const OBJEK_BY_ID = new Map(AUDIT_OBJEKS.map((o) => [o.objek, o]));
export const getAuditObjek = (id: string): AuditObjek | undefined => OBJEK_BY_ID.get(id);

/* ------------------------------------------------------- jenis aktivitas/AKSI */

/** Kode AKSI mentah SIMGOS (enum). Hanya C & U yang terisi; R & D tak dicatat. */
export type Aksi = "C" | "R" | "U" | "D";

/** Jenis aktivitas yang ditampilkan (kebutuhan regulasi RME). */
export type JenisAktivitas =
  | "PENAMBAHAN"
  | "PERUBAHAN"
  | "PENGHAPUSAN"
  | "AKSES"
  | "LOGIN"
  | "LOGOUT";

/** Peta AKSI CRUD → jenis aktivitas (D tak pernah muncul; hapus = soft-delete via U). */
export const AKSI_JENIS: Record<Aksi, JenisAktivitas> = {
  C: "PENAMBAHAN",
  U: "PERUBAHAN",
  D: "PENGHAPUSAN",
  R: "AKSES",
};

export const JENIS_LABEL: Record<JenisAktivitas, string> = {
  PENAMBAHAN: "Penambahan",
  PERUBAHAN: "Perubahan",
  // Soft-delete SIMGOS (STATUS → 0) = batal/hapus — istilah Fase 2: "Pembatalan".
  PENGHAPUSAN: "Pembatalan",
  AKSES: "Akses Data",
  LOGIN: "Login",
  LOGOUT: "Logout",
};

/** Tone badge (token Cord) per jenis — tak mengandalkan warna saja (selalu + label). */
export type BadgeTone = "neutral" | "brand" | "success" | "warning" | "danger" | "accent";
export const JENIS_TONE: Record<JenisAktivitas, BadgeTone> = {
  PENAMBAHAN: "success",
  PERUBAHAN: "warning",
  PENGHAPUSAN: "danger",
  AKSES: "neutral",
  LOGIN: "brand",
  LOGOUT: "accent",
};

/** Sumber baris timeline: aktivitas RME (CRUD) atau event login. */
export type AuditSumber = "RME" | "LOGIN";

/* ----------------------------------------------------- helper ID kronologis */

/**
 * `logs.pengguna_akses_log.ID` = `YYMMDD` + 9 digit urut → **kronologis & ter-index**.
 * Filter tanggal WAJIB lewat prefix ID ini (kolom TANGGAL tidak ter-index).
 */
const p2 = (n: number) => String(n).padStart(2, "0");

/** `YYYY-MM-DD` → `YYMMDD` (2 digit tahun). */
export function yymmdd(dateIso: string): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(dateIso);
  if (!m) return null;
  return `${m[1].slice(2)}${m[2]}${m[3]}`;
}

/** Batas ID inklusif untuk rentang tanggal (untuk `ID BETWEEN lo AND hi`). */
export function idBounds(from?: string | null, to?: string | null): { lo?: string; hi?: string } {
  const out: { lo?: string; hi?: string } = {};
  if (from) {
    const y = yymmdd(from);
    if (y) out.lo = `${y}000000000`;
  }
  if (to) {
    const y = yymmdd(to);
    if (y) out.hi = `${y}999999999`;
  }
  return out;
}

/** Decode 6 digit awal ID (`YYMMDD`) → `YYYY-MM-DD` (untuk tampilan rentang). */
export function idToIsoDate(id: string | null | undefined): string | null {
  if (!id || id.length < 6) return null;
  return `20${id.slice(0, 2)}-${id.slice(2, 4)}-${id.slice(4, 6)}`;
}

/** Geser tanggal `YYYY-MM-DD` sebanyak `n` hari (kalender, bebas TZ). */
export function addDaysIso(iso: string, n: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return `${d.getUTCFullYear()}-${p2(d.getUTCMonth() + 1)}-${p2(d.getUTCDate())}`;
}

/** Saat ini sebagai jam dinding WITA `YYYY-MM-DDTHH:mm:ss` (sebanding dgn DATE_FORMAT SIMGOS). */
export function nowWitaIso(now: Date = new Date()): string {
  return new Date(now.getTime() + 8 * 3600 * 1000).toISOString().slice(0, 19);
}

/** WITA (UTC+8) `YYYY-MM-DD` hari ini — untuk default rentang / prefix ID. */
export function todayWitaIso(now: Date = new Date()): string {
  const w = new Date(now.getTime() + 8 * 3600 * 1000);
  return `${w.getUTCFullYear()}-${p2(w.getUTCMonth() + 1)}-${p2(w.getUTCDate())}`;
}

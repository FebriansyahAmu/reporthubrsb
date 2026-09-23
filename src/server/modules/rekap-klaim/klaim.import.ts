import "server-only";
import ExcelJS from "exceljs";
import { getAppDb } from "@/server/db/app.client";
import type { SessionUser } from "@/server/auth/session";
import { writeKlaimAudit } from "./klaim.audit";
import {
  klaimCreateSchema, potonganCreateSchema,
  JENIS_KLAIM, JENIS_KLAIM_LABEL,
  JENIS_LAYANAN, JENIS_LAYANAN_LABEL,
  KATEGORI_KLAIM, KATEGORI_KLAIM_LABEL,
  STATUS_KLAIM, STATUS_KLAIM_LABEL,
  POTONGAN_JENIS, POTONGAN_JENIS_LABEL,
  BULAN_LABEL,
  type JenisKlaim, type JenisLayanan, type KategoriKlaim, type StatusKlaim, type PotonganJenis,
} from "./klaim.schema";

/** Bentuk input klaim hasil resolusi (tanggal sebagai string YYYY-MM-DD). */
type ImportKlaimInput = {
  nomorKlaim?: string;
  jenisKlaim: JenisKlaim;
  jenisLayanan: JenisLayanan;
  kategori: KategoriKlaim;
  bulanPelayanan: number;
  tahunPelayanan: number;
  jumlah: number;
  jumlahDiajukan?: number;
  jumlahKasus?: number;
  tglMasukRekening?: string;
  status: StatusKlaim;
  refBa?: string;
  catatan?: string;
};

/**
 * Import/migrasi historis klaim (F, Sesi 8) — pendekatan TEMPLATE bersih (single
 * source of truth, PRD §4.1). User mengunduh template .xlsx (sheet "Klaim" +
 * "Potongan" + "Petunjuk"), mengisinya, lalu mengunggah. Import dua fase:
 * preview (dry-run: validasi per baris + total per tahun vs baseline PRD §7) dan
 * commit (menyimpan baris valid + audit "import"). Uang = rupiah penuh.
 */

/* --------------------------------------------------------------- baseline §7 */

/** Total INA-CBG's per tahun dari PRD §7 (baseline validasi migrasi). */
export const BASELINE_TAHUN: Record<number, number> = {
  2023: 908_268_800,
  2024: 2_199_179_900,
  2025: 2_526_131_100,
  2026: 2_415_129_000,
};
/** Total rujukan ambulans 2025–2026 (PRD §7, gabungan). */
export const BASELINE_RUJUKAN = 43_583_400;

/* --------------------------------------------------------------------- tipe */

export type ImportRowResult = {
  baris: number;
  ref: string | null;
  status: "valid" | "error";
  label: string;
  jumlah: number | null;
  tahun: number | null;
  catatan: string[];
};
export type PerTahunImport = { tahun: number; inaCbgs: number; rujukan: number; entri: number };
export type BaselineCheck = { tahun: number; impor: number; baseline: number | null; cocok: boolean | null; selisih: number | null };

export type ImportRingkasan = {
  baris: number; valid: number; error: number;
  potonganBaris: number; potonganValid: number; potonganError: number;
  totalInaCbgs: number; totalRujukan: number;
};
export type ImportPreview = {
  klaim: ImportRowResult[];
  potongan: ImportRowResult[];
  ringkasan: ImportRingkasan;
  perTahun: PerTahunImport[];
  baseline: BaselineCheck[];
};
export type ImportCommitSummary = {
  masuk: number; dilewati: number;
  potonganMasuk: number; potonganDilewati: number;
  perTahun: PerTahunImport[];
  baseline: BaselineCheck[];
};

/* ------------------------------------------------------------ util sel/parse */

const normHeader = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
const norm = (s: string | undefined) => (s ?? "").trim();

function cellText(v: ExcelJS.CellValue): string {
  if (v == null) return "";
  if (v instanceof Date) {
    const p = (n: number) => String(n).padStart(2, "0");
    return `${v.getUTCFullYear()}-${p(v.getUTCMonth() + 1)}-${p(v.getUTCDate())}`;
  }
  if (typeof v === "object") {
    const o = v as { text?: string; result?: unknown; richText?: { text: string }[] };
    if (Array.isArray(o.richText)) return o.richText.map((t) => t.text).join("").trim();
    if (o.text != null) return String(o.text).trim();
    if (o.result != null) return String(o.result).trim();
    return "";
  }
  return String(v).trim();
}

const BULAN_ALIAS: Record<string, number> = (() => {
  const m: Record<string, number> = {};
  BULAN_LABEL.forEach((b, i) => { m[b.toLowerCase()] = i + 1; m[b.slice(0, 3).toLowerCase()] = i + 1; });
  m["agu"] = 8; m["agt"] = 8; m["okt"] = 10; m["des"] = 12; m["mei"] = 5;
  return m;
})();

function resolveBulan(s: string): number | null {
  const t = norm(s);
  if (!t) return null;
  const n = Number(t);
  if (Number.isInteger(n) && n >= 1 && n <= 12) return n;
  return BULAN_ALIAS[t.toLowerCase()] ?? null;
}

function resolveMoney(s: string): number | null {
  const t = norm(s);
  if (!t) return null;
  const n = Number(t.replace(/[^\d-]/g, ""));
  return Number.isFinite(n) ? n : null;
}

/** Normalisasi tanggal → YYYY-MM-DD; "" bila kosong/tak dikenali. */
function resolveDate(s: string): { value: string; bad: boolean } {
  const t = norm(s);
  if (!t) return { value: "", bad: false };
  if (/^\d{4}-\d{2}-\d{2}/.test(t)) return { value: t.slice(0, 10), bad: false };
  // dd/mm/yyyy atau dd-mm-yyyy
  let m = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/.exec(t);
  if (m) return { value: `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`, bad: false };
  // "20 September 2023" / "5 Mei 2025"
  m = /^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})$/.exec(t);
  if (m) {
    const bln = BULAN_ALIAS[m[2].toLowerCase()];
    if (bln) return { value: `${m[3]}-${String(bln).padStart(2, "0")}-${m[1].padStart(2, "0")}`, bad: false };
  }
  return { value: "", bad: true };
}

/** Cocokkan teks ke kode enum via label/kode (alias tambahan opsional). */
function makeResolver<T extends string>(
  codes: readonly T[], labels: Record<T, string>, alias: Record<string, T> = {},
): (s: string) => T | null {
  const map = new Map<string, T>();
  for (const c of codes) {
    map.set(c.toLowerCase(), c);
    map.set(labels[c].toLowerCase(), c);
    map.set(normHeader(labels[c]), c);
    map.set(normHeader(c), c);
  }
  for (const [k, v] of Object.entries(alias)) map.set(normHeader(k), v);
  return (s: string) => {
    const t = norm(s);
    if (!t) return null;
    return map.get(t.toLowerCase()) ?? map.get(normHeader(t)) ?? null;
  };
}

const resJenis = makeResolver<JenisKlaim>(JENIS_KLAIM, JENIS_KLAIM_LABEL, { reg: "REGULER" });
const resLayanan = makeResolver<JenisLayanan>(JENIS_LAYANAN, JENIS_LAYANAN_LABEL, {
  "rawat inap": "RITL", "rawatinap": "RITL", "inap": "RITL",
  "rawat jalan": "RJTL", "rawatjalan": "RJTL", "jalan": "RJTL",
});
const resKategori = makeResolver<KategoriKlaim>(KATEGORI_KLAIM, KATEGORI_KLAIM_LABEL, {
  "inacbgs": "INA_CBGS", "inacbg": "INA_CBGS", "cbg": "INA_CBGS", "reguler": "INA_CBGS",
  "rujukan": "RUJUKAN_AMBULANS", "ambulans": "RUJUKAN_AMBULANS", "ambulance": "RUJUKAN_AMBULANS",
});
const resStatus = makeResolver<StatusKlaim>(STATUS_KLAIM, STATUS_KLAIM_LABEL, {
  "expired": "EXPIRED", "kadaluarsa": "EXPIRED", "sebagian": "PARTIAL", "parsial": "PARTIAL", "tolak": "REJECTED",
});
const resPotJenis = makeResolver<PotonganJenis>(POTONGAN_JENIS, POTONGAN_JENIS_LABEL, {
  "kelebihan": "KELEBIHAN_BAYAR", "kelebihanbayar": "KELEBIHAN_BAYAR", "lebihbayar": "KELEBIHAN_BAYAR",
  "potonganbertahap": "POTONGAN_BERKALA", "bertahap": "POTONGAN_BERKALA", "cicilan": "POTONGAN_BERKALA",
  "berkala": "POTONGAN_BERKALA", "potonganberkala": "POTONGAN_BERKALA", "potongancicilan": "POTONGAN_BERKALA",
  "pengembalian": "PENGEMBALIAN", "kembali": "PENGEMBALIAN", "pengembaliandana": "PENGEMBALIAN",
});

/* -------------------------------------------------------------------- parse */

type RawKlaim = { baris: number; nomorKlaim: string; jenisKlaim: string; jenisLayanan: string; kategori: string; bulan: string; tahun: string; jumlah: string; jumlahDiajukan: string; kasus: string; tglMasuk: string; status: string; refBa: string; catatan: string; ref: string };
type RawPot = { baris: number; ref: string; jenis: string; jumlah: string; cicilanKe: string; totalCicilan: string; refBa: string; deskripsi: string; tglTerapkan: string };

const KLAIM_ALIAS: Record<string, keyof Omit<RawKlaim, "baris">> = {
  nomor: "nomorKlaim", nomorklaim: "nomorKlaim", noklaim: "nomorKlaim",
  jenis: "jenisKlaim", jenisklaim: "jenisKlaim",
  layanan: "jenisLayanan", jenislayanan: "jenisLayanan", pelayanan: "jenisLayanan",
  kategori: "kategori",
  bulan: "bulan", bulanpelayanan: "bulan",
  tahun: "tahun", tahunpelayanan: "tahun",
  jumlah: "jumlah", jumlahditerima: "jumlah", diterima: "jumlah", nilai: "jumlah", dana: "jumlah",
  jumlahdiajukan: "jumlahDiajukan", diajukan: "jumlahDiajukan", pengajuan: "jumlahDiajukan",
  kasus: "kasus", jumlahkasus: "kasus",
  tglmasukrekening: "tglMasuk", tanggalmasuk: "tglMasuk", masukrekening: "tglMasuk", tglcair: "tglMasuk", tanggalcair: "tglMasuk", cair: "tglMasuk",
  status: "status",
  noba: "refBa", ba: "refBa", refba: "refBa", nomorba: "refBa",
  catatan: "catatan", keterangan: "catatan", ket: "catatan",
  ref: "ref", refbaris: "ref", kodebaris: "ref", id: "ref",
};
const POT_ALIAS: Record<string, keyof Omit<RawPot, "baris">> = {
  ref: "ref", refbaris: "ref", refklaim: "ref", klaim: "ref", nomorklaim: "ref", noklaim: "ref", kodebaris: "ref",
  jenis: "jenis", jenispotongan: "jenis",
  jumlah: "jumlah", nilai: "jumlah",
  cicilanke: "cicilanKe", cicilan: "cicilanKe",
  totalcicilan: "totalCicilan", totcicilan: "totalCicilan",
  noba: "refBa", ba: "refBa", refba: "refBa",
  deskripsi: "deskripsi", keterangan: "deskripsi", ket: "deskripsi",
  tgl: "tglTerapkan", tglterapkan: "tglTerapkan", tanggal: "tglTerapkan", tanggalterapkan: "tglTerapkan",
};

function readSheet<K extends string>(
  ws: ExcelJS.Worksheet | undefined, alias: Record<string, K>,
): { rows: (Record<K, string> & { baris: number })[]; kolom: K[] } {
  if (!ws || ws.rowCount < 2) return { rows: [], kolom: [] };
  const colMap = new Map<number, K>();
  const kolom: K[] = [];
  ws.getRow(1).eachCell((cell, col) => {
    const f = alias[normHeader(cellText(cell.value))];
    if (f && !kolom.includes(f)) { colMap.set(col, f); kolom.push(f); }
  });
  const rows: (Record<K, string> & { baris: number })[] = [];
  for (let r = 2; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    const item = { baris: r } as Record<K, string> & { baris: number };
    let any = false;
    colMap.forEach((field, col) => {
      const text = cellText(row.getCell(col).value);
      if (text) any = true;
      (item as Record<K, string>)[field] = text;
    });
    // Lewati baris contoh (italic) yang diawali "(" pada kolom pertama teks.
    if (any) rows.push(item);
  }
  return { rows, kolom };
}

export function parseImportWorkbook(buf: Buffer): Promise<{ klaim: RawKlaim[]; potongan: RawPot[]; error?: string }> {
  const wb = new ExcelJS.Workbook();
  return wb.xlsx.load(buf as unknown as ArrayBuffer).then(
    () => {
      const wsKlaim = wb.worksheets.find((w) => normHeader(w.name).includes("klaim")) ?? wb.worksheets[0];
      const wsPot = wb.worksheets.find((w) => normHeader(w.name).includes("potongan"));
      const kl = readSheet(wsKlaim, KLAIM_ALIAS);
      if (!kl.kolom.includes("jenisKlaim") || !kl.kolom.includes("bulan") || !kl.kolom.includes("tahun") || !kl.kolom.includes("jumlah")) {
        return { klaim: [], potongan: [], error: 'Sheet "Klaim" wajib memuat kolom: Jenis, Bulan, Tahun, Jumlah.' };
      }
      const pot = readSheet(wsPot, POT_ALIAS);
      const klaim = kl.rows.map((r) => ({
        baris: r.baris, nomorKlaim: r.nomorKlaim ?? "", jenisKlaim: r.jenisKlaim ?? "", jenisLayanan: r.jenisLayanan ?? "",
        kategori: r.kategori ?? "", bulan: r.bulan ?? "", tahun: r.tahun ?? "", jumlah: r.jumlah ?? "",
        jumlahDiajukan: r.jumlahDiajukan ?? "", kasus: r.kasus ?? "", tglMasuk: r.tglMasuk ?? "", status: r.status ?? "",
        refBa: r.refBa ?? "", catatan: r.catatan ?? "", ref: r.ref ?? "",
      } as RawKlaim));
      const potongan = pot.rows.map((r) => ({
        baris: r.baris, ref: r.ref ?? "", jenis: r.jenis ?? "", jumlah: r.jumlah ?? "", cicilanKe: r.cicilanKe ?? "",
        totalCicilan: r.totalCicilan ?? "", refBa: r.refBa ?? "", deskripsi: r.deskripsi ?? "", tglTerapkan: r.tglTerapkan ?? "",
      } as RawPot));
      return { klaim, potongan };
    },
    () => ({ klaim: [], potongan: [], error: "File tidak dapat dibaca. Pastikan format .xlsx." }),
  );
}

/* ------------------------------------------------------------ validasi baris */

type KlaimResolved = { input: ImportKlaimInput; result: ImportRowResult; refKey: string | null };

function resolveKlaimRow(raw: RawKlaim): KlaimResolved {
  const errors: string[] = [];
  const catatan: string[] = [];

  const jenis = resJenis(raw.jenisKlaim);
  if (!jenis) errors.push(norm(raw.jenisKlaim) ? `Jenis "${raw.jenisKlaim}" tidak dikenal` : "Jenis wajib diisi");
  const layanan = resLayanan(raw.jenisLayanan);
  if (!layanan) errors.push(norm(raw.jenisLayanan) ? `Layanan "${raw.jenisLayanan}" tidak dikenal` : "Layanan wajib diisi");
  let kategori = resKategori(raw.kategori);
  if (!kategori) { if (norm(raw.kategori)) catatan.push(`Kategori "${raw.kategori}" tak dikenal → INA-CBG's`); kategori = "INA_CBGS"; }
  let status = resStatus(raw.status);
  if (!status) { if (norm(raw.status)) catatan.push(`Status "${raw.status}" tak dikenal → Diajukan`); status = "SUBMITTED"; }

  const bulan = resolveBulan(raw.bulan);
  if (bulan == null) errors.push(norm(raw.bulan) ? `Bulan "${raw.bulan}" tidak valid` : "Bulan wajib diisi");
  const tahun = Number(norm(raw.tahun));
  if (!Number.isInteger(tahun) || tahun < 2015 || tahun > new Date().getFullYear() + 1) errors.push(`Tahun "${raw.tahun}" tidak valid`);
  const jumlah = resolveMoney(raw.jumlah);
  if (jumlah == null) errors.push("Jumlah wajib berupa angka");
  const diajukan = resolveMoney(raw.jumlahDiajukan);
  const kasus = norm(raw.kasus) ? Number(raw.kasus.replace(/[^\d]/g, "")) : null;
  const tgl = resolveDate(raw.tglMasuk);
  if (tgl.bad) catatan.push("Tgl masuk rekening tak dikenali → dikosongkan");

  const input: ImportKlaimInput = {
    nomorKlaim: norm(raw.nomorKlaim) || undefined,
    jenisKlaim: (jenis ?? "REGULER"),
    jenisLayanan: (layanan ?? "RITL"),
    kategori,
    bulanPelayanan: bulan ?? 1,
    tahunPelayanan: Number.isInteger(tahun) ? tahun : 0,
    jumlah: jumlah ?? 0,
    jumlahDiajukan: diajukan ?? undefined,
    jumlahKasus: kasus == null || Number.isNaN(kasus) ? undefined : kasus,
    tglMasukRekening: tgl.value || undefined,
    status,
    refBa: norm(raw.refBa) || undefined,
    catatan: norm(raw.catatan) || undefined,
  };

  // Validasi akhir via zod (menangkap batas/format lain).
  if (errors.length === 0) {
    const parsed = klaimCreateSchema.safeParse(input);
    if (!parsed.success) errors.push(...parsed.error.issues.map((i) => i.message));
  }

  const label = `${jenis ? JENIS_KLAIM_LABEL[jenis] : "?"} · ${layanan ?? "?"} · ${bulan ? BULAN_LABEL[bulan - 1].slice(0, 3) : "?"} ${norm(raw.tahun) || "?"}`;
  const refKey = norm(raw.ref) || norm(raw.nomorKlaim) || null;
  return {
    input,
    refKey,
    result: {
      baris: raw.baris, ref: refKey, status: errors.length ? "error" : "valid",
      label, jumlah, tahun: Number.isInteger(tahun) ? tahun : null,
      catatan: errors.length ? errors : catatan,
    },
  };
}

/* ---------------------------------------------------------------- proses */

async function process(
  parsed: { klaim: RawKlaim[]; potongan: RawPot[] }, user: SessionUser | null, commit: boolean,
): Promise<ImportPreview & { masuk: number; potonganMasuk: number }> {
  const db = getAppDb();
  const resolved = parsed.klaim.map(resolveKlaimRow);

  // Map ref → indeks klaim valid pertama (untuk pengaitan potongan).
  const refToIdx = new Map<string, number>();
  resolved.forEach((r, i) => {
    if (r.result.status === "valid" && r.refKey && !refToIdx.has(r.refKey)) refToIdx.set(r.refKey, i);
  });

  // Potongan (validasi + cek keterkaitan).
  const potResults: ImportRowResult[] = [];
  const potPlan: { idx: number; input: ReturnType<typeof buildPotInput> }[] = [];
  for (const rp of parsed.potongan) {
    const errors: string[] = [];
    const jenis = resPotJenis(rp.jenis);
    if (!jenis) errors.push(norm(rp.jenis) ? `Jenis potongan "${rp.jenis}" tidak dikenal` : "Jenis potongan wajib");
    const jumlah = resolveMoney(rp.jumlah);
    if (jumlah == null) errors.push("Jumlah potongan wajib angka");
    const refKey = norm(rp.ref);
    const idx = refKey ? refToIdx.get(refKey) : undefined;
    if (!refKey) errors.push("Ref (klaim) wajib diisi");
    else if (idx == null) errors.push(`Ref "${refKey}" tidak cocok klaim valid mana pun`);

    const input = buildPotInput(rp, jenis, jumlah);
    if (errors.length === 0 && input) {
      const p = potonganCreateSchema.omit({ klaimId: true }).safeParse(input);
      if (!p.success) errors.push(...p.error.issues.map((i) => i.message));
    }
    potResults.push({
      baris: rp.baris, ref: refKey || null, status: errors.length ? "error" : "valid",
      label: `${jenis ? POTONGAN_JENIS_LABEL[jenis] : "?"}${rp.cicilanKe ? ` · cicilan ${rp.cicilanKe}/${rp.totalCicilan || "?"}` : ""}`,
      jumlah, tahun: null, catatan: errors.length ? errors : [],
    });
    if (errors.length === 0 && idx != null && input) potPlan.push({ idx, input });
  }

  // Ringkasan per tahun (dari klaim valid).
  const perTahunMap = new Map<number, PerTahunImport>();
  for (const r of resolved) {
    if (r.result.status !== "valid" || r.result.tahun == null || r.result.jumlah == null) continue;
    const t = perTahunMap.get(r.result.tahun) ?? { tahun: r.result.tahun, inaCbgs: 0, rujukan: 0, entri: 0 };
    t.entri++;
    if (r.input.kategori === "RUJUKAN_AMBULANS") t.rujukan += r.result.jumlah;
    else t.inaCbgs += r.result.jumlah;
    perTahunMap.set(r.result.tahun, t);
  }
  const perTahun = [...perTahunMap.values()].sort((a, b) => a.tahun - b.tahun);
  const baseline: BaselineCheck[] = perTahun.map((p) => {
    const base = BASELINE_TAHUN[p.tahun] ?? null;
    return { tahun: p.tahun, impor: p.inaCbgs, baseline: base, cocok: base == null ? null : base === p.inaCbgs, selisih: base == null ? null : p.inaCbgs - base };
  });

  const validKlaim = resolved.filter((r) => r.result.status === "valid");
  const ringkasan: ImportRingkasan = {
    baris: resolved.length,
    valid: validKlaim.length,
    error: resolved.length - validKlaim.length,
    potonganBaris: potResults.length,
    potonganValid: potResults.filter((p) => p.status === "valid").length,
    potonganError: potResults.filter((p) => p.status === "error").length,
    totalInaCbgs: perTahun.reduce((s, p) => s + p.inaCbgs, 0),
    totalRujukan: perTahun.reduce((s, p) => s + p.rujukan, 0),
  };

  let masuk = 0, potonganMasuk = 0;
  if (commit && user) {
    const idxToId = new Map<number, string>();
    for (let i = 0; i < resolved.length; i++) {
      const r = resolved[i];
      if (r.result.status !== "valid") continue;
      const created = await db.klaimKlaim.create({ data: { ...writeData(r.input), createdBy: user.name, updatedBy: user.name } });
      idxToId.set(i, created.id);
      masuk++;
    }
    for (const pp of potPlan) {
      const klaimId = idxToId.get(pp.idx);
      if (!klaimId || !pp.input) continue;
      await db.klaimPotongan.create({ data: { klaimId, ...writePotData(pp.input) } });
      potonganMasuk++;
    }
    await writeKlaimAudit({
      user, entity: "klaim", action: "import", targetId: `import-${Date.now()}`,
      extra: {
        masuk, potonganMasuk,
        perTahun: perTahun.map((p) => snapshotPerTahun(p)),
      },
    });
  }

  return {
    klaim: resolved.map((r) => r.result),
    potongan: potResults,
    ringkasan, perTahun, baseline,
    masuk, potonganMasuk,
  };
}

function snapshotPerTahun(p: PerTahunImport) {
  return { tahun: p.tahun, inaCbgs: p.inaCbgs, rujukan: p.rujukan, entri: p.entri };
}

type PotInput = { jenis: PotonganJenis; jumlah: number; cicilanKe?: number; totalCicilan?: number; refBa?: string; deskripsi?: string; tglTerapkan?: string };
function buildPotInput(rp: RawPot, jenis: PotonganJenis | null, jumlah: number | null): PotInput | null {
  if (!jenis || jumlah == null) return null;
  const ci = norm(rp.cicilanKe) ? Number(rp.cicilanKe.replace(/[^\d]/g, "")) : undefined;
  const tc = norm(rp.totalCicilan) ? Number(rp.totalCicilan.replace(/[^\d]/g, "")) : undefined;
  const tgl = resolveDate(rp.tglTerapkan);
  return {
    jenis, jumlah,
    cicilanKe: ci != null && !Number.isNaN(ci) ? ci : undefined,
    totalCicilan: tc != null && !Number.isNaN(tc) ? tc : undefined,
    refBa: norm(rp.refBa) || undefined,
    deskripsi: norm(rp.deskripsi) || undefined,
    tglTerapkan: tgl.value || undefined,
  };
}

/** String YYYY-MM-DD → Date pada UTC midnight (hindari geser TZ, selaras zod coerce). */
const toUtcDate = (s?: string) => (s ? new Date(`${s}T00:00:00.000Z`) : null);

function writeData(input: ImportKlaimInput) {
  return {
    nomorKlaim: input.nomorKlaim ?? null,
    jenisKlaim: input.jenisKlaim, jenisLayanan: input.jenisLayanan, kategori: input.kategori,
    bulanPelayanan: input.bulanPelayanan, tahunPelayanan: input.tahunPelayanan,
    jumlah: BigInt(input.jumlah),
    jumlahDiajukan: input.jumlahDiajukan == null ? null : BigInt(input.jumlahDiajukan),
    jumlahKasus: input.jumlahKasus ?? null,
    tglMasukRekening: toUtcDate(input.tglMasukRekening),
    status: input.status, refBa: input.refBa ?? null, catatan: input.catatan ?? null,
  };
}
function writePotData(input: PotInput) {
  return {
    jenis: input.jenis, jumlah: BigInt(input.jumlah),
    cicilanKe: input.cicilanKe ?? null, totalCicilan: input.totalCicilan ?? null,
    refBa: input.refBa ?? null, deskripsi: input.deskripsi ?? null, tglTerapkan: toUtcDate(input.tglTerapkan),
  };
}

/* ---------------------------------------------------------------- publik */

export async function previewImport(parsed: { klaim: RawKlaim[]; potongan: RawPot[] }): Promise<ImportPreview> {
  const { klaim, potongan, ringkasan, perTahun, baseline } = await process(parsed, null, false);
  return { klaim, potongan, ringkasan, perTahun, baseline };
}

export async function commitImport(parsed: { klaim: RawKlaim[]; potongan: RawPot[] }, user: SessionUser): Promise<ImportCommitSummary> {
  const res = await process(parsed, user, true);
  return { masuk: res.masuk, dilewati: res.ringkasan.error, potonganMasuk: res.potonganMasuk, potonganDilewati: res.ringkasan.potonganError, perTahun: res.perTahun, baseline: res.baseline };
}

/* ------------------------------------------------------------ template .xlsx */

const HEAD_FILL = "FF0F766E";
const REF_FILL = "FF1E5A94";

export async function buildImportTemplate(): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "AuditTrail RS BOLTIM";

  // Sheet Klaim
  const kl = wb.addWorksheet("Klaim", { views: [{ state: "frozen", ySplit: 1 }] });
  const klCols = [
    { h: "Ref", w: 10, c: "K-2025-01 (untuk kait potongan)" },
    { h: "Nomor Klaim", w: 18, c: "(opsional)" },
    { h: "Jenis", w: 12, c: "Reguler" },
    { h: "Layanan", w: 12, c: "RITL" },
    { h: "Kategori", w: 16, c: "INA-CBG's" },
    { h: "Bulan", w: 10, c: "Mei" },
    { h: "Tahun", w: 8, c: "2023" },
    { h: "Jumlah", w: 18, c: "808170000" },
    { h: "Jumlah Diajukan", w: 16, c: "(opsional)" },
    { h: "Kasus", w: 8, c: "(opsional)" },
    { h: "Tgl Masuk Rekening", w: 18, c: "2023-06-20" },
    { h: "Status", w: 16, c: "Diterima" },
    { h: "No. BA", w: 14, c: "(opsional)" },
    { h: "Catatan", w: 28, c: "(opsional)" },
  ];
  kl.columns = klCols.map((c) => ({ header: c.h, width: c.w }));
  styleHead(kl.getRow(1), HEAD_FILL);
  const ex = kl.addRow(klCols.map((c) => c.c));
  ex.eachCell((cell) => { cell.font = { name: "Calibri", size: 9, italic: true, color: { argb: "FF94A3B8" } }; });

  // Sheet Potongan
  const pt = wb.addWorksheet("Potongan", { views: [{ state: "frozen", ySplit: 1 }] });
  const ptCols = [
    { h: "Ref", w: 12, c: "K-2025-01 (samakan dgn Ref/Nomor di sheet Klaim)" },
    { h: "Jenis", w: 26, c: "Kelebihan Bayar" },
    { h: "Jumlah", w: 16, c: "2447500" },
    { h: "Cicilan Ke", w: 12, c: "(bila bertahap)" },
    { h: "Total Cicilan", w: 12, c: "(bila bertahap)" },
    { h: "No. BA", w: 14, c: "(opsional)" },
    { h: "Deskripsi", w: 30, c: "(opsional)" },
    { h: "Tgl Terapkan", w: 16, c: "(opsional)" },
  ];
  pt.columns = ptCols.map((c) => ({ header: c.h, width: c.w }));
  styleHead(pt.getRow(1), HEAD_FILL);
  const exP = pt.addRow(ptCols.map((c) => c.c));
  exP.eachCell((cell) => { cell.font = { name: "Calibri", size: 9, italic: true, color: { argb: "FF94A3B8" } }; });

  // Sheet Petunjuk
  const pj = wb.addWorksheet("Petunjuk");
  pj.columns = [{ header: "Kolom", width: 22 }, { header: "Nilai yang valid / format", width: 70 }];
  styleHead(pj.getRow(1), REF_FILL);
  const rows: [string, string][] = [
    ["Jenis", JENIS_KLAIM.map((j) => JENIS_KLAIM_LABEL[j]).join(" · ")],
    ["Layanan", `${JENIS_LAYANAN.join(" · ")}  (boleh: Rawat Inap / Rawat Jalan)`],
    ["Kategori", `${KATEGORI_KLAIM.map((k) => KATEGORI_KLAIM_LABEL[k]).join(" · ")}  (kosong = INA-CBG's)`],
    ["Status", STATUS_KLAIM.map((s) => STATUS_KLAIM_LABEL[s]).join(" · ")],
    ["Bulan", "Angka 1–12 atau nama bulan (Januari … Desember / Jan … Des)"],
    ["Tahun", "4 digit, mis. 2023"],
    ["Jumlah / Jumlah Diajukan", "Rupiah penuh tanpa desimal (mis. 808170000; boleh pakai titik/Rp)"],
    ["Tgl (semua)", "YYYY-MM-DD (mis. 2023-06-20); boleh dd/mm/yyyy atau '20 September 2023'"],
    ["Ref", "Kode bebas & UNIK per baris klaim untuk mengaitkan baris potongan (opsional)"],
    ["Jenis Potongan", POTONGAN_JENIS.map((p) => POTONGAN_JENIS_LABEL[p]).join(" · ")],
    ["", ""],
    ["Catatan", "Baris contoh (abu, italic) di sheet Klaim & Potongan — HAPUS sebelum mengisi data asli."],
    ["Baseline §7", `2023: Rp${BASELINE_TAHUN[2023].toLocaleString("id-ID")} · 2024: Rp${BASELINE_TAHUN[2024].toLocaleString("id-ID")} · 2025: Rp${BASELINE_TAHUN[2025].toLocaleString("id-ID")} · 2026: Rp${BASELINE_TAHUN[2026].toLocaleString("id-ID")}`],
  ];
  for (const [a, b] of rows) {
    const row = pj.addRow([a, b]);
    row.getCell(1).font = { name: "Calibri", size: 10, bold: true, color: { argb: "FF1E293B" } };
    row.getCell(2).font = { name: "Calibri", size: 10, color: { argb: "FF475569" } };
    row.getCell(2).alignment = { wrapText: true };
  }

  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf);
}

function styleHead(row: ExcelJS.Row, fill: string) {
  row.height = 22;
  row.eachCell((cell) => {
    cell.font = { name: "Calibri", size: 10, bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: fill } };
    cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
  });
}

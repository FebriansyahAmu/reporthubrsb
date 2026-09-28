/**
 * Perhitungan kepatuhan Rawat Inap per hari dinas × shift — FUNGSI MURNI (tanpa
 * I/O), dipakai drawer jejak kunjungan (K2) dan skor petugas (K3).
 *
 * Aturan (PRD Fase 2 §4.2, keputusan §10.1):
 * - Hari dinas D = D 07:00 → D+1 07:00 (Pagi 07–14, Siang 14–21, Malam 21–07).
 * - Target: CPPT keperawatan (Paramedis/Bidan) ≥ 1 per shift; CPPT dokter ≥ 1
 *   dan TTV ≥ 3 per hari dinas.
 * - Hanya shift/hari yang SELURUHNYA berada dalam masa rawat dan sudah lewat
 *   yang dinilai; sebagian (masuk/keluar di tengah) → PARSIAL, tidak dihukum.
 * - Input batal (STATUS 0) tidak dihitung untuk target, dilaporkan terpisah.
 * - Diagnosis per episode → tidak masuk matriks.
 *
 * Waktu = string jam dinding WITA `YYYY-MM-DDTHH:mm:ss`; diperlakukan sebagai
 * UTC murni agar aritmetika bebas zona waktu server.
 */

import {
  CPPT_PERAN_DOKTER,
  CPPT_PERAN_KEPERAWATAN,
  HARI_DINAS_MULAI_JAM,
  SHIFTS,
  TARGET_RI,
  type KategoriKey,
  type ShiftKey,
} from "./kunjungan.constants";

const H = 3_600_000;
const DAY = 24 * H;
/** Batas baris matriks (lama rawat terpanjang 90 hari terakhir: 11 hari). */
export const MATRIKS_MAKS_HARI = 62;

export type MatriksRecord = {
  kategori: KategoriKey;
  waktu: string | null;
  oleh: string | null;
  batal: boolean;
  peran: number | null;
};

/**
 * OK = target terpenuhi · KURANG = target tak terpenuhi · PARSIAL = hanya
 * sebagian dalam masa rawat / sedang berjalan (tidak dinilai) · NANTI = belum
 * berjalan (pasien masih dirawat) · LUAR = di luar masa rawat.
 */
export type SelStatus = "OK" | "KURANG" | "PARSIAL" | "NANTI" | "LUAR";

export const SEL_LABEL: Record<SelStatus, string> = {
  OK: "Terpenuhi",
  KURANG: "Tidak terpenuhi",
  PARSIAL: "Sebagian dalam masa rawat — tidak dinilai",
  NANTI: "Belum berjalan",
  LUAR: "Di luar masa rawat",
};

export type Hitungan = {
  cpptKeperawatan: number;
  cpptDokter: number;
  cpptLain: number;
  ttv: number;
  asesmen: number;
  tindakan: number;
  batal: number;
};

export type ShiftCell = Hitungan & { shift: ShiftKey; status: SelStatus; petugas: string[] };

export type HariDinas = Hitungan & {
  /** Tanggal hari dinas (dimulai 07:00). */
  tanggal: string;
  hariKe: number;
  shifts: ShiftCell[];
  dokterStatus: SelStatus;
  ttvStatus: SelStatus;
  petugas: string[];
};

export type Matriks = {
  hari: HariDinas[];
  ringkasan: {
    shiftDinilai: number;
    shiftOk: number;
    hariDinilai: number;
    dokterOk: number;
    ttvOk: number;
    /** (shift OK + visite OK + TTV OK) / semua yang dinilai; null bila belum ada yang dinilai. */
    persen: number | null;
  };
  target: typeof TARGET_RI;
  /** Record di luar rentang baris matriks (mis. tercatat sebelum masuk). */
  diLuarMasaRawat: number;
  terpotong: boolean;
};

const t = (s: string) => Date.parse(`${s.slice(0, 19)}Z`);
const iso = (ms: number) => new Date(ms).toISOString().slice(0, 10);
/** Tanggal hari dinas untuk sebuah waktu (jam < 07:00 milik hari dinas sebelumnya). */
export const hariDinasOf = (waktu: string) => iso(t(waktu) - HARI_DINAS_MULAI_JAM * H);

const kosong = (): Hitungan => ({ cpptKeperawatan: 0, cpptDokter: 0, cpptLain: 0, ttv: 0, asesmen: 0, tindakan: 0, batal: 0 });

function tambah(h: Hitungan, r: MatriksRecord) {
  if (r.batal) {
    h.batal++;
    return;
  }
  if (r.kategori === "CPPT") {
    if (r.peran != null && CPPT_PERAN_KEPERAWATAN.includes(r.peran)) h.cpptKeperawatan++;
    else if (r.peran === CPPT_PERAN_DOKTER) h.cpptDokter++;
    else h.cpptLain++;
  } else if (r.kategori === "TTV") h.ttv++;
  else if (r.kategori === "ASESMEN") h.asesmen++;
  else if (r.kategori === "TINDAKAN") h.tindakan++;
}

/** Status sebuah jendela waktu terhadap masa rawat [masuk, akhir] per saat `now`. */
function statusJendela(start: number, end: number, masuk: number, akhir: number, masihDirawat: boolean, lulus: boolean): SelStatus {
  if (start >= akhir && masihDirawat) return "NANTI";
  if (end <= masuk || start >= akhir) return "LUAR";
  const utuh = start >= masuk && end <= akhir;
  if (!utuh) return "PARSIAL";
  return lulus ? "OK" : "KURANG";
}

export function hitungMatriksRi(input: {
  records: MatriksRecord[];
  masuk: string;
  keluar: string | null;
  /** Saat ini (jam dinding WITA) — akhir masa rawat bila belum keluar. */
  now: string;
}): Matriks {
  const masuk = t(input.masuk);
  const akhir = input.keluar ? t(input.keluar) : t(input.now);
  const dirawat = !input.keluar;
  const mulaiHari = t(`${hariDinasOf(input.masuk)}T00:00:00`);
  const akhirHari = t(`${hariDinasOf(input.keluar ?? input.now)}T00:00:00`);
  const jumlahHari = Math.max(1, Math.round((akhirHari - mulaiHari) / DAY) + 1);
  const n = Math.min(jumlahHari, MATRIKS_MAKS_HARI);

  // Kelompokkan record ke (hari dinas, shift).
  const sel = new Map<string, { h: Hitungan; petugas: Set<string> }>();
  let diLuar = 0;
  for (const r of input.records) {
    if (!r.waktu || r.kategori === "DIAGNOSIS") continue;
    const hari = hariDinasOf(r.waktu);
    const idx = Math.round((t(`${hari}T00:00:00`) - mulaiHari) / DAY);
    if (idx < 0 || idx >= n) {
      diLuar++;
      continue;
    }
    const jam = new Date(t(r.waktu)).getUTCHours();
    const shift = SHIFTS.find((s) => (s.start < s.end ? jam >= s.start && jam < s.end : jam >= s.start || jam < s.end))!.key;
    const key = `${idx}:${shift}`;
    const c = sel.get(key) ?? { h: kosong(), petugas: new Set<string>() };
    tambah(c.h, r);
    if (r.oleh && !r.batal) c.petugas.add(r.oleh);
    sel.set(key, c);
  }

  const hari: HariDinas[] = [];
  let shiftDinilai = 0, shiftOk = 0, hariDinilai = 0, dokterOk = 0, ttvOk = 0;

  for (let i = 0; i < n; i++) {
    const base = mulaiHari + i * DAY + HARI_DINAS_MULAI_JAM * H;
    const total = kosong();
    const petugasHari = new Set<string>();
    const shifts: ShiftCell[] = SHIFTS.map((s, si) => {
      const start = base + [0, 7, 14][si] * H;
      const end = base + [7, 14, 24][si] * H;
      const c = sel.get(`${i}:${s.key}`) ?? { h: kosong(), petugas: new Set<string>() };
      (Object.keys(total) as (keyof Hitungan)[]).forEach((k) => (total[k] += c.h[k]));
      c.petugas.forEach((p) => petugasHari.add(p));
      const status = statusJendela(start, end, masuk, akhir, dirawat, c.h.cpptKeperawatan >= TARGET_RI.cpptPerawatPerShift);
      if (status === "OK" || status === "KURANG") {
        shiftDinilai++;
        if (status === "OK") shiftOk++;
      }
      return { ...c.h, shift: s.key, status, petugas: [...c.petugas] };
    });

    const dokterStatus = statusJendela(base, base + DAY, masuk, akhir, dirawat, total.cpptDokter >= TARGET_RI.cpptDokterPerHari);
    const ttvStatus = statusJendela(base, base + DAY, masuk, akhir, dirawat, total.ttv >= TARGET_RI.ttvPerHari);
    if (dokterStatus === "OK" || dokterStatus === "KURANG") {
      hariDinilai++;
      if (dokterStatus === "OK") dokterOk++;
      if (ttvStatus === "OK") ttvOk++;
    }

    hari.push({
      ...total,
      tanggal: iso(mulaiHari + i * DAY),
      hariKe: i + 1,
      shifts,
      dokterStatus,
      ttvStatus,
      petugas: [...petugasHari],
    });
  }

  const dinilai = shiftDinilai + hariDinilai * 2;
  return {
    hari,
    ringkasan: {
      shiftDinilai,
      shiftOk,
      hariDinilai,
      dokterOk,
      ttvOk,
      persen: dinilai ? Math.round(((shiftOk + dokterOk + ttvOk) / dinilai) * 100) : null,
    },
    target: TARGET_RI,
    diLuarMasaRawat: diLuar,
    terpotong: jumlahHari > n,
  };
}

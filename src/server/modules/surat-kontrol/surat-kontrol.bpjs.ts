import "server-only";
import { z } from "zod";
import { getSimgosReportBase } from "@/server/lib/env";
import { createLimiter } from "@/server/lib/limiter";
import { createTtlCache } from "@/server/lib/ttl-cache";
import type { JenisKontrol } from "./surat-kontrol.constants";
import { potongRentang } from "./surat-kontrol.filter";
import type { BpjsSurat, KodeNama } from "./surat-kontrol.types";

/**
 * Klien webservice SIMGOS `GET /webservice/plugins/bpjs/rencanaKontrol` — daftar
 * Surat Kontrol & SPRI per tanggal rencana, diteruskan SIMGOS ke VClaim BPJS
 * (real-time). Hanya GET; tanpa kredensial (sesi tamu cukup).
 *
 * ⚠️ Efek samping di SIMGOS (diketahui & disetujui user, 12 Okt 2026): plugin
 * menyimpan hasilnya ke tabel cache `bpjs.monitoring_rencana_kontrol` setiap kali
 * dipanggil (sama seperti layar Monitoring Rencana Kontrol SIMGOS). Tabel audit
 * (`jadwal_kontrol`, `rencana_kontrol`) tidak tersentuh. Untuk menekan jumlah
 * panggilan: cache TTL + single-flight per rentang, batas konkurensi 2, dan
 * "segarkan" paling cepat tiap 30 detik per rentang.
 *
 * VClaim menolak rentang > 30 hari (HTTP 412, "Range tanggal awal dan akhir
 * tidak boleh lebih dari 30 hari(201)") → rentang dipecah per 30 hari. Rentang
 * tanpa surat juga dibalas 412 ("Data Tidak Ditemukan(201)") → dianggap kosong.
 */

const TIMEOUT_MS = 30_000;
const TTL_MS = 5 * 60_000;
const SEGAR_MIN_MS = 30_000;

const teks = z.string().nullish().transform((v) => (v ?? "").trim() || null);
const itemSchema = z.object({
  noSuratKontrol: z.string().min(1).max(40),
  jnsPelayanan: teks,
  jnsKontrol: z.union([z.string(), z.number()]).transform((v) => Number(v)),
  tglRencanaKontrol: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  tglTerbitKontrol: teks,
  noSepAsalKontrol: teks,
  poliAsal: teks,
  namaPoliAsal: teks,
  poliTujuan: teks,
  namaPoliTujuan: teks,
  tglSEP: teks,
  kodeDokter: teks,
  namaDokter: teks,
  noKartu: teks,
  nama: teks,
  terbitSEP: teks,
});
const responsSchema = z.object({
  success: z.boolean().optional(),
  data: z.array(z.unknown()).nullish(),
  detail: z.string().nullish(),
  message: z.string().nullish(),
});

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const tgl = (v: string | null) => (v && ISO.test(v) && !v.startsWith("0000") ? v : null);
/** BPJS memakai "-" / "" untuk "tidak ada". */
const kodeNama = (kode: string | null, nama: string | null): KodeNama | null => {
  const k = kode && kode !== "-" ? kode : null;
  const n = nama && nama !== "-" ? nama : null;
  return k || n ? { kode: k ?? "", nama: n } : null;
};

function normalisasi(raw: z.infer<typeof itemSchema>): BpjsSurat | null {
  if (raw.jnsKontrol !== 1 && raw.jnsKontrol !== 2) return null;
  return {
    noSurat: raw.noSuratKontrol.trim(),
    jenis: raw.jnsKontrol as JenisKontrol,
    jnsPelayanan: raw.jnsPelayanan,
    tglRencana: raw.tglRencanaKontrol,
    tglTerbit: tgl(raw.tglTerbitKontrol),
    sepAsal: raw.noSepAsalKontrol,
    tglSep: tgl(raw.tglSEP),
    poliAsal: kodeNama(raw.poliAsal, raw.namaPoliAsal),
    poliTujuan: kodeNama(raw.poliTujuan, raw.namaPoliTujuan),
    dokter: kodeNama(raw.kodeDokter, raw.namaDokter),
    noKartu: raw.noKartu,
    nama: raw.nama,
    sepTerbit: raw.terbitSEP === "Sudah" ? true : raw.terbitSEP === "Belum" ? false : null,
  };
}

const batas = createLimiter("bpjs-rencana-kontrol", 2);
const cache = createTtlCache<BpjsSurat[]>("bpjs-rencana-kontrol", { ttlMs: TTL_MS, max: 30 });
const g = globalThis as unknown as { __rkSegarTerakhir?: Map<string, number> };
const segarTerakhir = (g.__rkSegarTerakhir ??= new Map());

/** Semua potongan (VClaim menolak rentang > 30 hari) diambil BERURUTAN lalu digabung (unik per nomor surat). */
async function ambil(from: string, to: string): Promise<BpjsSurat[]> {
  const per = new Map<string, BpjsSurat>();
  for (const [a, b] of potongRentang(from, to)) for (const s of await ambilPotongan(a, b)) per.set(s.noSurat, s);
  return [...per.values()];
}

async function ambilPotongan(from: string, to: string): Promise<BpjsSurat[]> {
  const base = getSimgosReportBase();
  if (!base) throw new Error("Webservice SIMGOS belum dikonfigurasi (SIMGOS_REPORT_URL / DATABASE_URL_SIMGOS).");
  const sp = new URLSearchParams({ _dc: String(Date.now()), filter: "2", tglAwal: from, tglAkhir: to, page: "1", start: "0", limit: "5000" });
  const res = await fetch(`${base}/plugins/bpjs/rencanaKontrol?${sp}`, {
    headers: { Accept: "application/json", "X-Requested-With": "XMLHttpRequest" },
    signal: AbortSignal.timeout(TIMEOUT_MS),
    cache: "no-store",
  });
  if (!res.ok) {
    // Galat dibungkus problem+json ({ title, detail }) — tampilkan detail BPJS bila ada.
    const detail = await res
      .json()
      .then((j: unknown) => (j && typeof j === "object" && "detail" in j && typeof j.detail === "string" ? j.detail : null))
      .catch(() => null);
    // VClaim membalas rentang tanpa surat sebagai 412 "Data Tidak Ditemukan(201)" — itu daftar kosong.
    if (detail && /tidak ditemukan/i.test(detail)) return [];
    throw new Error(`Webservice BPJS membalas HTTP ${res.status}${detail ? `: ${detail.slice(0, 160)}` : ""}.`);
  }
  const json = responsSchema.parse(await res.json());
  if (json.success === false) throw new Error(`BPJS menolak permintaan: ${(json.detail ?? json.message ?? "tanpa keterangan").slice(0, 160)}`);
  const hasil: BpjsSurat[] = [];
  let rusak = 0;
  for (const item of json.data ?? []) {
    const p = itemSchema.safeParse(item);
    const s = p.success ? normalisasi(p.data) : null;
    // Saring ulang rentang (pertahanan bila filter sisi server berubah perilaku).
    if (s && s.tglRencana >= from && s.tglRencana <= to) hasil.push(s);
    else if (!s) rusak++;
  }
  if (rusak > 0) console.warn(`[surat-kontrol] ${rusak} item respons BPJS tidak sesuai skema dilewati`);
  return hasil;
}

/**
 * Surat Kontrol & SPRI BPJS dengan tanggal rencana di [from, to]. `segar` =
 * abaikan cache (dibatasi: paling cepat 30 dtk sejak penyegaran terakhir).
 */
export async function ambilRencanaKontrolBpjs(
  from: string,
  to: string,
  opts?: { segar?: boolean },
): Promise<{ data: BpjsSurat[]; diambil: number; dariCache: boolean }> {
  const key = `${from}|${to}`;
  let segar = !!opts?.segar;
  if (segar) {
    const terakhir = segarTerakhir.get(key) ?? 0;
    if (Date.now() - terakhir < SEGAR_MIN_MS) segar = false;
    else {
      if (segarTerakhir.size > 200) segarTerakhir.clear();
      segarTerakhir.set(key, Date.now());
    }
  }
  const hit = await cache.get(key, () => batas(() => ambil(from, to)), { fresh: segar });
  return { data: hit.value, diambil: hit.at, dariCache: hit.hit };
}

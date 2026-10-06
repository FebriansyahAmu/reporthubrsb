import "server-only";
import { tanggalHariIniWita } from "@/lib/format";
import type { DefinisiForm, KodeForm } from "@/features/form-rm/registry";
import { pangkasTeksPanjang } from "@/features/form-rm/skema";
import { bacaTriaseSimrs, prefillRingkasan } from "./form-rm.service";
import type { FormRmHeader } from "./form-rm.types";

/**
 * ISI OTOMATIS isian baru (PRD §6.4) — dijalankan SEKALI di server saat isian
 * dibuat; perubahan SIMRS sesudahnya tidak mengubah isian diam-diam. SIMGOS
 * hanya dibaca. `asal` = kolom yang nilainya datang dari SIMRS (untuk penanda
 * "SIMRS" di UI). Nilai bawaan non-SIMRS (mis. tanggal hari ini) tidak ikut.
 */

export type HasilIsiOtomatis = { data: object; asal: string[] };
type Data = Record<string, unknown>;
type Pengisi = (data: Data, header: FormRmHeader, nopen: string) => Promise<string[]>;

const terisi = (v: unknown) =>
  typeof v === "string" ? v.trim() !== "" : Array.isArray(v) ? v.length > 0 : v === true;

/** Salin nilai yang benar-benar terisi; kembalikan nama kolomnya. */
function salin(data: Data, sumber: Record<string, unknown>): string[] {
  const asal: string[] = [];
  for (const [k, v] of Object.entries(sumber)) {
    if (!terisi(v)) continue;
    data[k] = v;
    asal.push(k);
  }
  return asal;
}

/** "2026-09-29T08:04:00.000Z" (jam dinding SIMGOS) → "2026-09-29T08:04". */
const jamDinding = (iso: string) => iso.slice(0, 16);
const bukanStrip = (s: string) => (s && s !== "—" ? s : "");

const PENGISI: Record<KodeForm, Pengisi> = {
  "RM.04": async (data, header, nopen) => {
    const triase = await bacaTriaseSimrs(nopen);
    const asal = triase ? salin(data, triase.prefill) : [];
    if (!data.kedatanganWaktu) {
      data.kedatanganWaktu = jamDinding(header.masuk); // tanpa triase SIMRS: waktu masuk kunjungan
      asal.push("kedatanganWaktu");
    }
    if (!data.waktuTriase) data.waktuTriase = data.kedatanganWaktu;
    return asal;
  },
  "RM.01": async (data, header, nopen) => {
    const pre = await prefillRingkasan(nopen, header);
    const asal = salin(data, { ...pre, dokterMerawatNama: pre.dpjp });
    data.sebabKematianTanggal = tanggalHariIniWita();
    return asal;
  },
  "RM.03": async (data, header) => {
    const asal = salin(data, {
      waktuPendaftaran: jamDinding(header.masuk),
      ruanganRawat: bukanStrip(header.ruang),
      pasienNama: bukanStrip(header.nama),
      nik: header.nik,
    });
    data.tanggalTtd = tanggalHariIniWita();
    return asal;
  },
  "RM.21": async () => [],
};

export async function isiOtomatis(
  def: DefinisiForm,
  nopen: string,
  header: FormRmHeader,
): Promise<HasilIsiOtomatis> {
  const data = def.kosong() as Data;
  const asal = await PENGISI[def.kode](data, header, nopen);
  // Teks SIMRS yang melebihi batas kolom dipangkas, bukan menggagalkan isian.
  const sah = pangkasTeksPanjang(def.skema, data);
  if (!sah) throw new Error(`Isi otomatis ${def.kode} menghasilkan data tidak sah`);
  return { data: sah, asal };
}

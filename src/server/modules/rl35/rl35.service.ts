import "server-only";
import { tanggalHariIniWita } from "@/lib/format";
import { isSimgosConfigured } from "@/server/lib/env";
import { KODE_KAB_BOLTIM } from "@/server/modules/domisili/domisili.constants";
import { judulPeriode, satuanPeriode } from "@/server/modules/rl32/rl32.periode";
import { queryAgregatRl35, queryHariPoliklinik, queryRuanganRl35 } from "./rl35.dal";
import { nilaiKosong, susunRl35 } from "./rl35.hitung";
import { instansiRl35, kategoriRl35 } from "./rl35.kategori";
import { bacaPetaTersimpan } from "./rl35.pemetaan";
import type { Rl35Query } from "./rl35.schema";
import type { InstansiRl35, Rl35Result } from "./rl35.types";

const namaRapi = (s: string) => s.toLowerCase().replace(/\b\p{L}/gu, (c) => c.toUpperCase());

/**
 * Kabupaten/kota RS = 4 digit wilayah PPK instansi (SP: `inst.WILAYAH`);
 * cadangan Boltim bila instansi belum terkonfigurasi.
 */
function kabupatenRs(i: InstansiRl35 | null): { kode: string; nama: string } {
  const kode = /^\d{4}/.test(i?.kodeWilayah ?? "") ? i!.kodeWilayah.slice(0, 4) : KODE_KAB_BOLTIM;
  const nama = i && i.kodeWilayah === kode && i.kota ? namaRapi(i.kota) : kode === KODE_KAB_BOLTIM ? "Bolaang Mongondow Timur" : kode;
  return { kode, nama };
}

/**
 * RL 3.5 (SIRS 6) Rekapitulasi Kunjungan pada periode. Kunjungan poliklinik &
 * IGD per ruangan dari SIMGOS (READ-ONLY, port SP LaporanRL35Revisi), lalu
 * dijumlahkan per jenis kegiatan memakai pemetaan di DB aplikasi (atau bawaan
 * dari nama ruangan). Dalam/luar kab/kota menurut domisili pasien.
 */
export async function getRl35(input: Rl35Query): Promise<Rl35Result> {
  const { from, to } = input;
  const hariIni = tanggalHariIniWita();
  const base = {
    periode: { from, to, berjalan: to >= hariIni },
    judulPeriode: judulPeriode(from, to),
    satuan: satuanPeriode(from, to),
    updatedAt: new Date().toISOString(),
  };

  if (!isSimgosConfigured()) {
    return {
      ...base,
      instansi: null,
      kabupaten: kabupatenRs(null),
      baris: [],
      total: nilaiKosong(),
      rataRata: { hariBuka: 0, bulan: 1, rataHariBuka: 0, kunjunganRj: 0, rataKunjunganPerHari: null },
      ruangan: [],
      belumDipetakan: [],
      domisiliTakTercatat: 0,
    };
  }

  const instansi = await instansiRl35().catch(() => null);
  const kabupaten = kabupatenRs(instansi);
  const dari = `${from} 00:00:00`;
  const sampai = `${to} 23:59:59`;
  const [agregat, hari, ruangan, kategori, peta] = await Promise.all([
    queryAgregatRl35(dari, sampai, kabupaten.kode),
    queryHariPoliklinik(dari, sampai),
    queryRuanganRl35(),
    kategoriRl35(),
    bacaPetaTersimpan(),
  ]);

  return { ...base, instansi, kabupaten, ...susunRl35({ kategori, ruangan, agregat, hari, peta, from, to }) };
}

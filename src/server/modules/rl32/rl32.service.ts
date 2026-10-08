import "server-only";
import { tanggalHariIniWita } from "@/lib/format";
import { isSimgosConfigured } from "@/server/lib/env";
import {
  queryAgregatRuangan,
  queryInstansiRl32,
  queryNamaRuangan,
  queryRuanganRawatInap,
  queryTempatTidur,
} from "./rl32.dal";
import { nilaiKosong, nilaiPerRuanganSmf, susunRl32 } from "./rl32.hitung";
import { daftarSmf, kategoriRl32 } from "./rl32.kategori";
import { bacaPetaSmf, bacaPetaTersimpan } from "./rl32.pemetaan";
import { judulPeriode, tambahHari } from "./rl32.periode";
import type { Rl32Query } from "./rl32.schema";
import type { InstansiRl32, Rl32Result } from "./rl32.types";

const str = (x: unknown): string => (typeof x === "string" ? x : x == null ? "" : String(x));

/**
 * RL 3.2 (SIRS 6) Rawat Inap per Ruangan pada periode. Angka per ruangan × SMF
 * DPJP dari SIMGOS (READ-ONLY, port SP LaporanRL32RuanganRevisi), lalu
 * dijumlahkan per jenis pelayanan memakai pemetaan di DB aplikasi (ruangan
 * ber-pisah DPJP: menurut SMF DPJP kunjungan). Ruangan yang belum dipetakan
 * tetapi beraktivitas dilaporkan sebagai peringatan (SP diam-diam membuangnya).
 */
export async function getRl32(input: Rl32Query): Promise<Rl32Result> {
  const { from, to } = input;
  const base = {
    periode: { from, to },
    judulPeriode: judulPeriode(from, to),
    tempatTidur: { tanggal: from, tersedia: false },
    updatedAt: new Date().toISOString(),
  };

  if (!isSimgosConfigured()) {
    return { ...base, instansi: null, baris: [], total: nilaiKosong(), ruangan: [], belumDipetakan: [], pemisahan: [] };
  }

  // Hari perawatan periode berjalan dihitung s.d. hari ini (SP: master.tanggal
  // hanya berisi tanggal yang sudah lewat), bukan s.d. akhir bulan.
  const hariIni = tanggalHariIniWita();
  const [agregat, tempatTidur, ruanganRi, kategori, smf, peta, petaSmf, instansiRow] = await Promise.all([
    queryAgregatRuangan({
      dari: `${from} 00:00:00`,
      sampai: `${to} 23:59:59`,
      awal: from,
      awalBesok: tambahHari(from, 1),
      akhirBesok: tambahHari(to, 1),
      hpAkhirBesok: tambahHari(to < hariIni ? to : hariIni, 1),
    }),
    queryTempatTidur(from),
    queryRuanganRawatInap(),
    kategoriRl32(),
    daftarSmf(),
    bacaPetaTersimpan(),
    bacaPetaSmf(),
    queryInstansiRl32().catch(() => null),
  ]);

  const perSmf = nilaiPerRuanganSmf(agregat);
  const dikenal = new Set(ruanganRi.map((r) => r.id));
  const lain = [...new Set([...perSmf.keys(), ...tempatTidur.keys()])].filter((id) => !dikenal.has(id));
  const ruanganLain = await queryNamaRuangan(lain);
  const namaSmf = new Map(smf.map((x) => [x.id, x.nama]));
  const hasil = susunRl32({ kategori, ruanganRi, ruanganLain, perSmf, tempatTidur, peta, petaSmf, namaSmf });

  // Aturan SMF DPJP yang berlaku (hanya bila ada ruangan ber-pisah DPJP).
  const kategoriById = new Map(kategori.map((k) => [k.id, k]));
  const pemisahan = hasil.ruangan.some((r) => r.pisahDpjp)
    ? [...petaSmf]
        .filter(([, rl]) => kategoriById.has(rl))
        .map(([id, rl]) => ({ smf: { id, nama: namaSmf.get(id) ?? `SMF ${id}` }, kategori: kategoriById.get(rl)! }))
        .sort((a, b) => a.smf.nama.localeCompare(b.smf.nama))
    : [];

  const instansi: InstansiRl32 | null = instansiRow
    ? {
        kodeRs: str(instansiRow.kodeRs),
        nama: str(instansiRow.nama),
        kodeProp: str(instansiRow.kodeProp),
        kota: str(instansiRow.kota),
      }
    : null;

  return { ...base, ...hasil, pemisahan, instansi, tempatTidur: { tanggal: from, tersedia: tempatTidur.size > 0 } };
}

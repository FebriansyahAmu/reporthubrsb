import "server-only";
import { getSimgos } from "@/server/db/simgos.client";
import { SIMGOS_DB } from "@/server/db/simgos-databases";
import { KOMPONEN, type KomponenKey } from "./pendapatan.constants";

/**
 * DAL Laporan Pendapatan per Unit — **READ-ONLY** SIMGOS (HIGH ALERT: hanya
 * SELECT). Hanya `*.dal.ts` yang mengimpor `getSimgos`.
 *
 * Port logika SP `laporan.LaporanPendapatanPerUnit` TANPA mengubah/memanggil SP:
 * tujuh cabang rincian tagihan (tindakan, administrasi, administrasi farmasi,
 * akomodasi, farmasi, paket, O2) dengan tarif master & atribusi ruangan yang
 * SAMA dengan SP. Perbedaan yang disengaja (didokumentasikan):
 *  1. Basis `pembayaran.tagihan` (SEMUA status: 0 batal, 1 belum final, 2 final)
 *     — SP berbasis `pembayaran_tagihan` (hanya tagihan yang sudah dibayar kasir;
 *     2026: 7 dari 4.205 tagihan). Periode = `tagihan.TANGGAL` (tanggal bayar
 *     belum ada untuk tagihan belum final).
 *  2. Butir penjamin/tujuan diambil SATU per episode (subkueri) — SP me-JOIN
 *     langsung sehingga berisiko baris ganda bila ada >1 baris penjamin.
 *  3. Cabang "Penjualan" (penjualan bebas apotek via `pembayaran_tagihan`
 *     JENIS 8, bukan tagihan pasien) tidak di-port: tabel `penjualan.penjualan`
 *     KOSONG (30 Sep 2026). Sebagai pengaman, jumlah transaksinya per periode
 *     dihitung (`queryJumlahPenjualanBebas`) → peringatan bila suatu saat terisi.
 *  4. Cakupan unit (parameter `LAPORAN` = jenis kunjungan di SP) dipilih di
 *     service; query selalu menghitung SEMUA unit leaf sekali per rentang.
 * Butir tagihan dibatalkan (`rincian_tagihan.STATUS = 0`) tetap diabaikan (= SP).
 */

const PB = SIMGOS_DB.PEMBAYARAN;
const PD = SIMGOS_DB.PENDAFTARAN;
const LY = SIMGOS_DB.LAYANAN;
const MS = SIMGOS_DB.MASTER;
const INV = SIMGOS_DB.INVENTORY;
const PJ = SIMGOS_DB.PENJUALAN;
const CAP = "/*+ MAX_EXECUTION_TIME(15000) */";

type Num = number | bigint | string | null;
const num = (v: Num): number => (v == null ? 0 : Number(v));

/* ------------------------------------------------------------------ master */

export type RuanganRow = { id: string; nama: string; aktif: boolean; jenisKunjungan: number };

/** Semua unit leaf (`master.ruangan` JENIS 5) beserta jenis kunjungannya — bahan klasifikasi layanan. */
export async function queryRuanganLeaf(): Promise<RuanganRow[]> {
  const rows = await getSimgos().$queryRawUnsafe<{ id: string; nama: string | null; status: Num; jk: Num }[]>(
    `SELECT r.ID AS id, r.DESKRIPSI AS nama, r.STATUS AS status, r.JENIS_KUNJUNGAN AS jk
       FROM ${MS}.ruangan r
      WHERE r.JENIS = 5
      ORDER BY r.ID`,
  );
  return rows.map((r) => ({
    id: String(r.id),
    nama: r.nama?.trim() || String(r.id),
    aktif: num(r.status) === 1,
    jenisKunjungan: num(r.jk),
  }));
}

/** Referensi cara bayar (`master.referensi` JENIS 10) yang aktif. */
export async function queryCaraBayar(): Promise<{ id: number; label: string }[]> {
  const rows = await getSimgos().$queryRawUnsafe<{ id: Num; label: string | null }[]>(
    `SELECT ID AS id, DESKRIPSI AS label FROM ${MS}.referensi WHERE JENIS = 10 AND STATUS = 1 ORDER BY ID`,
  );
  return rows.map((r) => ({ id: num(r.id), label: r.label?.trim() || `#${String(r.id)}` }));
}

/* --------------------------------------------------------------- pendapatan */

/** Kolom komponen di tabel tarif master (sama dengan nama kolom SP). */
const KOLOM: Record<KomponenKey, string> = {
  administrasi: "ADMINISTRASI",
  sarana: "SARANA",
  bhp: "BHP",
  akomodasi: "AKOMODASI",
  dokterOperator: "DOKTER_OPERATOR",
  dokterAnastesi: "DOKTER_ANASTESI",
  dokterLainnya: "DOKTER_LAINNYA",
  penataAnastesi: "PENATA_ANASTESI",
  paramedis: "PARAMEDIS",
  nonMedis: "NON_MEDIS",
};

type Cabang = {
  /** Penanda cabang SP (komentar SQL). */
  nama: string;
  /** Syarat butir `rincian_tagihan rt` untuk cabang ini. */
  syarat: string;
  /** JOIN tarif master (alias `x`) + jalur atribusi ruangan. */
  join: string;
  /** Ekspresi ID ruangan atribusi. */
  ruangan: string;
  /** Ekspresi nilai per satuan (dikalikan `rt.JUMLAH`); komponen tak tercantum = 0. */
  nilai: Partial<Record<KomponenKey, string>> & { total: string };
};

/** Semua komponen jasa dari tarif ber-rincian (tarif_tindakan / distribusi_tarif_paket). */
const KOMPONEN_JASA = Object.fromEntries(
  KOMPONEN.filter((k) => k.key !== "akomodasi").map((k) => [k.key, `x.${KOLOM[k.key]}`]),
) as Partial<Record<KomponenKey, string>>;

const KUNJUNGAN_REF = `JOIN ${PD}.kunjungan k ON k.NOMOR = rt.REF_ID`;

/** Tujuh cabang SP (minus Penjualan), atribusi ruangan identik dengan SP. */
const CABANG: readonly Cabang[] = [
  {
    nama: "Tindakan",
    syarat: "rt.JENIS = 3",
    join: `JOIN ${MS}.tarif_tindakan x ON x.ID = rt.TARIF_ID
      JOIN ${LY}.tindakan_medis tm ON tm.ID = rt.REF_ID
      JOIN ${PD}.kunjungan k ON k.NOMOR = tm.KUNJUNGAN`,
    ruangan: "k.RUANGAN",
    nilai: { ...KOMPONEN_JASA, total: "x.TARIF" },
  },
  {
    nama: "Administrasi Non Pelayanan Farmasi",
    syarat: "rt.JENIS = 1 AND rt.TARIF_ID NOT IN (3, 4)",
    join: `JOIN ${MS}.tarif_administrasi x ON x.ID = rt.TARIF_ID`,
    ruangan: "tg.tujuan",
    nilai: { administrasi: "x.TARIF", total: "x.TARIF" },
  },
  {
    nama: "Administrasi Pelayanan Farmasi",
    syarat: "rt.JENIS = 1 AND rt.TARIF_ID IN (3, 4)",
    join: `JOIN ${MS}.tarif_administrasi x ON x.ID = rt.TARIF_ID ${KUNJUNGAN_REF}`,
    ruangan: "k.RUANGAN",
    nilai: { administrasi: "x.TARIF", total: "x.TARIF" },
  },
  {
    nama: "Akomodasi",
    syarat: "rt.JENIS = 2",
    join: `JOIN ${MS}.tarif_ruang_rawat x ON x.ID = rt.TARIF_ID ${KUNJUNGAN_REF}`,
    ruangan: "k.RUANGAN",
    nilai: { akomodasi: "x.TARIF", total: "x.TARIF" },
  },
  {
    nama: "Farmasi",
    syarat: "rt.JENIS = 4",
    join: `JOIN ${INV}.harga_barang x ON x.ID = rt.TARIF_ID
      JOIN ${LY}.farmasi f ON f.ID = rt.REF_ID
      JOIN ${PD}.kunjungan k ON k.NOMOR = f.KUNJUNGAN`,
    ruangan: "k.RUANGAN",
    nilai: { bhp: "rt.TARIF", total: "rt.TARIF" },
  },
  {
    nama: "Paket",
    syarat: "rt.JENIS = 5",
    join: `JOIN ${MS}.distribusi_tarif_paket x ON x.ID = rt.TARIF_ID`,
    ruangan: "tg.tujuan",
    nilai: { ...KOMPONEN_JASA, total: "x.TARIF" },
  },
  {
    nama: "O2",
    syarat: "rt.JENIS = 6",
    join: `JOIN ${MS}.tarif_o2 x ON x.ID = rt.TARIF_ID ${KUNJUNGAN_REF}`,
    ruangan: "k.RUANGAN",
    nilai: { sarana: "x.TARIF", total: "x.TARIF" },
  },
];

const kolomNilai = (c: Cabang): string =>
  [
    ...KOMPONEN.map((k) => `${c.nilai[k.key] ? `SUM(${c.nilai[k.key]} * rt.JUMLAH)` : "0"} AS ${k.key}`),
    `SUM(${c.nilai.total} * rt.JUMLAH) AS total`,
  ].join(", ");

/**
 * Satu cabang, sudah DIAGREGASI per (tagihan, ruangan) sebelum UNION: tabel
 * sementara gabungan ±10 rb baris alih-alih ±170 rb baris rincian — semua unit
 * 1 tahun 3,7–5,2 dtk → 2,2–2,4 dtk, hasil identik (diukur 30 Sep 2026).
 */
const cabangSql = (c: Cabang): string => `/* ${c.nama} */
    SELECT tg.ID AS tagihan, tg.STATUS AS status, tg.caraBayar, ${c.ruangan} AS ruangan, ${kolomNilai(c)}
      FROM tg
      JOIN ${PB}.rincian_tagihan rt ON rt.TAGIHAN = tg.ID AND rt.STATUS <> 0 AND ${c.syarat}
      ${c.join}
      JOIN ru ON ru.ID = ${c.ruangan}
     GROUP BY tg.ID, tg.STATUS, tg.caraBayar, ${c.ruangan}`;

/**
 * Satu baris per (tagihan, ruangan) dengan nilai komponen. Basis tagihan pasien
 * (`tagihan.JENIS = 1`) bertanggal di `[from, toExclusive)`, SEMUA status;
 * episode = pendaftaran UTAMA tagihan (aktif diutamakan). Semua unit leaf
 * (JENIS 5) dihitung — terverifikasi seluruh pendapatan teratribusi ke unit leaf.
 */
function pendapatanSql(): string {
  // FORCE INDEX (TANGGAL): tanpa ini optimizer memilih indeks JENIS (memindai semua
  // tagihan pasien) → rencana cabang lebih buruk; RJ 1 tahun 1.177 ms → 185 ms,
  // hasil identik (diukur 30 Sep 2026).
  return `WITH tu AS (
      SELECT t.ID, t.STATUS,
        (SELECT ptp.PENDAFTARAN FROM ${PB}.tagihan_pendaftaran ptp
          WHERE ptp.TAGIHAN = t.ID AND ptp.UTAMA = 1
          ORDER BY ptp.STATUS DESC, ptp.ID DESC LIMIT 1) AS nopen
      FROM ${PB}.tagihan t FORCE INDEX (TANGGAL)
      WHERE t.JENIS = 1 AND t.TANGGAL >= ? AND t.TANGGAL < ?
    ), tg AS (
      SELECT tu.ID, tu.STATUS,
        (SELECT pj.JENIS FROM ${PD}.penjamin pj WHERE pj.NOPEN = tu.nopen ORDER BY pj.ID DESC LIMIT 1) AS caraBayar,
        (SELECT tp.RUANGAN FROM ${PD}.tujuan_pasien tp WHERE tp.NOPEN = tu.nopen LIMIT 1) AS tujuan
      FROM tu
    ), ru AS (
      SELECT r.ID FROM ${MS}.ruangan r WHERE r.JENIS = 5
    )
    SELECT ${CAP} g.tagihan, g.status, g.caraBayar, g.ruangan,
      ${[...KOMPONEN.map((k) => k.key), "total"].map((k) => `CAST(SUM(g.${k}) AS CHAR) AS ${k}`).join(", ")}
    FROM (
    ${CABANG.map(cabangSql).join("\n    UNION ALL\n    ")}
    ) g
    GROUP BY g.tagihan, g.status, g.caraBayar, g.ruangan`;
}

export type PendapatanGrain = {
  tagihan: string;
  /** `tagihan.STATUS` mentah (0/1/2). */
  status: number;
  caraBayar: number | null;
  ruangan: string;
  nilai: Record<KomponenKey | "total", number>;
};

type GrainRaw = { tagihan: string; status: Num; caraBayar: Num; ruangan: string } & Record<KomponenKey | "total", string | null>;

export async function queryPendapatanGrain(from: string, toExclusive: string): Promise<PendapatanGrain[]> {
  const rows = await getSimgos().$queryRawUnsafe<GrainRaw[]>(
    pendapatanSql(),
    `${from} 00:00:00`,
    `${toExclusive} 00:00:00`,
  );
  return rows.map((r) => ({
    tagihan: String(r.tagihan),
    status: num(r.status),
    caraBayar: r.caraBayar == null ? null : num(r.caraBayar),
    ruangan: String(r.ruangan),
    nilai: Object.fromEntries(
      [...KOMPONEN.map((k) => k.key), "total"].map((k) => [k, num(r[k as KomponenKey | "total"])]),
    ) as Record<KomponenKey | "total", number>,
  }));
}

/* ----------------------------------------------------------------- pengaman */

/**
 * Jumlah transaksi penjualan bebas apotek (semua status) di `[from, toExclusive)`
 * — cabang SP yang tidak di-port (tabel kosong saat ditulis). > 0 → laporan
 * Farmasi belum lengkap dan pengguna diperingatkan.
 */
export async function queryJumlahPenjualanBebas(from: string, toExclusive: string): Promise<number> {
  const rows = await getSimgos().$queryRawUnsafe<{ n: Num }[]>(
    `SELECT ${CAP} COUNT(*) AS n FROM ${PJ}.penjualan p WHERE p.TANGGAL >= ? AND p.TANGGAL < ?`,
    `${from} 00:00:00`,
    `${toExclusive} 00:00:00`,
  );
  return num(rows[0]?.n ?? 0);
}

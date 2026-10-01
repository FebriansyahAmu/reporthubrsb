import "server-only";
import {
  cpptPayload,
  resumeMedisPayload,
  sepPayload,
  spriPayload,
  type ReportPayload,
} from "@/server/modules/report/report.registry";
import { querySumberPaket, type FaktaSumberPaket, type LegCppt } from "./paket.dal";
import { KATEGORI_LABEL, LABEL_KOMPONEN, type JenisKomponen, type Kategori } from "./verifikasi.constants";
import { querySepKandidat } from "./verifikasi.dal";
import { pilihSep } from "./verifikasi.service";
import type { KomponenPaket, SnapshotKlaim } from "./verifikasi.types";

/**
 * Registri komponen Paket Klaim (PRD §7.1 — pola strategy). Tiap SUMBER
 * menghasilkan 0..n komponen untuk satu episode dari fakta SIMGOS yang sudah
 * dikumpulkan (tanpa I/O sendiri): tersedia + payload report engine, atau tidak
 * tersedia + alasan. Menambah dokumen paket = menambah satu entri `SUMBER`.
 * Stage V3: report engine SIMGOS saja; dokumen buatan aplikasi & penunjang = V4.
 */

export type KomponenSiap = KomponenPaket & { payload: ReportPayload | null };

type Konteks = {
  nopen: string;
  kategori: Kategori;
  fakta: FaktaSumberPaket;
  sep: SnapshotKlaim["fakta"]["sep"];
};

type Sumber = { jenis: JenisKomponen; kumpulkan: (k: Konteks) => KomponenSiap[] };

const tersedia = (jenis: JenisKomponen, key: string, keterangan: string | null, payload: ReportPayload, label = LABEL_KOMPONEN[jenis]): KomponenSiap => ({
  key, jenis, label, keterangan, tersedia: true, alasan: null, payload,
});
const tidak = (jenis: JenisKomponen, alasan: string): KomponenSiap => ({
  key: jenis, jenis, label: LABEL_KOMPONEN[jenis], keterangan: null, tersedia: false, alasan, payload: null,
});

/** "YYYY-MM-DDTHH:mm:ss" (jam dinding SIMGOS) → "DD/MM/YYYY HH:mm". */
const tgl = (s: string | null) => (s ? `${s.slice(8, 10)}/${s.slice(5, 7)}/${s.slice(0, 4)}${s.length > 10 ? ` ${s.slice(11, 16)}` : ""}` : null);

function labelLeg(leg: LegCppt): string {
  const jenis = leg.jk === 2 ? "IGD" : leg.jk === 3 ? "Rawat Inap" : leg.jk === 1 ? "Rawat Jalan" : "Kunjungan";
  return `CPPT — ${leg.ruang ?? jenis}`;
}

const SUMBER: readonly Sumber[] = [
  {
    jenis: "sep",
    kumpulkan: ({ sep, kategori }) => [
      sep
        ? tersedia("sep", "sep", `No. ${sep.nomor} · tgl ${tgl(sep.tanggal)}`, sepPayload(sep.nomor))
        : tidak("sep", `SEP ${KATEGORI_LABEL[kategori]} tidak ditemukan di SIMRS`),
    ],
  },
  {
    jenis: "resume-medis",
    // Report Resume Medis tetap menghasilkan PDF walau resume kosong → cek datanya dulu.
    kumpulkan: ({ nopen, fakta }) => [
      fakta.resume > 0
        ? tersedia("resume-medis", "resume-medis", null, resumeMedisPayload(nopen))
        : tidak("resume-medis", "Resume medis belum diisi di SIMRS"),
    ],
  },
  {
    jenis: "spri",
    kumpulkan: ({ kategori, fakta }) =>
      kategori !== "RI"
        ? []
        : [
            fakta.spri
              ? tersedia("spri", "spri", fakta.spri.nomor ? `No. ${fakta.spri.nomor}` : null, spriPayload(fakta.spri.kunjungan))
              : tidak("spri", "SPRI untuk rawat inap ini tidak ditemukan di SIMRS"),
          ],
  },
  {
    jenis: "cppt",
    // Report CPPT mencetak per leg → satu komponen per leg ber-CPPT (IGD asal dulu).
    kumpulkan: ({ fakta }) =>
      fakta.cppt.length === 0
        ? [tidak("cppt", "CPPT belum ada di SIMRS")]
        : fakta.cppt.map((leg) =>
            tersedia(
              "cppt",
              `cppt-${leg.kunjungan}`,
              [leg.asal ? `IGD asal (NOPEN ${leg.nopen})` : null, `${leg.n} catatan`, leg.masuk ? `masuk ${tgl(leg.masuk)}` : null]
                .filter(Boolean)
                .join(" · "),
              cpptPayload(leg.nopen, leg.kunjungan),
              labelLeg(leg),
            ),
          ),
  },
];

/**
 * Komponen paket satu episode — READ-ONLY SIMGOS, 2 query berurutan (sumber
 * paket + kandidat SEP). SEP dipilih dengan aturan yang sama seperti snapshot
 * verifikasi (jenis pelayanan sesuai kategori, tglSEP terdekat). Urutan hasil =
 * urutan bawaan paket; yang tidak tersedia ikut dengan alasannya.
 */
export async function kumpulkanKomponen(nopen: string, kategori: Kategori): Promise<KomponenSiap[]> {
  const fakta = await querySumberPaket(nopen);
  const sep = pilihSep((await querySepKandidat([nopen])).get(nopen), kategori);
  const ctx: Konteks = { nopen, kategori, fakta, sep };
  return SUMBER.flatMap((s) => s.kumpulkan(ctx));
}

/** Tanpa payload (untuk dikirim ke client). */
export const tanpaPayload = (k: KomponenSiap): KomponenPaket => ({
  key: k.key,
  jenis: k.jenis,
  label: k.label,
  keterangan: k.keterangan,
  tersedia: k.tersedia,
  alasan: k.alasan,
});

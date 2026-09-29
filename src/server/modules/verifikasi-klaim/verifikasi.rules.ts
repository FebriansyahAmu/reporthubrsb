/**
 * KATALOG ATURAN verifikasi klaim — sumber tunggal di kode (pola sama dengan
 * katalog RBAC). Menambah pemeriksaan = menambah satu entri, tanpa migrasi DB.
 *
 * Setiap `cek` MURNI (tanpa I/O): menerima SnapshotKlaim, mengembalikan
 * { lolos, pesan } atau `null` bila tidak relevan untuk episode ini (mis.
 * penunjang tanpa order). AMAN untuk client. PRD §5.1 (matriks W/O perlu
 * disahkan Casemix / Komite RM — keputusan §11-4).
 */
import type { Kategori, PenanggungJawab } from "./verifikasi.constants";
import type { HasilAturan, HasilCek, Keharusan, SnapshotKlaim } from "./verifikasi.types";

type HasilMentah = { lolos: boolean; pesan: string; /** Gagal ringan → selalu peringatan. */ ringan?: boolean };

export type Aturan = {
  key: string;
  tahap: 1 | 2;
  label: string;
  /** Keharusan per jenis layanan; kategori yang tak tercantum = tidak berlaku. */
  berlaku: Partial<Record<Kategori, Keharusan>>;
  pj: PenanggungJawab;
  cek: (s: SnapshotKlaim) => HasilMentah | null;
};

const ya = (pesan: string): HasilMentah => ({ lolos: true, pesan });
const tidak = (pesan: string, ringan = false): HasilMentah => ({ lolos: false, pesan, ringan });

/* --------------------------------------------- Tahap 1 — Kelengkapan RM */

export const ATURAN_TAHAP1: readonly Aturan[] = [
  {
    key: "sep",
    tahap: 1,
    label: "SEP",
    berlaku: { RI: "W", IGD: "W", RJ: "W" },
    pj: "ADMISI",
    cek: ({ fakta, kategori }) =>
      fakta.sep
        ? ya(`SEP ${fakta.sep.nomor}`)
        : tidak(`SEP ${kategori === "RI" ? "Rawat Inap" : "Rawat Jalan"} tidak ditemukan untuk tanggal episode`),
  },
  {
    key: "diagnosa",
    tahap: 1,
    label: "Diagnosa ICD-10",
    berlaku: { RI: "W", IGD: "W", RJ: "W" },
    pj: "DPJP",
    cek: ({ fakta: { diagnosa } }) => {
      if (diagnosa.total === 0) return tidak("Belum ada diagnosa ICD-10");
      if (diagnosa.primer === 0) return tidak(`${diagnosa.total} diagnosa, belum ada diagnosa primer`);
      return ya(`${diagnosa.total} diagnosa, primer ada`);
    },
  },
  {
    key: "resume",
    tahap: 1,
    label: "Resume Medis",
    berlaku: { RI: "W", RJ: "O" },
    pj: "DPJP",
    cek: ({ fakta }) => (fakta.resume > 0 ? ya("Resume medis terisi") : tidak("Resume medis belum diisi")),
  },
  {
    key: "cppt",
    tahap: 1,
    label: "CPPT",
    berlaku: { RI: "W", IGD: "W", RJ: "O" },
    pj: "PERAWAT",
    cek: ({ fakta: { cppt } }) => (cppt.total > 0 ? ya(`${cppt.total} catatan CPPT`) : tidak("CPPT belum ada")),
  },
  {
    key: "verif-cppt",
    tahap: 1,
    label: "Verifikasi CPPT oleh DPJP",
    berlaku: { RI: "W" },
    pj: "DPJP",
    cek: ({ fakta: { cppt } }) => {
      if (cppt.total === 0) return null; // tanpa CPPT → ditangani aturan `cppt`
      if (cppt.verifikasi === 0) return tidak("CPPT belum pernah diverifikasi DPJP");
      if (cppt.belumVerif > 0) {
        return tidak(`${cppt.belumVerif} catatan CPPT setelah verifikasi terakhir belum diverifikasi`, true);
      }
      return ya("Seluruh CPPT sudah diverifikasi DPJP");
    },
  },
  {
    key: "triase",
    tahap: 1,
    label: "Triase IGD",
    berlaku: { IGD: "W", RI: "W" },
    pj: "IGD",
    cek: ({ fakta, kategori }) => {
      // RI: hanya bila masuk lewat IGD — triase IGD asal ikut paket klaim RI.
      const n = kategori === "RI" ? fakta.asal?.triase : fakta.triase;
      if (n == null) return null;
      const asal = kategori === "RI" ? " (IGD asal)" : "";
      return n > 0 ? ya(`Triase terisi${asal}`) : tidak(`Triase belum diisi${asal}`);
    },
  },
  {
    key: "spri",
    tahap: 1,
    label: "SPRI",
    berlaku: { RI: "W" },
    pj: "IGD",
    cek: ({ fakta }) => (fakta.spri > 0 ? ya("Surat Perintah Rawat Inap ada") : tidak("SPRI tidak ditemukan")),
  },
  {
    key: "pulang",
    tahap: 1,
    label: "Data Pasien Pulang",
    berlaku: { RI: "W", IGD: "O" },
    pj: "PERAWAT",
    cek: ({ fakta }) =>
      fakta.pulang?.cara ? ya("Cara & keadaan pulang tercatat") : tidak("Data pasien pulang belum diisi"),
  },
  {
    key: "penunjang",
    tahap: 1,
    label: "Hasil Penunjang Final",
    berlaku: { RI: "W", IGD: "W", RJ: "W" },
    pj: "PENUNJANG",
    cek: ({ fakta: { penunjang: p } }) => {
      if (p.lab + p.rad === 0) return null; // tanpa order penunjang → tidak berlaku
      if (p.labBelum + p.radBelum === 0) return ya(`${p.lab + p.rad} hasil penunjang final`);
      const bagian = [
        p.labBelum > 0 ? `${p.labBelum} lab` : null,
        p.radBelum > 0 ? `${p.radBelum} radiologi` : null,
      ].filter(Boolean);
      return tidak(`Hasil belum final: ${bagian.join(", ")}`);
    },
  },
  {
    key: "tagihan",
    tahap: 1,
    label: "Tagihan",
    berlaku: { RI: "W", IGD: "W", RJ: "W" },
    pj: "KASIR",
    cek: ({ fakta }) => (fakta.tagihan ? ya("Tagihan ada") : tidak("Tagihan tidak ditemukan")),
  },
  {
    key: "bukti",
    tahap: 1,
    label: "Bukti Pelayanan",
    berlaku: { RI: "W", IGD: "O", RJ: "O" },
    pj: "KEPALA_RUANGAN",
    cek: ({ fakta }) => (fakta.bukti ? ya("Bukti Pelayanan sudah diisi") : tidak("Bukti Pelayanan belum diisi")),
  },
];

const BY_KEY = new Map(ATURAN_TAHAP1.map((a) => [a.key, a]));

export function getAturan(key: string): Aturan | undefined {
  return BY_KEY.get(key);
}

/* ---------------------------------------------------------------- evaluasi */

/** Jalankan katalog terhadap satu snapshot. Urutan hasil = urutan katalog. */
export function evaluasi(s: SnapshotKlaim, katalog: readonly Aturan[] = ATURAN_TAHAP1): HasilCek {
  const hasil: HasilAturan[] = [];
  for (const a of katalog) {
    const keharusan = a.berlaku[s.kategori];
    if (!keharusan) continue;
    const r = a.cek(s);
    if (!r) continue;
    const status = r.lolos ? "lolos" : keharusan === "W" && !r.ringan ? "gagal" : "peringatan";
    hasil.push({ key: a.key, label: a.label, status, keharusan, pesan: r.pesan, pj: a.pj });
  }
  const gagal = hasil.filter((h) => h.status === "gagal").length;
  const peringatan = hasil.filter((h) => h.status === "peringatan").length;
  return {
    tahap: katalog[0]?.tahap ?? 1,
    hasil,
    lolos: hasil.length - gagal - peringatan,
    gagal,
    peringatan,
    total: hasil.length,
    lengkap: gagal === 0,
  };
}

/** Masalah (gagal dulu, lalu peringatan) — untuk chip daftar & tindak lanjut. */
export function masalahDari(cek: HasilCek): HasilAturan[] {
  const rank = { gagal: 0, peringatan: 1, lolos: 2 } as const;
  return cek.hasil.filter((h) => h.status !== "lolos").sort((a, b) => rank[a.status] - rank[b.status]);
}

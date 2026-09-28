import "server-only";
import { formatLama } from "@/lib/format";
import { SEL_LABEL, type SelStatus } from "./kepatuhan";
import {
  JENIS_RAWAT_INAP,
  KATEGORI,
  KATEGORI_KEYS,
  SHIFTS,
  STATUS_KUNJUNGAN_LABEL,
  SUMBER,
  TARGET_RI,
  type KategoriKey,
} from "./kunjungan.constants";
import type { KunjunganCard, KunjunganSemua } from "./kunjungan.service";
import type { KunjunganDetail, LogJenis } from "./jejak.service";
import type { KonteksEkspor } from "./ekspor.petugas";
import {
  nadaPersen,
  rentangTeks,
  TEMPAT_TTD,
  tglPanjang,
  waktuTeks,
  type Dokumen,
  type Kolom,
  type Lembar,
  type Nada,
  type Sel,
} from "./ekspor.dokumen";

/**
 * Ekspor per KUNJUNGAN (K5): daftar kunjungan papan (semua baris filter) dan
 * jejak satu kunjungan (dokumen bukti: matriks 24 jam, data aktual + pelaku
 * pembatalan, rekap petugas, log). Data = `semuaKunjungan` / `getKunjunganDetail`.
 */

const TTD = (ctx: Pick<KonteksEkspor, "hariIni" | "oleh">) => ({
  place: TEMPAT_TTD,
  date: tglPanjang(ctx.hariIni),
  columns: [{ caption: "Mengetahui,", nip: "" }, { caption: "Dibuat oleh,", name: ctx.oleh }],
});

/** Sel jumlah input kategori seperti pip kartu: kosong-wajib = merah, asesmen rujukan = "IGD"/"RJ". */
function selKategori(k: KunjunganCard, key: KategoriKey): Sel {
  const s = k.kategori[key];
  const wajib = k.kelengkapan.wajib.includes(key);
  if (s.aktif === 0 && s.rujukan) return { v: s.rujukan.jenisShort, nada: "biruLembut" };
  return { v: s.aktif, nada: wajib && s.aktif === 0 ? "merahLembut" : null };
}

const kurangTeks = (k: KunjunganCard) =>
  k.kelengkapan.wajib.filter((w) => !k.kelengkapan.terpenuhi.includes(w)).map((w) => KATEGORI[w].label).join(", ");

const rujukanTeks = (k: KunjunganCard) => {
  const r = k.kategori.ASESMEN.rujukan;
  return r ? `${r.jenisShort} ${r.ruangan} · masuk ${waktuTeks(r.masuk)} (${r.jamSebelum} jam sebelum)` : null;
};

/* --------------------------------------------------------- daftar kunjungan */

export type OpsiKunjungan = { aktif?: boolean; batal?: boolean; cari?: boolean };

export function dokumenDaftarKunjungan(d: KunjunganSemua, ctx: KonteksEkspor & { opsi: OpsiKunjungan }): Dokumen {
  const wajib = d.items.reduce((s, k) => s + k.kelengkapan.wajib.length, 0);
  const terpenuhi = d.items.reduce((s, k) => s + k.kelengkapan.terpenuhi.length, 0);
  const rata = wajib ? Math.round((terpenuhi / wajib) * 100) : null;
  const opsi = [
    ctx.opsi.aktif ? "hanya sedang dilayani" : null,
    ctx.opsi.batal ? "termasuk kunjungan batal" : null,
    ctx.opsi.cari ? "dengan pencarian pasien" : null,
  ].filter(Boolean);

  const daftar: Lembar = {
    nama: "Kunjungan",
    judul: "Daftar kunjungan & kelengkapan input",
    tabel: [
      {
        kolom: [
          { judul: "Masuk", lebar: 16, pdf: 62, fmt: "waktu" },
          { judul: "Keluar", lebar: 16, fmt: "waktu" },
          { judul: "Pasien", lebar: 26, pdf: 112 },
          { judul: "No. RM", lebar: 10, pdf: 42, fmt: "kode" },
          { judul: "JK", lebar: 4, rata: "tengah" },
          { judul: "Umur", lebar: 6, fmt: "angka" },
          { judul: "Jenis", lebar: 7, pdf: 32, rata: "tengah" },
          { judul: "Ruangan", lebar: 26, pdf: 100 },
          { judul: "Status", lebar: 14, pdf: 50 },
          { judul: "Hari rawat", lebar: 8, fmt: "angka" },
          ...KATEGORI_KEYS.map((key): Kolom => ({ judul: KATEGORI[key].short, lebar: 7, pdf: 30, fmt: "angka", rata: "tengah" })),
          { judul: "Batal", lebar: 7, pdf: 32, fmt: "angka" },
          { judul: "Petugas", lebar: 8, pdf: 44, fmt: "angka" },
          { judul: "Kelengkapan", lebar: 11, pdf: 62, fmt: "persen", rata: "tengah" },
          { judul: "Kategori belum terisi", lebar: 32, pdf: 83, bungkus: true },
          { judul: "Asesmen dipenuhi dari (≤ 48 jam)", lebar: 36 },
          { judul: "Petugas per profesi", lebar: 30 },
          { judul: "No. kunjungan", lebar: 22, fmt: "kode" },
          { judul: "No. pendaftaran", lebar: 12, fmt: "kode" },
        ],
        baris: d.items.map((k) => [
          k.masuk,
          k.keluar,
          { v: k.pasien.nama ?? "Tanpa nama", coret: k.status === "BATAL" },
          k.norm,
          k.pasien.jenisKelamin,
          k.pasien.umur,
          k.jenis.short,
          k.ruangan.nama,
          { v: STATUS_KUNJUNGAN_LABEL[k.status], nada: k.status === "BATAL" ? "merahLembut" : null },
          k.hariRawat,
          ...KATEGORI_KEYS.map((key) => selKategori(k, key)),
          { v: k.totalBatal, nada: k.totalBatal ? "merahLembut" : null },
          k.petugas.total,
          { v: k.kelengkapan.persen, nada: nadaPersen(k.kelengkapan.persen), tebal: true },
          kurangTeks(k) || (k.kelengkapan.wajib.length ? "Lengkap" : "Tidak berlaku"),
          rujukanTeks(k),
          k.petugas.profesi.map((p) => `${p.label} ${p.n}`).join(" · ") || null,
          k.nomor,
          k.nopen,
        ]),
        total: [
          "Total",
          null,
          `${d.items.length} kunjungan`,
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          ...KATEGORI_KEYS.map((key) => d.items.reduce((s, k) => s + k.kategori[key].aktif, 0)),
          d.items.reduce((s, k) => s + k.totalBatal, 0),
          null,
          rata,
          `${terpenuhi} dari ${wajib} kategori wajib terisi`,
        ],
        catatan:
          "Angka kategori = input AKTIF (Tindakan tanpa item tarif; Diagnosis per episode). Merah = kategori wajib belum terisi; IGD/RJ = asesmen Rawat Inap dipenuhi dari IGD/RJ ≤ 48 jam sebelum masuk.",
      },
    ],
  };

  return {
    judul: "Daftar Kunjungan & Kelengkapan Pengimputan RME",
    meta: [
      `Rentang: ${rentangTeks(d.range.from, d.range.to)} · Lokasi: ${ctx.lokasi}${opsi.length ? ` · ${opsi.join(", ")}` : ""}`,
      `${d.summary.total} kunjungan · ${d.summary.aktif} sedang dilayani · ${d.summary.batal} batal · kelengkapan keseluruhan ${rata ?? "—"}%`,
      "Kunjungan dalam rentang = masuk pada rentang, atau Rawat Inap yang masih dirawat saat rentang dimulai.",
    ],
    lembar: [daftar],
    ttd: TTD(ctx),
    berkas: `Kunjungan_${d.range.from}_${d.range.to}`,
    jumlah: d.items.length,
    ringkasan: `${rentangTeks(d.range.from, d.range.to)} · ${ctx.lokasi}${opsi.length ? ` · ${opsi.join(", ")}` : ""} · ${d.items.length} kunjungan`,
  };
}

/* ------------------------------------------------------------ jejak kunjungan */

const NADA_STATUS: Record<SelStatus, Nada | null> = { OK: "hijauLembut", KURANG: "merahLembut", PARSIAL: "abu", NANTI: "abu", LUAR: null };
const statusSel = (s: SelStatus): Sel => ({ v: SEL_LABEL[s].split(" —")[0], nada: NADA_STATUS[s] });
const LOG_LABEL: Record<LogJenis, string> = { PENAMBAHAN: "Penambahan", PERUBAHAN: "Perubahan", PEMBATALAN: "Pembatalan" };
const persenDari = (ok: number, n: number) => (n ? Math.round((ok / n) * 100) : null);

export function dokumenJejakKunjungan(d: KunjunganDetail, ctx: Pick<KonteksEkspor, "hariIni" | "oleh">): Dokumen {
  const k = d.card;
  const nama = (id: string | null) => (id ? (d.petugas[id]?.nama ?? `Petugas #${id}`) : "—");
  const profesi = (id: string | null) => (id ? (d.petugas[id]?.profesiLabel ?? null) : null);
  const ri = k.jenis.id === JENIS_RAWAT_INAP && !!d.matriks;

  const identitas: Sel[][] = [
    ["Pasien", { v: k.pasien.nama ?? "Tanpa nama", tebal: true }],
    ["No. RM", k.norm],
    ["Jenis kelamin / umur", `${k.pasien.jenisKelamin ?? "—"} / ${k.pasien.umur ?? "?"} th`],
    ["Jenis layanan", k.jenis.label],
    ["Ruangan", k.ruangan.grupNama && k.ruangan.grupNama !== k.ruangan.nama ? `${k.ruangan.nama} (${k.ruangan.grupNama})` : k.ruangan.nama],
    ["Masuk", waktuTeks(k.masuk)],
    ["Keluar", k.keluar ? waktuTeks(k.keluar) : "Masih dilayani"],
    ["Status kunjungan", { v: STATUS_KUNJUNGAN_LABEL[k.status], nada: k.status === "BATAL" ? "merahLembut" : null }],
    ...(k.jenis.id === JENIS_RAWAT_INAP ? [["Hari rawat", `${k.hariRawat} hari`] as Sel[]] : []),
    ["No. kunjungan / pendaftaran", `${k.nomor} / ${k.nopen}`],
    ["Petugas penginput", `${k.petugas.total} orang${k.petugas.profesi.length ? ` — ${k.petugas.profesi.map((p) => `${p.label} ${p.n}`).join(" · ")}` : ""}`],
    [
      "Kelengkapan kategori wajib",
      {
        v: k.kelengkapan.persen == null ? "Tidak berlaku" : `${k.kelengkapan.persen}% (${k.kelengkapan.terpenuhi.length}/${k.kelengkapan.wajib.length})`,
        nada: nadaPersen(k.kelengkapan.persen),
      },
    ],
  ];

  const ringkasan: Lembar = {
    nama: "Ringkasan",
    judul: "Ringkasan kunjungan",
    tabel: [
      {
        judul: "Identitas",
        kolom: [
          { judul: "Uraian", lebar: 28, pdf: 170 },
          { judul: "Keterangan", lebar: 64, pdf: 420 },
        ],
        baris: identitas,
      },
      {
        judul: "Input per kategori",
        kolom: [
          { judul: "Kategori", lebar: 16, pdf: 100 },
          { judul: "Wajib", lebar: 8, pdf: 45, rata: "tengah" },
          { judul: "Input aktif", lebar: 10, pdf: 60, fmt: "angka" },
          { judul: "Dibatalkan", lebar: 10, pdf: 60, fmt: "angka" },
          { judul: "Petugas", lebar: 9, pdf: 50, fmt: "angka" },
          { judul: "Keterangan", lebar: 56, pdf: 330, bungkus: true },
        ],
        baris: KATEGORI_KEYS.map((key) => {
          const s = k.kategori[key];
          const wajib = k.kelengkapan.wajib.includes(key);
          return [
            KATEGORI[key].label,
            wajib ? "Ya" : "—",
            selKategori(k, key),
            { v: s.batal, nada: s.batal ? "merahLembut" : null },
            s.petugas,
            key === "ASESMEN" && s.rujukan
              ? `Dipenuhi dari ${rujukanTeks(k)}`
              : key === "DIAGNOSIS"
                ? "Dicatat per episode (bisa dari leg kunjungan lain)."
                : key === "TINDAKAN"
                  ? "Tanpa item tarif."
                  : null,
          ];
        }),
      },
      ...(ri
        ? [
            {
              judul: "Kepatuhan target harian Rawat Inap",
              kolom: [
                { judul: "Target", lebar: 36, pdf: 220 },
                { judul: "Terpenuhi", lebar: 10, pdf: 60, fmt: "angka" },
                { judul: "Dinilai", lebar: 10, pdf: 60, fmt: "angka" },
                { judul: "Kepatuhan", lebar: 11, pdf: 60, fmt: "persen", rata: "tengah" },
              ] satisfies Kolom[],
              baris: ((m) => [
                [`CPPT keperawatan ≥ ${TARGET_RI.cpptPerawatPerShift} per shift`, m.shiftOk, m.shiftDinilai, persenSelOf(m.shiftOk, m.shiftDinilai)],
                [`Visite dokter ≥ ${TARGET_RI.cpptDokterPerHari} per hari dinas`, m.dokterOk, m.hariDinilai, persenSelOf(m.dokterOk, m.hariDinilai)],
                [`TTV ≥ ${TARGET_RI.ttvPerHari} per hari dinas`, m.ttvOk, m.hariDinilai, persenSelOf(m.ttvOk, m.hariDinilai)],
              ])(d.matriks!.ringkasan),
              total: [
                "Seluruh target",
                d.matriks!.ringkasan.shiftOk + d.matriks!.ringkasan.dokterOk + d.matriks!.ringkasan.ttvOk,
                d.matriks!.ringkasan.shiftDinilai + d.matriks!.ringkasan.hariDinilai * 2,
                { v: d.matriks!.ringkasan.persen, nada: nadaPersen(d.matriks!.ringkasan.persen) },
              ],
              catatan: "Hanya shift/hari dinas yang utuh dalam masa rawat & sudah lewat yang dinilai (hari dinas 07.00–07.00).",
            },
          ]
        : []),
    ],
  };

  const matriks: Lembar[] = ri
    ? [
        {
          nama: "Matriks 24 jam",
          judul: "Matriks hari dinas × shift",
          tabel: [
            {
              kolom: [
                { judul: "Hari ke-", lebar: 7, pdf: 36, fmt: "angka", rata: "tengah" },
                { judul: "Hari dinas", lebar: 12, pdf: 58, fmt: "tanggal" },
                ...SHIFTS.flatMap((s): Kolom[] => [
                  { judul: `${s.label} (CPPT kep.)`, lebar: 15, pdf: 64, rata: "tengah" },
                  { judul: `CPPT ${s.label}`, lebar: 8, pdf: 34, fmt: "angka" },
                ]),
                { judul: "Visite dokter", lebar: 15, pdf: 64, rata: "tengah" },
                { judul: "CPPT dokter", lebar: 8, pdf: 36, fmt: "angka" },
                { judul: `TTV ≥ ${TARGET_RI.ttvPerHari}`, lebar: 15, pdf: 64, rata: "tengah" },
                { judul: "Jumlah TTV", lebar: 8, pdf: 36, fmt: "angka" },
                { judul: "Asesmen", lebar: 8, pdf: 44, fmt: "angka" },
                { judul: "Tindakan", lebar: 8, pdf: 46, fmt: "angka" },
                { judul: "Petugas", lebar: 8, pdf: 38, fmt: "angka" },
                { judul: "Batal", lebar: 7, pdf: 32, fmt: "angka" },
              ],
              baris: d.matriks!.hari.map((h) => [
                h.hariKe,
                h.tanggal,
                ...h.shifts.flatMap((c): Sel[] => [statusSel(c.status), c.cpptKeperawatan]),
                statusSel(h.dokterStatus),
                h.cpptDokter,
                statusSel(h.ttvStatus),
                h.ttv,
                h.asesmen,
                h.tindakan,
                h.petugas.length,
                { v: h.batal, nada: h.batal ? "merahLembut" : null },
              ]),
              catatan: `${SHIFTS.map((s) => `${s.label} ${String(s.start).padStart(2, "0")}–${String(s.end).padStart(2, "0")}`).join(" · ")}. Status: ${(["OK", "KURANG", "PARSIAL", "NANTI", "LUAR"] as const).map((s) => SEL_LABEL[s]).join(" · ")}.${d.matriks!.terpotong ? " Matriks dipotong (masa rawat sangat panjang)." : ""}`,
            },
          ],
        },
      ]
    : [];

  const aktual: Lembar = {
    nama: "Data aktual",
    judul: "Data aktual (aktif & batal)",
    tabel: [
      {
        kolom: [
          { judul: "Waktu", lebar: 16, pdf: 62, fmt: "waktu" },
          { judul: "Kategori", lebar: 12, pdf: 50 },
          { judul: "Sumber", lebar: 18, pdf: 72 },
          { judul: "Ringkasan", lebar: 40, pdf: 150, bungkus: true },
          { judul: "Petugas", lebar: 26, pdf: 100 },
          { judul: "Profesi", lebar: 12, pdf: 50 },
          { judul: "Peran CPPT", lebar: 12 },
          { judul: "Status", lebar: 9, pdf: 40, rata: "tengah" },
          { judul: "Dibatalkan oleh", lebar: 26, pdf: 90 },
          { judul: "Waktu pembatalan", lebar: 16, pdf: 62, fmt: "waktu" },
          { judul: "Waktu simpan (TTV)", lebar: 16, fmt: "waktu" },
          { judul: "Terlambat (menit)", lebar: 10, fmt: "angka" },
          { judul: "Catatan", lebar: 40, pdf: 90, bungkus: true },
          { judul: "Aturan item tarif", lebar: 34 },
          { judul: "Diubah (kali)", lebar: 8, fmt: "angka" },
          { judul: "ID record", lebar: 14, fmt: "kode" },
        ],
        baris: d.records.map((r) => [
          r.waktu,
          KATEGORI[r.kategori].label,
          SUMBER[r.sumber].label,
          r.ringkasan,
          nama(r.oleh),
          profesi(r.oleh),
          r.peran,
          { v: r.batal ? "Batal" : "Aktif", nada: r.batal ? "merahLembut" : null },
          r.batal ? (r.batalOleh ? nama(r.batalOleh.oleh) : "Pelaku tidak tercatat") : null,
          r.batalOleh?.ts ?? null,
          r.waktuInput,
          r.terlambatMenit,
          [
            r.tarif ? "Item tarif — tidak dihitung" : null,
            r.terlambatMenit != null ? `TTV diinput ${formatLama(r.terlambatMenit)} setelah pemeriksaan` : null,
            r.peringatan,
            r.episode ? "Diagnosis per episode" : null,
            r.edit ? `${r.edit}× diubah` : null,
          ]
            .filter(Boolean)
            .join(" · ") || null,
          r.tarif,
          r.edit,
          r.id,
        ]),
        catatan: "Batal = STATUS 0; pelaku & waktu pembatalan dari log akses SIMGOS (perubahan STATUS → 0 terbaru).",
      },
    ],
  };

  const petugas: Lembar = {
    nama: "Petugas",
    judul: "Rekap petugas penginput",
    tabel: [
      {
        kolom: [
          { judul: "Petugas", lebar: 28, pdf: 140 },
          { judul: "Profesi", lebar: 14, pdf: 64 },
          ...KATEGORI_KEYS.map((key): Kolom => ({ judul: KATEGORI[key].short, lebar: 7, pdf: 36, fmt: "angka" })),
          { judul: "Total klinis", lebar: 10, pdf: 46, fmt: "angka" },
          { judul: "Batal", lebar: 7, pdf: 36, fmt: "angka" },
          { judul: "Item tarif", lebar: 9, pdf: 44, fmt: "angka" },
          { judul: "Input pertama", lebar: 16, pdf: 66, fmt: "waktu" },
          { judul: "Input terakhir", lebar: 16, pdf: 66, fmt: "waktu" },
        ],
        baris: d.petugasRekap.map((p) => [
          nama(p.id),
          profesi(p.id),
          ...KATEGORI_KEYS.map((key) => p.perKategori[key]),
          p.total,
          { v: p.batal, nada: p.batal ? "merahLembut" : null },
          p.tarif,
          p.pertama,
          p.terakhir,
        ]),
      },
    ],
  };

  const log: Lembar = {
    nama: "Log",
    judul: "Log perubahan record kunjungan",
    tabel: [
      {
        kolom: [
          { judul: "Waktu", lebar: 16, pdf: 66, fmt: "waktu" },
          { judul: "Jenis", lebar: 13, pdf: 66 },
          { judul: "Oleh", lebar: 28, pdf: 140 },
          { judul: "Profesi", lebar: 14, pdf: 64 },
          { judul: "Sumber", lebar: 18, pdf: 90 },
          { judul: "ID record", lebar: 14, pdf: 70, fmt: "kode" },
          { judul: "ID log", lebar: 17, pdf: 90, fmt: "kode" },
        ],
        baris: d.logs.map((l) => [
          l.ts,
          { v: LOG_LABEL[l.jenis], nada: l.jenis === "PEMBATALAN" ? "merahLembut" : null },
          nama(l.oleh),
          profesi(l.oleh),
          SUMBER[l.sumber].label,
          l.ref,
          l.logId,
        ]),
        catatan: d.logTerpotong ? "Log sangat banyak — hanya sebagian terbaru yang dimuat." : "SIMGOS hanya mencatat penambahan & perubahan; penambahan tidak selalu tercatat (lihat PRD Fase 2 §2.1).",
      },
    ],
  };

  return {
    judul: "Jejak Pengimputan RME — Kunjungan Pasien",
    meta: [
      `Pasien: ${k.pasien.nama ?? "Tanpa nama"} · RM ${k.norm} · ${k.jenis.label} · ${k.ruangan.nama}`,
      `Kunjungan ${k.nomor} · masuk ${waktuTeks(k.masuk)} → ${k.keluar ? `keluar ${waktuTeks(k.keluar)}` : "masih dilayani"}`,
      "Sumber: data aktual SIMGOS (read-only, kolom OLEH = penginput); pelaku pembatalan & riwayat ubah dari log akses SIMGOS.",
    ],
    lembar: [ringkasan, ...matriks, aktual, petugas, log],
    ttd: TTD(ctx),
    berkas: `Jejak-Kunjungan_${k.nomor}`,
    jumlah: d.records.length,
    ringkasan: `Kunjungan ${k.nomor} · ${k.jenis.label} · ${k.ruangan.nama} · ${d.records.length} record`,
  };
}

function persenSelOf(ok: number, n: number): Sel {
  const p = persenDari(ok, n);
  return { v: p, nada: nadaPersen(p) };
}

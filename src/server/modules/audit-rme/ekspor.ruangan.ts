import "server-only";
import { SEL_LABEL, type SelStatus } from "./kepatuhan";
import { KATEGORI, SHIFTS, TARGET_RI } from "./kunjungan.constants";
import type { PetaItem, PetaRuangan } from "./peta.service";
import type { KonteksEkspor } from "./ekspor.petugas";
import {
  hariTeks,
  nadaPersen,
  PITA_KETERANGAN,
  rentangTeks,
  TEMPAT_TTD,
  tglPanjang,
  type Dokumen,
  type Kolom,
  type Lembar,
  type Nada,
  type Sel,
} from "./ekspor.dokumen";

/**
 * Ekspor Peta Ruangan (K5): ringkasan per ruang, matriks ruang × hari berwarna
 * (sama dengan heatmap), dan rincian per pasien (Excel). Data = `getPetaRuangan`.
 */

const NADA_STATUS: Record<SelStatus, Nada | null> = { OK: "hijauLembut", KURANG: "merahLembut", PARSIAL: "abu", NANTI: "abu", LUAR: null };
const statusSel = (s: SelStatus): Sel => ({ v: SEL_LABEL[s].split(" —")[0], nada: NADA_STATUS[s] });
const persenSel = (p: number | null): Sel => ({ v: p, nada: nadaPersen(p), tebal: true });

export function dokumenPetaRuangan(d: PetaRuangan, ctx: Omit<KonteksEkspor, "lokasi">): Dokumen {
  const ri = d.metrik === "HARIAN_RI";
  const ukuran = ri ? "Kepatuhan" : "Kelengkapan";

  const ringkasan: Lembar = {
    nama: "Ringkasan per ruang",
    judul: `${ukuran} per ruang`,
    tabel: [
      {
        kolom: [
          { judul: "Ruang", lebar: 30, pdf: 170 },
          { judul: "Bangsal", lebar: 24, pdf: 130 },
          { judul: `${ukuran} (%)`, lebar: 12, pdf: 62, fmt: "persen", rata: "tengah" },
          { judul: "Target terpenuhi", lebar: 11, pdf: 60, fmt: "angka" },
          { judul: "Target dinilai", lebar: 11, pdf: 60, fmt: "angka" },
          { judul: ri ? "Pasien-hari" : "Kunjungan", lebar: 11, pdf: 60, fmt: "angka" },
          ...(ri ? [{ judul: "Kunjungan", lebar: 10, pdf: 55, fmt: "angka" } satisfies Kolom] : []),
          { judul: "Petugas penginput", lebar: 11, pdf: 60, fmt: "angka" },
          ...(ri ? [{ judul: "Perawat per pasien/hari", lebar: 13, pdf: 70, fmt: "desimal" } satisfies Kolom] : []),
          { judul: "Input dibatalkan", lebar: 11, pdf: 60, fmt: "angka" },
        ],
        baris: [...d.baris]
          .sort((a, b) => (a.ringkas.persen ?? 101) - (b.ringkas.persen ?? 101))
          .map((b) => [
            b.nama,
            b.grupNama,
            persenSel(b.ringkas.persen),
            b.ringkas.ok,
            b.ringkas.dinilai,
            b.ringkas.pasienHari,
            ...(ri ? [b.ringkas.kunjungan] : []),
            b.ringkas.petugas,
            ...(ri ? [b.ringkas.perawatPerPasienHari] : []),
            { v: b.ringkas.batal, nada: b.ringkas.batal ? "merahLembut" : null },
          ]),
        total: [
          "Semua ruang",
          null,
          persenSel(d.total.persen),
          d.total.ok,
          d.total.dinilai,
          d.total.pasienHari,
          ...(ri ? [d.total.kunjungan] : []),
          d.total.petugas,
          ...(ri ? [d.total.perawatPerPasienHari] : []),
          d.total.batal,
        ],
        catatan: `Urut dari ${ukuran.toLowerCase()} terendah. ${PITA_KETERANGAN}`,
      },
    ],
  };

  // Matriks ruang × hari + baris total per hari (Σ terpenuhi ÷ Σ dinilai lintas ruang). Sel = angka
  // persen polos (seperti heatmap layar) agar "100" muat satu baris pada 31 kolom hari di PDF.
  const padat = d.hari.length > 20;
  const [lebarRuang, lebarTotal] = padat ? [110, 30] : [150, 44];
  const lebarHari = Math.floor((769 - lebarRuang - lebarTotal) / Math.max(1, d.hari.length));
  const narrow = (iso: string) => hariTeks(iso).slice(0, 1);
  const selPeta = (p: number | null): Sel => ({ v: p, nada: nadaPersen(p) });
  const perHari = d.hari.map((_, i) => {
    let ok = 0;
    let n = 0;
    for (const b of d.baris) {
      ok += b.sel[i]?.ok ?? 0;
      n += b.sel[i]?.dinilai ?? 0;
    }
    return n ? Math.round((ok / n) * 100) : null;
  });
  const peta: Lembar = {
    nama: "Peta ruang x hari",
    judul: `${ukuran} ruang × ${ri ? "hari dinas" : "tanggal masuk"}`,
    tabel: [
      {
        kolom: [
          { judul: "Ruang", lebar: 30, pdf: lebarRuang },
          ...d.hari.map((t): Kolom => ({ judul: `${narrow(t)} ${Number(t.slice(8, 10))}`, lebar: 6, pdf: lebarHari, fmt: "angka", rata: "tengah" })),
          { judul: "Total", lebar: 8, pdf: lebarTotal, fmt: "angka", rata: "tengah" },
        ],
        baris: d.baris.map((b) => [
          b.nama,
          ...b.sel.map((s): Sel => (s == null ? null : s.persen == null ? { v: "·", nada: "abu" } : selPeta(s.persen))),
          { v: b.ringkas.persen, nada: nadaPersen(b.ringkas.persen), tebal: true },
        ]),
        total: ["Semua ruang", ...perHari, d.total.persen],
        catatan: `Angka = % ${ri ? "target terpenuhi" : "kategori wajib terisi"}. Kolom = ${ri ? "hari dinas 07.00–07.00" : "tanggal masuk"}, ${rentangTeks(d.range.from, d.range.to)}. Kosong = tanpa pasien · "·" = ada pasien, belum dinilai. ${PITA_KETERANGAN}`,
      },
    ],
  };

  const rincian: Lembar = ri ? rincianRi(d) : rincianKelengkapan(d);

  return {
    judul: `Rekap ${ukuran} Pengimputan RME per Ruangan — ${d.jenis.label}`,
    meta: [
      `Rentang: ${rentangTeks(d.range.from, d.range.to)} (${d.range.hari} hari) · Jenis layanan: ${d.jenis.label}`,
      ri
        ? `Kepatuhan target harian Rawat Inap per hari dinas (07.00–07.00): CPPT keperawatan ≥ ${TARGET_RI.cpptPerawatPerShift}/shift, visite dokter ≥ ${TARGET_RI.cpptDokterPerHari}/hari, TTV ≥ ${TARGET_RI.ttvPerHari}/hari. Sel = target terpenuhi ÷ target dinilai (seluruh pasien); hanya shift/hari yang utuh dalam masa rawat yang dinilai.`
        : `Kelengkapan kunjungan per tanggal masuk: kategori wajib yang terisi ÷ kategori wajib (seluruh kunjungan). Tindakan dihitung tanpa item tarif.`,
      "Sumber: data aktual SIMGOS (read-only) — sama dengan tab Peta Ruangan.",
    ],
    lembar: [ringkasan, peta, rincian],
    ttd: {
      place: TEMPAT_TTD,
      date: tglPanjang(ctx.hariIni),
      columns: [{ caption: "Mengetahui,", nip: "" }, { caption: "Dibuat oleh,", name: ctx.oleh }],
    },
    berkas: `Kepatuhan-Ruangan_${d.jenis.short}_${d.range.from}_${d.range.to}`,
    jumlah: d.baris.length,
    ringkasan: `${d.jenis.label} · ${rentangTeks(d.range.from, d.range.to)} · ${d.baris.length} ruang`,
  };
}

/* --------------------------------------------------------- rincian pasien */

type Baris = { tanggal: string; ruang: string; item: PetaItem };

function barisRincian(d: PetaRuangan): Baris[] {
  const out: Baris[] = [];
  d.hari.forEach((tanggal, i) => {
    for (const b of d.baris) for (const item of b.sel[i]?.items ?? []) out.push({ tanggal, ruang: b.nama, item });
  });
  return out;
}

function rincianRi(d: PetaRuangan): Lembar {
  return {
    nama: "Rincian pasien",
    judul: "Rincian pasien per hari dinas",
    tabel: [
      {
        pdf: false,
        kolom: [
          { judul: "Hari dinas", lebar: 12, fmt: "tanggal" },
          { judul: "Ruang", lebar: 26 },
          { judul: "Pasien", lebar: 26 },
          { judul: "No. RM", lebar: 10, fmt: "kode" },
          { judul: "Hari rawat ke-", lebar: 9, fmt: "angka" },
          ...SHIFTS.map((s): Kolom => ({ judul: `CPPT ${s.label}`, lebar: 15, rata: "tengah" })),
          { judul: "Visite dokter", lebar: 15, rata: "tengah" },
          { judul: `TTV ≥ ${TARGET_RI.ttvPerHari}`, lebar: 15, rata: "tengah" },
          { judul: "Jumlah TTV", lebar: 9, fmt: "angka" },
          { judul: "CPPT keperawatan", lebar: 11, fmt: "angka" },
          { judul: "Perawat/bidan", lebar: 10, fmt: "angka" },
          { judul: "Petugas", lebar: 9, fmt: "angka" },
          { judul: "Batal", lebar: 7, fmt: "angka" },
          { judul: "No. kunjungan", lebar: 22, fmt: "kode" },
        ],
        baris: barisRincian(d).flatMap(({ tanggal, ruang, item }) => {
          if (item.tipe !== "RI") return [];
          const p = d.pasien[item.nomor];
          return [
            [
              tanggal,
              ruang,
              p?.nama ?? "Tanpa nama",
              p?.norm ?? null,
              item.hariKe,
              ...item.shift.map(statusSel),
              statusSel(item.dokter),
              statusSel(item.ttv),
              item.ttvN,
              item.cpptKeperawatan,
              item.perawat,
              item.petugas,
              item.batal,
              item.nomor,
            ],
          ];
        }),
        catatan: `Status: ${(["OK", "KURANG", "PARSIAL", "NANTI", "LUAR"] as const).map((s) => SEL_LABEL[s]).join(" · ")}.`,
      },
    ],
  };
}

function rincianKelengkapan(d: PetaRuangan): Lembar {
  return {
    nama: "Rincian kunjungan",
    judul: "Rincian kunjungan per tanggal masuk",
    tabel: [
      {
        pdf: false,
        kolom: [
          { judul: "Tanggal masuk", lebar: 12, fmt: "tanggal" },
          { judul: "Ruang", lebar: 26 },
          { judul: "Pasien", lebar: 26 },
          { judul: "No. RM", lebar: 10, fmt: "kode" },
          { judul: "Masuk", lebar: 16, fmt: "waktu" },
          { judul: "Kelengkapan (%)", lebar: 12, fmt: "persen", rata: "tengah" },
          { judul: "Kategori belum terisi", lebar: 36 },
          { judul: "Input aktif", lebar: 9, fmt: "angka" },
          { judul: "Petugas", lebar: 9, fmt: "angka" },
          { judul: "Batal", lebar: 7, fmt: "angka" },
          { judul: "No. kunjungan", lebar: 22, fmt: "kode" },
        ],
        baris: barisRincian(d).flatMap(({ tanggal, ruang, item }) => {
          if (item.tipe !== "KEL") return [];
          const p = d.pasien[item.nomor];
          return [
            [
              tanggal,
              ruang,
              p?.nama ?? "Tanpa nama",
              p?.norm ?? null,
              p?.masuk ?? null,
              persenSel(item.persen),
              item.kurang.length ? item.kurang.map((k) => KATEGORI[k].label).join(", ") : "Lengkap",
              item.input,
              item.petugas,
              item.batal,
              item.nomor,
            ],
          ];
        }),
      },
    ],
  };
}

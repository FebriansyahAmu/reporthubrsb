import "server-only";
import { formatLama } from "@/lib/format";
import {
  HARI_DINAS_MULAI_JAM,
  KATEGORI,
  KATEGORI_KEYS,
  SHIFTS,
  STATUS_KUNJUNGAN_LABEL,
  SUMBER,
  TINDAKAN_TARIF,
  TTV_TERLAMBAT_MENIT,
} from "./kunjungan.constants";
import type { KepatuhanPetugas, KunjunganPetugas, PetugasSkorItem, ProfilPetugas } from "./petugas.service";
import {
  BAND,
  BAND_TEKS,
  bandLabel,
  INTEGRITAS_BATAS,
  KOMPONEN,
  KOMPONEN_KEYS,
  KOMPONEN_PENDEK,
  komponenEkstrem,
  nilaiPenjelasan,
  rumusTerhitung,
  SKOR_SYARAT,
  type BandKey,
} from "./skor";
import {
  hariTeks,
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
 * Ekspor Kepatuhan Petugas (K5): rekap semua petugas (peringkat per profesi)
 * dan profil satu petugas (lembar bukti pembinaan/penghargaan). Data = hasil
 * `getKepatuhanPetugas` / `getProfilPetugas` apa adanya — tidak dihitung ulang.
 */

export type KonteksEkspor = { lokasi: string; hariIni: string; oleh: string };

const NADA_PITA: Record<BandKey, Nada> = {
  TELADAN: "hijauLembut",
  BAIK: "biruLembut",
  CUKUP: "kuningLembut",
  PEMBINAAN: "merahLembut",
};

const persen1 = (n: number, d: number) => (d ? Math.round((n / d) * 1000) / 10 : null);
const jam2 = (h: number) => String(h).padStart(2, "0");

const CATATAN_SKOR =
  "Skor = alat bantu penilaian reward & punishment, bukan keputusan otomatis; dibandingkan dengan rekan seprofesi. Setiap angka dapat ditelusuri di aplikasi (profil petugas → jejak kunjungan).";

function metaRentang(range: { from: string; to: string; hari: number }, lokasi: string): string {
  return `Rentang hari dinas (${jam2(HARI_DINAS_MULAI_JAM)}.00–${jam2(HARI_DINAS_MULAI_JAM)}.00): ${rentangTeks(range.from, range.to)} (${range.hari} hari) · Lokasi input: ${lokasi}`;
}

/* ------------------------------------------------------------ metodologi */

const METODOLOGI: Lembar = {
  nama: "Metodologi",
  judul: "Cara skor dihitung",
  tabel: [
    {
      judul: "Komponen skor",
      kolom: [
        { judul: "Komponen", lebar: 30, pdf: 150 },
        { judul: "Bobot", lebar: 8, pdf: 40, fmt: "persen" },
        { judul: "Cara hitung", lebar: 110, pdf: 570, bungkus: true },
      ],
      baris: KOMPONEN_KEYS.map((k) => [KOMPONEN[k].label, KOMPONEN[k].bobot, KOMPONEN[k].rumus]),
    },
    {
      judul: "Ketentuan",
      kolom: [
        { judul: "Ketentuan", lebar: 30, pdf: 150 },
        { judul: "Keterangan", lebar: 118, pdf: 610, bungkus: true },
      ],
      baris: [
        ["Skor akhir", "Σ (bobot × nilai komponen) ÷ Σ bobot komponen yang berlaku. Komponen yang tidak berlaku tidak menghukum."],
        [
          "Syarat dinilai",
          `Aktif ≥ ${SKOR_SYARAT.hariAktifMin} hari dinas dan ≥ ${SKOR_SYARAT.inputMin} input klinis. Pembanding = rekan seprofesi pada rentang & lokasi yang sama.`,
        ],
        ["Hari dinas", `Dimulai pukul ${jam2(HARI_DINAS_MULAI_JAM)}.00 — ${SHIFTS.map((s) => `${s.label} ${jam2(s.start)}–${jam2(s.end)}`).join(" · ")} (WITA).`],
        ["Pita skor", `${BAND_TEKS}.`],
        ["Integritas", `Hanya pembatalan (STATUS 0) yang dinilai; nilai 0 pada ≥ ${INTEGRITAS_BATAS * 100}% input dibatalkan.`],
        ["TTV tak wajar", "Ditampilkan sebagai temuan, tidak mengurangi skor — polanya sistemik (± 47% TTV bersuhu tanpa koma, mis. 362)."],
        ["TTV terlambat", `TTV disimpan > ${TTV_TERLAMBAT_MENIT} menit setelah waktu pemeriksaan.`],
        ["Item tarif", `Tidak dihitung sebagai Tindakan: ${TINDAKAN_TARIF.map((t) => t.label.toLowerCase()).join(", ")}.`],
        ["Sifat skor", CATATAN_SKOR],
      ],
    },
  ],
};

/* ------------------------------------------------------ rekap semua petugas */

const KOLOM_PERINGKAT: Kolom[] = [
  { judul: "#", lebar: 6, pdf: 24, fmt: "angka", rata: "tengah" },
  { judul: "Nama petugas", lebar: 30, pdf: 128 },
  { judul: "Login", lebar: 14 },
  { judul: "Skor", lebar: 8, pdf: 32, fmt: "angka", rata: "tengah" },
  { judul: "Pita", lebar: 16, pdf: 62 },
  ...KOMPONEN_KEYS.map((k): Kolom => ({ judul: `${KOMPONEN_PENDEK[k]} (${KOMPONEN[k].bobot}%)`, lebar: 12, pdf: 58, fmt: "angka", rata: "tengah" })),
  { judul: "Input klinis per hari", lebar: 11, fmt: "desimal" },
  { judul: "Kontribusi RI per hari", lebar: 11, fmt: "desimal" },
  { judul: "TTV tepat waktu", lebar: 10, rata: "tengah" },
  { judul: "Hari aktif", lebar: 8, pdf: 34, fmt: "angka" },
  { judul: "Pasien", lebar: 8, pdf: 36, fmt: "angka" },
  { judul: "Input klinis", lebar: 9, pdf: 40, fmt: "angka" },
  ...KATEGORI_KEYS.map((k): Kolom => ({ judul: KATEGORI[k].short, lebar: 7, fmt: "angka" })),
  { judul: "Batal", lebar: 8, pdf: 36, fmt: "angka" },
  { judul: "% batal", lebar: 8, fmt: "persen1" },
  { judul: "TTV terlambat", lebar: 9, fmt: "angka" },
  { judul: "TTV tak wajar", lebar: 9, fmt: "angka" },
  { judul: "Hari-pasien RI", lebar: 9, fmt: "angka" },
  { judul: "Item tarif", lebar: 9, fmt: "angka" },
  { judul: "Keterangan", lebar: 40, pdf: 145, bungkus: true },
];

function keterangan(it: PetugasSkorItem): string | null {
  if (!it.dinilai) return it.alasan;
  const { kuat, lemah } = komponenEkstrem(it);
  if (!kuat || !lemah || kuat === lemah) return null;
  return `Terkuat ${KOMPONEN_PENDEK[kuat]} ${it.komponen[kuat].skor} · terlemah ${KOMPONEN_PENDEK[lemah]} ${it.komponen[lemah].skor}`;
}

function barisPeringkat(it: PetugasSkorItem): Sel[] {
  const nada = it.band ? NADA_PITA[it.band] : "abu";
  return [
    it.peringkat,
    it.nama ?? `Petugas #${it.id}`,
    it.login,
    { v: it.skor, nada: it.band ? nada : null, tebal: true },
    { v: it.band ? bandLabel(it.band) : "Belum dinilai", nada },
    ...KOMPONEN_KEYS.map((k) => it.komponen[k].skor),
    it.komponen.aktivitas.nilai,
    it.komponen.kontribusiRi.nilai,
    it.ttv ? `${it.ttv - it.ttvTerlambat}/${it.ttv}` : null,
    it.hariAktif,
    it.pasien,
    it.klinis,
    ...KATEGORI_KEYS.map((k) => it.perKategori[k]),
    it.batal,
    persen1(it.batal, it.klinis + it.batal),
    it.ttvTerlambat,
    it.ttvTakWajar,
    it.riHariPasien,
    it.tarif,
    keterangan(it),
  ];
}

export function dokumenKepatuhanPetugas(d: KepatuhanPetugas, ctx: KonteksEkspor): Dokumen {
  const jumlahPita = (list: PetugasSkorItem[], b: BandKey) => list.filter((x) => x.band === b).length;
  const sum = (k: "total" | "dinilai" | "klinis" | "batal" | "ttv" | "ttvTerlambat" | "tarif") => d.profesi.reduce((s, p) => s + p[k], 0);

  const ringkasan: Lembar = {
    nama: "Ringkasan",
    judul: "Ringkasan per profesi",
    tabel: [
      {
        kolom: [
          { judul: "Profesi", lebar: 22, pdf: 120 },
          { judul: "Menginput", lebar: 11, pdf: 58, fmt: "angka" },
          { judul: "Dinilai", lebar: 10, pdf: 50, fmt: "angka" },
          { judul: "Median skor", lebar: 12, pdf: 56, fmt: "angka" },
          ...BAND.map((b): Kolom => ({ judul: b.label, lebar: 12, pdf: 56, fmt: "angka" })),
          { judul: "Input klinis", lebar: 12, pdf: 60, fmt: "angka" },
          { judul: "Dibatalkan", lebar: 11, pdf: 56, fmt: "angka" },
          { judul: "% batal", lebar: 9, pdf: 44, fmt: "persen1" },
          { judul: "TTV", lebar: 8, pdf: 40, fmt: "angka" },
          { judul: "% TTV tepat waktu", lebar: 12, pdf: 56, fmt: "persen1" },
          { judul: "Item tarif (tak dinilai)", lebar: 14, pdf: 60, fmt: "angka" },
        ],
        baris: d.profesi.map((p) => {
          const list = d.items.filter((x) => x.profesi === p.profesi);
          return [
            p.label,
            p.total,
            p.dinilai,
            p.medianSkor,
            ...BAND.map((b) => jumlahPita(list, b.key)),
            p.klinis,
            p.batal,
            persen1(p.batal, p.klinis + p.batal),
            p.ttv,
            persen1(p.ttv - p.ttvTerlambat, p.ttv),
            p.tarif,
          ];
        }),
        total: [
          "Semua profesi",
          sum("total"),
          sum("dinilai"),
          null,
          ...BAND.map((b) => jumlahPita(d.items, b.key)),
          sum("klinis"),
          sum("batal"),
          persen1(sum("batal"), sum("klinis") + sum("batal")),
          sum("ttv"),
          persen1(sum("ttv") - sum("ttvTerlambat"), sum("ttv")),
          sum("tarif"),
        ],
        catatan: `Pita: ${BAND_TEKS}. Median = petugas yang dinilai saja.`,
      },
    ],
  };

  const perProfesi: Lembar[] = d.profesi.map((p) => ({
    nama: p.label,
    judul: `Peringkat ${p.label}`,
    tabel: [
      {
        kolom: KOLOM_PERINGKAT,
        baris: d.items.filter((x) => x.profesi === p.profesi).map(barisPeringkat),
        catatan: `${p.dinilai} dari ${p.total} ${p.label.toLowerCase()} dinilai. Kolom komponen = skor 0–100 (persentil seprofesi untuk Aktivitas & Kontribusi RI).`,
      },
    ],
  }));

  return {
    judul: "Rekap Kepatuhan Pengimputan RME per Petugas",
    meta: [metaRentang(d.range, ctx.lokasi), CATATAN_SKOR],
    lembar: [ringkasan, ...perProfesi, METODOLOGI],
    ttd: {
      place: TEMPAT_TTD,
      date: tglPanjang(ctx.hariIni),
      columns: [{ caption: "Mengetahui,", nip: "" }, { caption: "Dibuat oleh,", name: ctx.oleh }],
    },
    berkas: `Kepatuhan-Petugas_${d.range.from}_${d.range.to}`,
    jumlah: d.items.length,
    ringkasan: `${rentangTeks(d.range.from, d.range.to)} · ${ctx.lokasi} · ${d.items.length} petugas`,
  };
}

/* ------------------------------------------------------ profil satu petugas */

function namaPasien(k: KunjunganPetugas | undefined) {
  return k?.pasien ?? "Tanpa nama";
}

export function dokumenProfilPetugas(
  it: PetugasSkorItem,
  d: ProfilPetugas,
  ctx: KonteksEkspor & { nip: string | null },
): Dokumen {
  const nama = it.nama ?? `Petugas #${it.id}`;
  const pasien = new Map(d.kunjungan.map((k) => [k.nomor, k]));
  const rumus = rumusTerhitung(it);
  const totalShift = SHIFTS.reduce((s, x) => s + d.perShift[x.key], 0);
  const skorTeks = it.dinilai
    ? `Skor ${it.skor} — ${bandLabel(it.band!)} · peringkat ${it.peringkat} dari ${it.pembanding} ${it.profesiLabel.toLowerCase()} yang dinilai`
    : `Belum dinilai — ${it.alasan}`;

  const ringkasan: Lembar = {
    nama: "Ringkasan",
    judul: "Ringkasan",
    tabel: [
      {
        judul: "Komponen skor",
        kolom: [
          { judul: "Komponen", lebar: 30, pdf: 150 },
          { judul: "Bobot", lebar: 8, pdf: 40, fmt: "persen" },
          { judul: "Skor (0–100)", lebar: 11, pdf: 56, fmt: "angka", rata: "tengah" },
          { judul: "Dasar perhitungan", lebar: 100, pdf: 520, bungkus: true },
        ],
        baris: KOMPONEN_KEYS.map((k) => [
          KOMPONEN[k].label,
          KOMPONEN[k].bobot,
          { v: it.komponen[k].skor, tebal: true },
          it.dinilai ? nilaiPenjelasan(k, it) : "—",
        ]),
        total: [
          "Skor akhir",
          null,
          { v: it.skor, nada: it.band ? NADA_PITA[it.band] : null },
          rumus ? `${rumus} = ${it.skor} (${bandLabel(it.band!)})` : `Belum dinilai — ${it.alasan}`,
        ],
      },
      {
        judul: "Input per kategori & pola dinas",
        kolom: [
          { judul: "Uraian", lebar: 30, pdf: 200 },
          { judul: "Jumlah", lebar: 10, pdf: 60, fmt: "angka" },
          { judul: "Porsi", lebar: 9, pdf: 50, fmt: "persen" },
        ],
        baris: [
          ...KATEGORI_KEYS.map((k): Sel[] => [`Input aktif · ${KATEGORI[k].label}`, d.perKategori[k], null]),
          ...SHIFTS.map((s): Sel[] => [
            `Shift ${s.label} (${jam2(s.start)}–${jam2(s.end)})`,
            d.perShift[s.key],
            totalShift ? Math.round((d.perShift[s.key] / totalShift) * 100) : null,
          ]),
          ["Item tarif (tidak dinilai)", d.tarif, null],
          [{ v: "Input dibatalkan", nada: d.batal ? "merahLembut" : null }, d.batal, null],
          ["Pasien (kunjungan) ditangani", d.kunjungan.length, null],
        ],
      },
    ],
  };

  const harian: Lembar = {
    nama: "Aktivitas harian",
    judul: "Kalender aktivitas per hari dinas",
    tabel: [
      {
        kolom: [
          { judul: "Hari dinas", lebar: 12, pdf: 70, fmt: "tanggal" },
          { judul: "Hari", lebar: 9, pdf: 50 },
          { judul: "Input klinis", lebar: 11, pdf: 60, fmt: "angka" },
          ...KATEGORI_KEYS.map((k): Kolom => ({ judul: KATEGORI[k].label, lebar: 11, pdf: 60, fmt: "angka" })),
          { judul: "Item tarif", lebar: 10, pdf: 50, fmt: "angka" },
          { judul: "Dibatalkan", lebar: 10, pdf: 55, fmt: "angka" },
        ],
        baris: d.harian.map((h) => [
          h.tanggal,
          hariTeks(h.tanggal),
          { v: h.klinis, tebal: h.klinis > 0 },
          ...KATEGORI_KEYS.map((k) => h.perKategori[k]),
          h.tarif,
          { v: h.batal, nada: h.batal ? "merahLembut" : null },
        ]),
        total: [
          "Total",
          null,
          d.harian.reduce((s, h) => s + h.klinis, 0),
          ...KATEGORI_KEYS.map((k) => d.harian.reduce((s, h) => s + h.perKategori[k], 0)),
          d.harian.reduce((s, h) => s + h.tarif, 0),
          d.harian.reduce((s, h) => s + h.batal, 0),
        ],
      },
    ],
  };

  const kunjungan: Lembar = {
    nama: "Kunjungan",
    judul: "Kunjungan ditangani",
    tabel: [
      {
        kolom: [
          { judul: "Pasien", lebar: 26, pdf: 120 },
          { judul: "No. RM", lebar: 10, pdf: 48, fmt: "kode" },
          { judul: "Jenis", lebar: 8, pdf: 30 },
          { judul: "Ruangan", lebar: 24, pdf: 110 },
          { judul: "Masuk", lebar: 16, pdf: 66, fmt: "waktu" },
          { judul: "Keluar", lebar: 16, fmt: "waktu" },
          { judul: "Status", lebar: 14 },
          ...KATEGORI_KEYS.map((k): Kolom => ({ judul: KATEGORI[k].short, lebar: 7, pdf: 32, fmt: "angka" })),
          { judul: "Input klinis", lebar: 9, pdf: 40, fmt: "angka" },
          { judul: "Item tarif", lebar: 9, fmt: "angka" },
          { judul: "Batal", lebar: 7, pdf: 30, fmt: "angka" },
          { judul: "Input pertama", lebar: 16, fmt: "waktu" },
          { judul: "Input terakhir", lebar: 16, pdf: 66, fmt: "waktu" },
          { judul: "No. kunjungan", lebar: 22, fmt: "kode" },
        ],
        baris: d.kunjungan.map((k) => [
          k.pasien ?? "Tanpa nama",
          k.norm,
          k.jenis.short,
          k.ruangan,
          k.masuk,
          k.keluar,
          k.status ? STATUS_KUNJUNGAN_LABEL[k.status] : null,
          ...KATEGORI_KEYS.map((c) => k.perKategori[c]),
          k.klinis,
          k.tarif,
          { v: k.batal, nada: k.batal ? "merahLembut" : null },
          k.pertama,
          k.terakhir,
          k.nomor,
        ]),
      },
    ],
  };

  const pelaku = (oleh: string) =>
    oleh === it.id ? `${nama} (sendiri)` : (d.petugasRef[oleh]?.nama ?? `Petugas #${oleh}`);
  const temuan: Lembar = {
    nama: "Temuan",
    judul: "Temuan",
    tabel: [
      {
        judul: "Input dibatalkan (dasar komponen integritas)",
        kolom: [
          { judul: "Waktu input", lebar: 16, pdf: 70, fmt: "waktu" },
          { judul: "Kategori", lebar: 12, pdf: 55 },
          { judul: "Sumber", lebar: 18, pdf: 80 },
          { judul: "Pasien", lebar: 24, pdf: 110 },
          { judul: "No. RM", lebar: 10, pdf: 46, fmt: "kode" },
          { judul: "Ringkasan", lebar: 36, pdf: 150, bungkus: true },
          { judul: "Dibatalkan oleh", lebar: 26, pdf: 110 },
          { judul: "Waktu pembatalan", lebar: 16, pdf: 70, fmt: "waktu" },
        ],
        baris: d.temuan.batal.map((b) => {
          const k = b.kunjungan ? pasien.get(b.kunjungan) : undefined;
          return [
            b.waktu,
            KATEGORI[b.kategori].label,
            SUMBER[b.sumber].label,
            namaPasien(k),
            k?.norm ?? null,
            b.ringkasan,
            b.batalOleh ? pelaku(b.batalOleh.oleh) : "Pelaku tidak tercatat di log",
            b.batalOleh?.ts ?? null,
          ];
        }),
      },
      {
        judul: `TTV terlambat diinput (> ${TTV_TERLAMBAT_MENIT} menit)`,
        kolom: [
          { judul: "Waktu periksa", lebar: 16, pdf: 70, fmt: "waktu" },
          { judul: "Waktu simpan", lebar: 16, pdf: 70, fmt: "waktu" },
          { judul: "Terlambat (menit)", lebar: 11, fmt: "angka" },
          { judul: "Terlambat", lebar: 14, pdf: 70 },
          { judul: "Pasien", lebar: 24, pdf: 120 },
          { judul: "No. RM", lebar: 10, pdf: 46, fmt: "kode" },
          { judul: "Nilai TTV", lebar: 40, pdf: 180, bungkus: true },
        ],
        baris: d.temuan.ttvTerlambat.map((t) => {
          const k = t.kunjungan ? pasien.get(t.kunjungan) : undefined;
          return [t.waktu, t.waktuInput, t.menit, formatLama(t.menit), namaPasien(k), k?.norm ?? null, t.ringkasan];
        }),
      },
      {
        judul: "Nilai TTV tak wajar (informasi — tidak mengurangi skor)",
        kolom: [
          { judul: "Waktu periksa", lebar: 16, pdf: 70, fmt: "waktu" },
          { judul: "Pasien", lebar: 24, pdf: 120 },
          { judul: "No. RM", lebar: 10, pdf: 46, fmt: "kode" },
          { judul: "Nilai TTV", lebar: 40, pdf: 180, bungkus: true },
          { judul: "Keterangan", lebar: 40, pdf: 180, bungkus: true },
        ],
        baris: d.temuan.ttvTakWajar.map((t) => {
          const k = t.kunjungan ? pasien.get(t.kunjungan) : undefined;
          return [t.waktu, namaPasien(k), k?.norm ?? null, t.ringkasan, t.peringatan];
        }),
      },
    ],
  };

  return {
    judul: "Profil Kepatuhan Pengimputan RME — Petugas",
    meta: [
      `Petugas: ${nama}${it.login ? ` (${it.login})` : ""} · ${it.profesiLabel}${ctx.nip ? ` · NIP ${ctx.nip}` : ""}`,
      metaRentang(d.range, ctx.lokasi),
      skorTeks,
      ...(d.terpotong ? ["Perhatian: input sangat banyak — sebagian record terbaru tidak termuat pada profil ini."] : []),
      CATATAN_SKOR,
    ],
    lembar: [ringkasan, harian, kunjungan, temuan, METODOLOGI],
    ttd: {
      place: TEMPAT_TTD,
      date: tglPanjang(ctx.hariIni),
      columns: [
        { caption: "Petugas yang dinilai,", name: nama, nip: ctx.nip ?? "" },
        { caption: "Atasan langsung,", nip: "" },
        { caption: "Mengetahui,", nip: "" },
      ],
    },
    berkas: `Profil-Petugas_${nama}_${d.range.from}_${d.range.to}`,
    jumlah: d.kunjungan.length,
    ringkasan: `${nama} (${it.profesiLabel}) · ${rentangTeks(d.range.from, d.range.to)} · ${ctx.lokasi}`,
  };
}

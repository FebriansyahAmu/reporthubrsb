import { describe, expect, it } from "vitest";
import {
  hitungSkor,
  kosongDeklaratif,
  petaTtdDeklaratif,
  skemaDeklaratif,
  syaratFinalDeklaratif,
  validasiStruktur,
  type KolomBaris,
  type KolomSkor,
  type KolomTabel,
  type StrukturDeklaratif,
} from "./deklaratif";
import { KATEGORI_MORSE, morse } from "./forms/morse";

const TTD = "ttd:abcdefghijklmnopqrstuvwx";

const contoh: StrukturDeklaratif = {
  bagian: [
    {
      id: "umum",
      judul: "Umum",
      kolom: [
        { jenis: "teks", id: "catatan", label: "Catatan", maks: 20 },
        { jenis: "angka", id: "berat", label: "Berat badan", min: 0, maks: 300, satuan: "kg", wajib: true },
        { jenis: "tanggal", id: "tgl", label: "Tanggal" },
        { jenis: "tanggalJam", id: "waktu", label: "Waktu" },
        { jenis: "pilihan", id: "a", label: "A", opsi: [{ nilai: "x", label: "X", skor: 1 }, { nilai: "y", label: "Y", skor: 5 }], wajib: true },
        { jenis: "pilihanGanda", id: "b", label: "B", opsi: [{ nilai: "p", label: "P", skor: 2 }, { nilai: "q", label: "Q", skor: 3 }] },
        { jenis: "skor", id: "total", label: "Total", dari: ["a", "b"], kategori: [{ min: 0, label: "Rendah", nada: "rendah" }, { min: 6, label: "Tinggi", nada: "tinggi" }] },
        { jenis: "centang", id: "setuju", label: "Setuju", wajib: true },
        { jenis: "ttd", id: "ttdPetugas", label: "TTD petugas", wajib: true },
        { jenis: "info", id: "info", teks: "Keterangan" },
      ],
    },
    {
      id: "ulang",
      judul: "Ulang",
      kolom: [
        {
          jenis: "tabel",
          id: "baris",
          label: "Observasi",
          namaBaris: "Observasi",
          maksBaris: 3,
          barisAwal: 1,
          minBarisFinal: 2,
          kolom: [
            { jenis: "teks", id: "isi", label: "Isi", wajib: true },
            { jenis: "ttd", id: "paraf", label: "Paraf" },
          ],
        },
      ],
    },
  ],
};

describe("mesin form deklaratif — validasi struktur", () => {
  const dgn = (kolom: StrukturDeklaratif["bagian"][number]["kolom"]): StrukturDeklaratif => ({ bagian: [{ id: "x", judul: "X", kolom }] });
  const p = (id: string, skor = true): KolomBaris => ({ jenis: "pilihan", id, label: id, opsi: [{ nilai: "a", label: "A", ...(skor ? { skor: 1 } : {}) }] });

  it("struktur contoh & Morse sah", () => {
    expect(() => validasiStruktur(contoh)).not.toThrow();
    expect(() => validasiStruktur(morse.struktur!)).not.toThrow();
  });

  it.each([
    ["id ganda", dgn([p("a"), p("a")])],
    ["id tak aman sebagai path", dgn([p("a.b")])],
    ["id dicadangkan", dgn([p("constructor")])],
    ["id prototipe", dgn([p("__proto__")])],
    ["opsi ganda", dgn([{ jenis: "pilihan", id: "a", label: "A", opsi: [{ nilai: "x", label: "X" }, { nilai: "x", label: "Y" }] }])],
    ["opsi kosong", dgn([{ jenis: "pilihan", id: "a", label: "A", opsi: [] }])],
    ["skor dari kolom tak dikenal", dgn([p("a"), { jenis: "skor", id: "s", label: "S", dari: ["b"], kategori: [{ min: 0, label: "R", nada: "rendah" }] }])],
    ["skor dari opsi tanpa skor", dgn([p("a", false), { jenis: "skor", id: "s", label: "S", dari: ["a"], kategori: [{ min: 0, label: "R", nada: "rendah" }] }])],
    ["kategori tak naik", dgn([p("a"), { jenis: "skor", id: "s", label: "S", dari: ["a"], kategori: [{ min: 5, label: "T", nada: "tinggi" }, { min: 0, label: "R", nada: "rendah" }] }])],
    ["tabel tanpa batas wajar", dgn([{ jenis: "tabel", id: "t", label: "T", namaBaris: "B", maksBaris: 500, kolom: [p("a")] }])],
    ["baris awal > maks", dgn([{ jenis: "tabel", id: "t", label: "T", namaBaris: "B", maksBaris: 2, barisAwal: 3, kolom: [p("a")] }])],
  ])("ditolak: %s", (_n, s) => {
    expect(() => validasiStruktur(s)).toThrow(/tidak sah/);
  });

  it("skor tak bisa mengambil kolom di luar lingkup barisnya", () => {
    const tabel: KolomTabel = { jenis: "tabel", id: "t", label: "T", namaBaris: "B", maksBaris: 2, kolom: [{ jenis: "skor", id: "s", label: "S", dari: ["luar"], kategori: [{ min: 0, label: "R", nada: "rendah" }] }] };
    expect(() => validasiStruktur(dgn([p("luar"), tabel]))).toThrow(/tidak sah/);
  });
});

describe("mesin form deklaratif — skema & isian kosong", () => {
  const skema = skemaDeklaratif(contoh);
  const kosong = kosongDeklaratif(contoh);

  it("isian kosong: hanya kolom tersimpan, tabel berisi baris awal, lolos skema", () => {
    expect(kosong).toEqual({ catatan: "", berat: "", tgl: "", waktu: "", a: "", b: [], setuju: false, ttdPetugas: "", baris: [{ isi: "", paraf: "" }] });
    expect(skema.safeParse(kosong).success).toBe(true);
  });

  it.each([
    ["kunci asing tingkat atas", { kolomLiar: 1 }],
    ["skor terhitung tidak boleh dikirim", { total: 99 }],
    ["opsi tak dikenal", { a: "z" }],
    ["pilihan ganda duplikat", { b: ["p", "p"] }],
    ["angka bukan angka", { berat: "12a" }],
    ["angka di luar rentang", { berat: "301" }],
    ["tanggal salah", { tgl: "07-10-2026" }],
    ["tanggal-jam salah", { waktu: "2026-10-07 08:00" }],
    ["teks melebihi batas", { catatan: "x".repeat(21) }],
    ["centang bukan boolean", { setuju: "ya" }],
    ["TTD bukan PNG", { ttdPetugas: "data:image/svg+xml;base64,AAAA" }],
    ["kunci asing di baris tabel", { baris: [{ isi: "", paraf: "", liar: 1 }] }],
    ["baris melebihi maksimal", { baris: Array.from({ length: 4 }, () => ({ isi: "", paraf: "" })) }],
    ["baris awal dihapus", { baris: [] }],
  ])("ditolak: %s", (_n, ubah) => {
    expect(skema.safeParse({ ...kosong, ...ubah }).success).toBe(false);
  });

  it("nilai sah diterima (angka koma desimal, referensi TTD)", () => {
    const r = skema.safeParse({ ...kosong, berat: "62,5", tgl: "2026-10-07", waktu: "2026-10-07T08:00", a: "y", b: ["q", "p"], setuju: true, ttdPetugas: TTD });
    expect(r.success).toBe(true);
  });

  it("`__proto__` tidak pernah ikut ke hasil", () => {
    const r = skema.safeParse({ ...kosong, ...JSON.parse(`{"__proto__":{"admin":true}}`) });
    if (r.success) expect(JSON.stringify(r.data)).not.toContain("admin");
    expect(({} as Record<string, unknown>).admin).toBeUndefined();
  });
});

describe("mesin form deklaratif — TTD, syarat FINAL, skor", () => {
  it("slot TTD tingkat atas & per baris dengan path stabil", () => {
    const data = { ...kosongDeklaratif(contoh), baris: [{ isi: "a", paraf: "" }, { isi: "b", paraf: "" }] };
    const slot: string[] = [];
    const hasil = petaTtdDeklaratif(contoh, data, (v, s) => (slot.push(s), TTD));
    expect(slot).toEqual(["ttdPetugas", "baris.0.paraf", "baris.1.paraf"]);
    expect((hasil.baris as { paraf: string; isi: string }[]).map((b) => [b.isi, b.paraf])).toEqual([["a", TTD], ["b", TTD]]);
    expect((data.baris as { paraf: string }[])[0].paraf).toBe("");
  });

  it("syarat FINAL: kolom wajib, centang, TTD, minimal baris, kolom wajib per baris", () => {
    const kosong = kosongDeklaratif(contoh);
    expect(syaratFinalDeklaratif(contoh, kosong)).toEqual(["Berat badan", "A", "Setuju", "TTD petugas", "Observasi: minimal 2 observasi", "Observasi 1: Isi"]);
    const penuh = { ...kosong, berat: "60", a: "x", setuju: true, ttdPetugas: TTD, baris: [{ isi: "a", paraf: "" }, { isi: "b", paraf: "" }] };
    expect(syaratFinalDeklaratif(contoh, penuh)).toEqual([]);
  });

  it("skor = jumlah skor opsi terpilih; kategori dari pita; lengkap bila semua pilihan tunggal terjawab", () => {
    const k = contoh.bagian[0].kolom.find((x) => x.id === "total") as KolomSkor;
    const kolom = contoh.bagian[0].kolom;
    expect(hitungSkor(k, kolom, { a: "", b: [] })).toEqual({ nilai: 0, lengkap: false, kategori: { min: 0, label: "Rendah", nada: "rendah" } });
    expect(hitungSkor(k, kolom, { a: "x", b: ["p", "q"] })).toMatchObject({ nilai: 6, lengkap: true, kategori: { label: "Tinggi" } });
    expect(hitungSkor(k, kolom, { a: "x", b: ["liar"] })).toMatchObject({ nilai: 1 });
  });

  it("Morse: skor & ambang kategori 24/25 dan 44/45", () => {
    const tabel = morse.struktur!.bagian[0].kolom[0] as KolomTabel;
    const skor = tabel.kolom.find((x) => x.jenis === "skor") as KolomSkor;
    const baris = (v: Record<string, string>) => ({ riwayatJatuh: "tidak", diagnosisSekunder: "tidak", alatBantu: "tidakAda", terapiIntravena: "tidak", gayaBerjalan: "normal", statusMental: "baik", ...v });
    const kat = (v: Record<string, string>) => hitungSkor(skor, tabel.kolom, baris(v));
    expect(kat({})).toMatchObject({ nilai: 0, lengkap: true, kategori: { label: "Risiko rendah" } });
    expect(kat({ gayaBerjalan: "terganggu" })).toMatchObject({ nilai: 20, kategori: { label: "Risiko rendah" } });
    expect(kat({ riwayatJatuh: "ya" })).toMatchObject({ nilai: 25, kategori: { label: "Risiko sedang" } });
    expect(kat({ terapiIntravena: "ya", statusMental: "lupa" })).toMatchObject({ nilai: 35, kategori: { label: "Risiko sedang" } });
    expect(kat({ alatBantu: "furnitur", diagnosisSekunder: "ya" })).toMatchObject({ nilai: 45, kategori: { label: "Risiko tinggi" } });
    expect(kat({ riwayatJatuh: "ya", diagnosisSekunder: "ya", alatBantu: "furnitur", terapiIntravena: "ya", gayaBerjalan: "terganggu", statusMental: "lupa" })).toMatchObject({ nilai: 125 });
    expect(KATEGORI_MORSE.map((k) => k.min)).toEqual([0, 25, 45]);
  });

  it("Morse: isian kosong 1 baris pengkajian awal, belum boleh FINAL; baris lengkap → boleh", () => {
    const k = morse.kosong() as { pengkajian: Record<string, unknown>[] };
    expect(k.pengkajian).toHaveLength(1);
    expect(morse.syaratFinal(k)).toContain("Pengkajian 1: Nama perawat");
    k.pengkajian[0] = { ...k.pengkajian[0], waktu: "2026-10-07T08:00", riwayatJatuh: "tidak", diagnosisSekunder: "ya", alatBantu: "tidakAda", terapiIntravena: "ya", gayaBerjalan: "lemah", statusMental: "baik", petugasNama: "Ns. A" };
    expect(morse.syaratFinal(k)).toEqual([]);
    expect(morse.skema.safeParse(k).success).toBe(true);
  });
});

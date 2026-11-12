import { describe, expect, it } from "vitest";
import { definisiForm } from "./registry";
import {
  ambilDi,
  bentukIsian,
  daunBeda,
  denganNilai,
  gabungkan,
  lengkapiKunci,
  MAKS_UBAH,
  pasangDi,
  rebase,
  segmenPath,
  susunUbah,
  tumpang,
} from "./gabung";

const contoh = () => ({
  alamat: "Jl. A",
  telp: "",
  bahasa: ["Indonesia"],
  persiapan: { kesediaan: "", hambatan: [] as string[] },
  entries: [
    { kategori: "Keperawatan", aktif: false, edukatorNama: "" },
    { kategori: "Farmasi", aktif: false, edukatorNama: "" },
  ],
  skLain: [{ teks: "", lama: "" }],
});

describe("segmenPath", () => {
  it("menerima nama & indeks", () => {
    expect(segmenPath("entries.2.edukatorNama")).toEqual(["entries", "2", "edukatorNama"]);
    expect(segmenPath("persiapan.bahasa")).toEqual(["persiapan", "bahasa"]);
  });
  it("menolak prototipe, segmen aneh, dan bentuk tak sah", () => {
    for (const p of [
      "__proto__",
      "a.__proto__.x",
      "constructor",
      "constructor.prototype.x",
      "a.prototype",
      "",
      "0.a",
      "a..b",
      "a.01",
      "a.1000",
      "a-b",
      "a.b c",
      "x".repeat(200),
      "a.b.c.d.e.f.g.h.i",
    ]) {
      expect(segmenPath(p), p).toBeNull();
    }
    expect(segmenPath(42)).toBeNull();
  });
});

describe("ambilDi / pasangDi", () => {
  it("hanya path yang ada; indeks hanya untuk larik dan dalam batas", () => {
    const o = contoh();
    expect(ambilDi(o, "entries.1.kategori")).toEqual({ ada: true, nilai: "Farmasi" });
    expect(ambilDi(o, "entries.2.kategori").ada).toBe(false);
    expect(ambilDi(o, "entries.x").ada).toBe(false);
    expect(ambilDi(o, "alamat.0").ada).toBe(false);
    expect(ambilDi(o, "persiapan.0").ada).toBe(false);
    expect(ambilDi(o, "toString").ada).toBe(false);
  });
  it("tak pernah membuat kunci baru & tak menyentuh prototipe", () => {
    const o = contoh();
    expect(pasangDi(o, "baru", 1)).toBe(false);
    expect(pasangDi(o, "__proto__", { x: 1 })).toBe(false);
    expect(pasangDi(o, "entries.5.aktif", true)).toBe(false);
    expect(Object.hasOwn(o, "baru")).toBe(false);
    expect(({} as Record<string, unknown>).x).toBeUndefined();
    expect(pasangDi(o, "entries.0.aktif", true)).toBe(true);
    expect(o.entries[0].aktif).toBe(true);
  });
});

describe("tumpang", () => {
  it("sama atau leluhur, bukan awalan nama", () => {
    expect(tumpang("a", "a")).toBe(true);
    expect(tumpang("a", "a.b")).toBe(true);
    expect(tumpang("a.b", "a")).toBe(true);
    expect(tumpang("a", "ab")).toBe(false);
    expect(tumpang("a.b", "a.c")).toBe(false);
  });
});

describe("daunBeda", () => {
  it("daun = primitif, larik primitif utuh, larik objek per indeks bila panjang sama", () => {
    const a = contoh();
    const b = contoh();
    b.alamat = "Jl. B";
    b.bahasa = ["Indonesia", "Inggris"];
    b.entries[1].edukatorNama = "Ns. Rina";
    b.persiapan.hambatan = ["Bahasa"];
    expect(daunBeda(a, b)).toEqual(["alamat", "bahasa", "persiapan.hambatan", "entries.1.edukatorNama"]);
  });
  it("larik objek beda panjang = satu daun", () => {
    const a = contoh();
    const b = contoh();
    b.skLain.push({ teks: "x", lama: "" });
    expect(daunBeda(a, b)).toEqual(["skLain"]);
  });
  it("sama → kosong; urutan kunci objek tak berpengaruh", () => {
    expect(daunBeda({ a: 1, b: { c: 2, d: 3 } }, { b: { d: 3, c: 2 }, a: 1 })).toEqual([]);
  });
});

describe("bentukIsian", () => {
  it("melengkapi kunci hilang dari kosong() dan baris tetap RM.01", () => {
    const def = definisiForm("RM.01")!;
    const lama = { ...def.kosong(), skLain: [] } as Record<string, unknown>;
    delete lama.catatan;
    const b = bentukIsian<Record<string, unknown>>(def, lama);
    expect(b.catatan).toBe("");
    expect(b.skLain).toEqual([
      { teks: "", lama: "" },
      { teks: "", lama: "" },
      { teks: "", lama: "" },
    ]);
    // Idempoten & tak memutasi masukan.
    expect(bentukIsian(def, b)).toEqual(b);
    expect(lama.skLain).toEqual([]);
  });
  it("lengkapiKunci rekursif pada objek bersarang (RM.21 persiapan)", () => {
    const def = definisiForm("RM.21")!;
    const kosong = def.kosong() as { persiapan: Record<string, unknown> };
    const lama = structuredClone(kosong);
    delete lama.persiapan.tipePembelajaran;
    expect((lengkapiKunci(lama, kosong) as typeof kosong).persiapan.tipePembelajaran).toEqual([]);
  });
});

describe("susunUbah", () => {
  it("hanya kolom yang berubah, dengan nilai dasar & baru; kolom tertaut diabaikan", () => {
    const dasar = { ...contoh(), keadaanKeluar: "" };
    const lokal = structuredClone(dasar);
    lokal.alamat = "Jl. Baru";
    lokal.keadaanKeluar = "Sembuh";
    lokal.entries[0].aktif = true;
    expect(susunUbah(dasar, lokal, ["keadaanKeluar"])).toEqual([
      { p: "alamat", d: "Jl. A", n: "Jl. Baru" },
      { p: "entries.0.aktif", d: false, n: true },
    ]);
  });
});

describe("gabungkan (server)", () => {
  it("kolom berbeda bersamaan → keduanya masuk tanpa konflik", () => {
    const sekarang = denganNilai(contoh(), "telp", "0812"); // diubah orang lain
    const h = gabungkan(sekarang, [{ p: "alamat", d: "Jl. A", n: "Jl. B" }]);
    expect(h.jenis).toBe("ok");
    if (h.jenis !== "ok") return;
    expect(h.data).toMatchObject({ alamat: "Jl. B", telp: "0812" });
    expect(h.diterapkan).toEqual([{ p: "alamat", s: "Jl. A", j: "Jl. B" }]);
    expect(sekarang.alamat).toBe("Jl. A"); // tak dimutasi
  });
  it("kolom sama, nilai beda → konflik dan tak ada yang diterapkan", () => {
    const sekarang = denganNilai(contoh(), "alamat", "Jl. C");
    const h = gabungkan(sekarang, [
      { p: "alamat", d: "Jl. A", n: "Jl. B" },
      { p: "telp", d: "", n: "0812" },
    ]);
    expect(h).toEqual({ jenis: "konflik", konflik: [{ p: "alamat", mereka: "Jl. C" }] });
  });
  it("kolom sama, nilai sama → tidak berubah, tanpa konflik", () => {
    const sekarang = denganNilai(contoh(), "alamat", "Jl. B");
    const h = gabungkan(sekarang, [{ p: "alamat", d: "Jl. A", n: "Jl. B" }]);
    expect(h).toEqual({ jenis: "ok", data: sekarang, diterapkan: [] });
  });
  it("TIMPA: dasar = nilai mereka → dipasang & ditandai t", () => {
    const sekarang = denganNilai(contoh(), "alamat", "Jl. C");
    const h = gabungkan(sekarang, [{ p: "alamat", d: "Jl. C", n: "Jl. B" }], { timpa: new Set(["alamat"]) });
    expect(h.jenis === "ok" && h.diterapkan).toEqual([{ p: "alamat", s: "Jl. C", j: "Jl. B", t: true }]);
  });
  it("kolom diabaikan (tertaut) dilewati", () => {
    const h = gabungkan({ a: "", keadaanKeluar: "Sembuh" }, [{ p: "keadaanKeluar", d: "Sembuh", n: "x" }], {
      abaikan: ["keadaanKeluar"],
    });
    expect(h).toEqual({ jenis: "ok", data: { a: "", keadaanKeluar: "Sembuh" }, diterapkan: [] });
  });
  it("menolak path tak aman, tak dikenal, di luar batas, ganda, tumpang, dan terlalu banyak", () => {
    const s = contoh();
    const galat = (ubah: { p: string; d: unknown; n: unknown }[]) => gabungkan(s, ubah).jenis;
    expect(galat([{ p: "__proto__", d: null, n: { x: 1 } }])).toBe("galat");
    expect(galat([{ p: "constructor.prototype.x", d: null, n: 1 }])).toBe("galat");
    expect(galat([{ p: "tidakAda", d: null, n: 1 }])).toBe("galat");
    expect(galat([{ p: "persiapan", d: s.persiapan, n: {} }])).toBe("galat"); // objek bukan daun
    expect(galat([{ p: "entries.0", d: s.entries[0], n: {} }])).toBe("galat");
    expect(galat([{ p: "entries", d: s.entries, n: [] }])).toBe("ok"); // larik = daun utuh
    expect(galat([{ p: "entries.9.aktif", d: false, n: true }])).toBe("galat");
    expect(galat([{ p: "alamat", d: "Jl. A", n: "1" }, { p: "alamat", d: "Jl. A", n: "2" }])).toBe("galat");
    expect(galat([{ p: "entries.0", d: null, n: null }, { p: "entries.0.aktif", d: false, n: true }])).toBe("galat");
    expect(galat(Array.from({ length: MAKS_UBAH + 1 }, () => ({ p: "alamat", d: "Jl. A", n: "x" })))).toBe("galat");
    expect(({} as Record<string, unknown>).x).toBeUndefined();
  });
});

describe("rebase (klien)", () => {
  it("lokal tak berubah → isi server", () => {
    const d = contoh();
    const server = denganNilai(d, "telp", "0812");
    expect(rebase(d, structuredClone(d), server)).toEqual({ lokal: server, dasar: server, bentrok: [] });
  });
  it("kolom berbeda: perubahan lokal dipindah ke atas server", () => {
    const d = contoh();
    const lokal = denganNilai(d, "alamat", "Jl. B");
    const server = denganNilai(d, "telp", "0812");
    const r = rebase(d, lokal, server);
    expect(r.bentrok).toEqual([]);
    expect(r.lokal).toMatchObject({ alamat: "Jl. B", telp: "0812" });
    expect(r.dasar).toEqual(server);
    expect(susunUbah(r.dasar, r.lokal)).toEqual([{ p: "alamat", d: "Jl. A", n: "Jl. B" }]);
  });
  it("kolom sama berbeda → bentrok; dasar lama dipertahankan agar server menjawab konflik", () => {
    const d = contoh();
    const lokal = denganNilai(d, "alamat", "Jl. B");
    const server = denganNilai(d, "alamat", "Jl. C");
    const r = rebase(d, lokal, server);
    expect(r.bentrok).toEqual(["alamat"]);
    expect(r.lokal.alamat).toBe("Jl. B");
    expect(r.dasar.alamat).toBe("Jl. A");
    // Simpan berikutnya → server melihat konflik, bukan menimpa diam-diam.
    expect(gabungkan(server, susunUbah(r.dasar, r.lokal)).jenis).toBe("konflik");
  });
  it("kolom sama, nilai sama → bukan bentrok", () => {
    const d = contoh();
    const r = rebase(d, denganNilai(d, "alamat", "Jl. B"), denganNilai(d, "alamat", "Jl. B"));
    expect(r.bentrok).toEqual([]);
    expect(susunUbah(r.dasar, r.lokal)).toEqual([]);
  });
  it("larik objek berubah panjang di server: lokal di baris yang sama → bentrok di leluhur", () => {
    const d = contoh();
    const lokal = denganNilai(d, "skLain.0.teks", "Hipertensi");
    const server = structuredClone(d);
    server.skLain = [{ teks: "DM", lama: "" }, { teks: "", lama: "" }];
    const r = rebase(d, lokal, server);
    expect(r.bentrok).toEqual(["skLain"]);
    expect(r.lokal.skLain).toEqual([{ teks: "Hipertensi", lama: "" }]);
  });
});

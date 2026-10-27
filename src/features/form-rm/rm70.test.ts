import { describe, expect, it } from "vitest";
import { pecahBarisTeks } from "./PartografSvg";
import { definisiForm } from "./registry";
import {
  bulatSetengahJam,
  cekParafRm70,
  emptyRm70Form,
  garisDariWaktu,
  jadwalBerikut,
  jadwalKala4,
  jamGaris,
  kekuranganRm70,
  kelasApgar,
  kemajuanTerburuk,
  labelJamGrafik,
  lengkapiRm70,
  normBertitik,
  pasangSel,
  pasangTitik,
  posisiKemajuan,
  statusLangkahRm70,
  tandaBahaya,
  tanggalLahirTitik,
  teksApgar,
  totalPerdarahanKala4,
  waspadaMenurutGrafik,
  type Rm70Data,
} from "./rm70.constants";
import { GARIS_BERTINDAK, GARIS_WASPADA, PITA, TINGGI, X0, XN, nilaiDariY, pitaDi, posisiX, xGaris, yNilai } from "./rm70.geometri";
import { rm70FormSchema } from "./skema";

const TTD = "ttd:abcdefghijklmnopqrstuvwx";
const PNG = "data:image/png;base64,iVBORw0KGgo=";

/** Isian minimal yang memenuhi syarat FINAL. */
function lengkap(): Rm70Data {
  const d = emptyRm70Form();
  d.gravida = "3";
  d.para = "2";
  d.abortus = "0";
  d.masukWaktu = "2026-10-07T07:00";
  d.grafik.mulai = "2026-10-07T07:00";
  d.grafik.djj = [{ k: 0, v: 136 }];
  d.grafik.pembukaan = [{ k: 0, v: 5 }];
  d.grafik.paraf = [{ id: "abc123def", c: 0, nama: "Bd. Sari", paraf: TTD }];
  d.persalinan.tanggal = "2026-10-07";
  d.persalinan.penolong = "Bd. Sari";
  d.persalinan.tempat = "lainnya";
  d.persalinan.tempatLain = "RSUD Boltim";
  d.persalinan.kala1.waspada = "T";
  return d;
}

describe("RM.70 skema", () => {
  it("isian kosong & isian lengkap lolos skema strict", () => {
    expect(rm70FormSchema.safeParse(emptyRm70Form()).success).toBe(true);
    expect(rm70FormSchema.safeParse(lengkap()).success).toBe(true);
  });

  it("nilai di luar rentang sah, garis ganda, dan kode asing ditolak", () => {
    const tolak = (ubah: (d: Rm70Data) => void) => {
      const d = lengkap();
      ubah(d);
      return rm70FormSchema.safeParse(d).success;
    };
    expect(tolak((d) => (d.grafik.djj = [{ k: 0, v: 250 }]))).toBe(false);
    expect(tolak((d) => (d.grafik.djj = [{ k: 31, v: 140 }]))).toBe(false);
    expect(tolak((d) => (d.grafik.djj = [{ k: 0, v: 140.5 }]))).toBe(false);
    expect(tolak((d) => (d.grafik.djj = [{ k: 2, v: 140 }, { k: 2, v: 150 }]))).toBe(false);
    expect(tolak((d) => (d.grafik.pembukaan = [{ k: 0, v: 11 }]))).toBe(false);
    expect(tolak((d) => (d.grafik.penurunan = [{ k: 0, v: 6 }]))).toBe(false);
    expect(tolak((d) => (d.grafik.ketuban = [{ c: 0, v: "X" as "U" }]))).toBe(false);
    expect(tolak((d) => (d.grafik.ketuban = [{ c: 30, v: "U" }]))).toBe(false);
    expect(tolak((d) => (d.grafik.kontraksi = [{ c: 0, n: 6, d: "<20" }]))).toBe(false);
    expect(tolak((d) => (d.grafik.td = [{ k: 0, s: 80, d: 120 }]))).toBe(false);
    expect(tolak((d) => (d.grafik.td = [{ k: 0, s: null, d: null }]))).toBe(false);
    expect(tolak((d) => (d.grafik.suhu = [{ c: 0, v: "" }]))).toBe(false);
    expect(tolak((d) => (d.grafik.paraf = [...d.grafik.paraf, { id: "abc123def", c: 1, nama: "B", paraf: "" }]))).toBe(false);
    expect(tolak((d) => ((d.grafik as Record<string, unknown>).liar = 1))).toBe(false);
    expect(tolak((d) => (d.kala4.baris[1].suhu = "36,5"))).toBe(false);
    expect(tolak((d) => d.kie.pop())).toBe(false);
    expect(tolak((d) => (d.persalinan.kala2.pendamping = ["suami", "suami"]))).toBe(false);
    expect(tolak((d) => (d.bayi.apgar1 = "11"))).toBe(false);
    // Yang sah tetap lolos.
    expect(tolak((d) => (d.grafik.td = [{ k: 0, s: 120, d: null }]))).toBe(true);
    expect(tolak((d) => (d.kala4.baris[4].suhu = "36,5"))).toBe(true);
  });

  it("lengkapiRm70: data tersimpan sebagian dilengkapi bentuk kosong", () => {
    const d = lengkapiRm70({ gravida: "2", grafik: { djj: [{ k: 1, v: 140 }] }, kala4: { baris: [{ pukul: "13:00" }] } });
    expect(d.gravida).toBe("2");
    expect(d.grafik.djj).toHaveLength(1);
    expect(d.grafik.nadi).toEqual([]);
    expect(d.kala4.baris).toHaveLength(6);
    expect(d.kala4.baris[0]).toMatchObject({ pukul: "13:00", td: "" });
    expect(d.kie).toHaveLength(7);
    expect(lengkapiRm70(null).persalinan.kala3.oksitosin).toEqual({ jawab: "", alasan: "" });
  });
});

describe("RM.70 syarat FINAL & status langkah", () => {
  it("isian lengkap minimal tanpa kekurangan; langkah opsional tak tersentuh = kosong", () => {
    const d = lengkap();
    expect(Object.values(kekuranganRm70(d)).flat()).toEqual([]);
    expect(statusLangkahRm70(d, "data", [])).toBe("lengkap");
    expect(statusLangkahRm70(d, "bayi", [])).toBe("kosong");
    expect(statusLangkahRm70(d, "kala4", [])).toBe("kosong");
  });

  it("kekurangan wajib & bersyarat", () => {
    const k = kekuranganRm70(emptyRm70Form());
    expect(k.data).toContain("G (gravida)");
    expect(k.partograf).toContain("Minimal satu pemeriksaan pembukaan serviks (X)");
    expect(k.persalinan).toContain("Penolong persalinan");
    expect(k.bayi).toEqual([]);

    const d = lengkap();
    d.grafik.paraf = [{ id: "abc123def", c: 2, nama: "Bd. Sari", paraf: "" }];
    d.grafik.td = [{ k: 1, s: 120, d: null }];
    d.bayi.berat = "2500";
    d.kie[0].ket = "sudah";
    d.kala4.baris[2].nadi = "88";
    const x = kekuranganRm70(d);
    expect(x.partograf).toEqual(["Nama & paraf petugas", "Paraf pukul 08.00: paraf belum diisi", "TD pukul 07.30: diastolik belum diisi"]);
    expect(x.bayi).toEqual(["Panjang badan (cm)", "Jenis kelamin L/P", "Nilai APGAR menit 1 & 5"]);
    expect(x.kie).toEqual(["Senam nifas: tanggal", "Senam nifas: pelaksana"]);
    expect(x.kala4).toEqual(["Baris 3: pukul"]);
  });

  it("registri: slot paraf berpath stabil & syarat FINAL sama dengan kekurangan", () => {
    const def = definisiForm("RM.70")!;
    const d = lengkap();
    d.grafik.paraf.push({ id: "zzz999yyy", c: 4, nama: "Bd. Rina", paraf: PNG });
    const slot: string[] = [];
    def.petaTtd(d, (v, s) => (slot.push(s), v));
    expect(slot).toEqual(["grafik.paraf.0.paraf", "grafik.paraf.1.paraf"]);
    expect(def.syaratFinal(lengkap())).toEqual([]);
    expect([def.berulang, def.wajibUntuk, def.sasaran.jenis, def.kategori, def.kertas]).toEqual([
      false,
      [],
      [2, 3],
      "kebidanan",
      { ukuran: "F4", orientasi: "potret" },
    ]);
  });
});

describe("RM.70 garis waspada & bertindak", () => {
  it("posisi pemeriksaan terhadap garis", () => {
    expect(posisiKemajuan({ k: 0, v: 3 })).toBe("fase-laten");
    expect(posisiKemajuan({ k: 2, v: 5 })).toBe("aman"); // tepat di garis waspada
    expect(posisiKemajuan({ k: 3, v: 5 })).toBe("waspada");
    expect(posisiKemajuan({ k: 10, v: 5 })).toBe("bertindak"); // 4 jam di kanan garis waspada
    expect(posisiKemajuan({ k: 12, v: 10 })).toBe("aman");
    expect(posisiKemajuan({ k: 20, v: 10 })).toBe("bertindak");
  });

  it("terburuk & jawaban Y/T menurut grafik", () => {
    expect(kemajuanTerburuk([])).toBeNull();
    expect(waspadaMenurutGrafik([{ k: 0, v: 3 }])).toBe("");
    expect(waspadaMenurutGrafik([{ k: 0, v: 5 }, { k: 4, v: 8 }])).toBe("T");
    const p = [{ k: 0, v: 4 }, { k: 6, v: 6 }, { k: 9, v: 7 }];
    expect(kemajuanTerburuk(p)).toEqual({ posisi: "waspada", titik: { k: 6, v: 6 } });
    expect(waspadaMenurutGrafik(p)).toBe("Y");
  });
});

describe("RM.70 tanda bahaya & jadwal", () => {
  it("temuan di luar batas", () => {
    const g = emptyRm70Form().grafik;
    g.djj = [{ k: 0, v: 140 }, { k: 1, v: 168 }, { k: 2, v: 110 }];
    g.nadi = [{ k: 0, v: 110 }];
    g.td = [{ k: 0, s: 150, d: 95 }];
    g.suhu = [{ c: 0, v: "38,2" }];
    g.ketuban = [{ c: 0, v: "M" }];
    g.penyusupan = [{ c: 0, v: "3" }];
    g.protein = [{ c: 0, v: "++" }];
    const b = tandaBahaya(g);
    expect(b.map((x) => x.pesan)).toEqual([
      "Air ketuban bercampur mekonium",
      "Penyusupan 3 — tak dapat dipisahkan",
      "Nadi ibu 110 > 100",
      "TD 150/95 — hipertensi",
      "Suhu 38,2 °C ≥ 38",
      "Protein urine ++",
      "DJJ 168 > 160",
      "DJJ 110 < 120",
    ]);
    expect(b.filter((x) => x.nada === "danger").map((x) => x.lajur)).toEqual(["penyusupan", "djj", "djj"]);
  });

  it("pemeriksaan berikutnya dari pencatatan terakhir", () => {
    const g = emptyRm70Form().grafik;
    g.djj = [{ k: 4, v: 140 }];
    g.pembukaan = [{ k: 0, v: 5 }];
    expect(jadwalBerikut(g, null)).toEqual([
      { id: "djj", label: "DJJ", k: 5, terlambat: false },
      { id: "pembukaan", label: "Periksa dalam", k: 8, terlambat: false },
    ]);
    expect(jadwalBerikut(g, 6).find((j) => j.id === "djj")?.terlambat).toBe(true);
    g.djj = [{ k: 30, v: 140 }];
    expect(jadwalBerikut(g, null).map((j) => j.id)).toEqual(["pembukaan"]);
  });
});

describe("RM.70 waktu", () => {
  it("jam garis, lajur waktu, pembulatan", () => {
    expect(jamGaris("2026-10-07T07:00", 3)).toBe("08.30");
    expect(jamGaris("2026-10-07T23:30", 2)).toBe("00.30");
    expect(jamGaris("", 3)).toBe("");
    expect(labelJamGrafik("2026-10-07T07:00").slice(0, 3)).toEqual(["07.00", "08.00", "09.00"]);
    expect(labelJamGrafik("2026-10-07T07:00")).toHaveLength(15);
    expect(bulatSetengahJam("2026-10-07T07:20")).toBe("2026-10-07T07:00");
    expect(bulatSetengahJam("2026-10-07T07:45")).toBe("2026-10-07T07:30");
    expect(bulatSetengahJam("x")).toBe("");
    expect(garisDariWaktu("2026-10-07T07:00", "2026-10-07T09:15")).toBe(4.5);
    expect(garisDariWaktu("2026-10-07T23:00", "2026-10-08T01:00")).toBe(4);
  });

  it("jadwal Kala IV & total perdarahan", () => {
    expect(jadwalKala4("13:00")).toEqual(["13:00", "13:15", "13:30", "13:45", "14:15", "14:45"]);
    expect(jadwalKala4("23:50").at(-1)).toBe("01:35");
    expect(jadwalKala4("")).toEqual([]);
    const b = emptyRm70Form().kala4.baris;
    expect(totalPerdarahanKala4(b)).toBeNull();
    b[0].perdarahan = "50";
    b[1].perdarahan = "25";
    expect(totalPerdarahanKala4(b)).toBe(75);
  });
});

describe("RM.70 lajur & bantu", () => {
  it("pasang titik/sel: satu per posisi, urut, null = hapus", () => {
    const a = pasangTitik([{ k: 4, v: 1 }], 2, { k: 2, v: 2 });
    expect(a).toEqual([{ k: 2, v: 2 }, { k: 4, v: 1 }]);
    expect(pasangTitik(a, 4, { k: 4, v: 9 })).toEqual([{ k: 2, v: 2 }, { k: 4, v: 9 }]);
    expect(pasangTitik(a, 2, null)).toEqual([{ k: 4, v: 1 }]);
    expect(pasangSel([{ c: 3, v: "x" }], 1, { c: 1, v: "y" }).map((s) => s.c)).toEqual([1, 3]);
  });

  it("APGAR, No. RM bertitik, tanggal lahir", () => {
    expect(kelasApgar("8")).toEqual({ nilai: 8, kelas: "normal" });
    expect(kelasApgar("5")?.kelas).toBe("sedang");
    expect(kelasApgar("2")?.kelas).toBe("berat");
    expect(kelasApgar("")).toBeNull();
    expect(teksApgar({ apgar1: "5", apgar5: "6" })).toBe("5/6");
    expect(normBertitik("34734")).toBe("03.47.34");
    expect(normBertitik("1234567")).toBe("1234567");
    expect(normBertitik("—")).toBe("");
    expect(tanggalLahirTitik("1990-01-16T00:00:00.000Z")).toBe("16.01.1990");
    expect(tanggalLahirTitik(null)).toBe("");
  });

  it("pecah baris catatan grafik di batas kata, maks baris", () => {
    expect(pecahBarisTeks("J. 13.00 lahir bayi laki-laki BB 2500 gr", 20, 5)).toEqual(["J. 13.00 lahir bayi", "laki-laki BB 2500 gr"]);
    expect(pecahBarisTeks("a\nb\nc", 10, 2)).toEqual(["a", "b"]);
    expect(pecahBarisTeks("x".repeat(25), 10, 5)).toEqual(["xxxxxxxxxx", "xxxxxxxxxx", "xxxxx"]);
  });
});

describe("RM.70 aturan paraf", () => {
  it("paraf baru selalu sah; referensi hanya dari kotak tersimpan bernama sama", () => {
    const lama = { grafik: { paraf: [{ id: "a1b2c3d4", c: 0, nama: "Bd. Sari", paraf: TTD }] } };
    const baru = (nama: string, paraf: string, c = 3) => ({ grafik: { ...emptyRm70Form().grafik, paraf: [{ id: "q1w2e3r4", c, nama, paraf }] } });
    expect(cekParafRm70(lama, baru("Bd. Rina", PNG))).toBeNull();
    expect(cekParafRm70(lama, baru("bd. sari", TTD))).toBeNull(); // pakai ulang oleh petugas yang sama
    expect(cekParafRm70(lama, baru("Bd. Rina", TTD))).not.toBeNull();
    expect(cekParafRm70(null, baru("Bd. Sari", TTD))).not.toBeNull();
  });
});

describe("RM.70 geometri grafik", () => {
  it("muat di area cetak F4 bersama kop; skala nilai dua arah", () => {
    expect(TINGGI).toBeLessThanOrEqual(258);
    expect(yNilai("djj", 200)).toBeCloseTo(PITA.djj.atas);
    expect(yNilai("djj", 80)).toBeCloseTo(PITA.djj.bawah);
    expect(yNilai("djj", 300)).toBeCloseTo(PITA.djj.atas); // dijepit
    expect(nilaiDariY("ibu", yNilai("ibu", 120))).toBeCloseTo(120);
    expect(nilaiDariY("serviks", yNilai("serviks", 7))).toBeCloseTo(7);
  });

  it("klik → pita, garis & kotak", () => {
    expect(pitaDi(PITA.kontraksi.atas + 1)).toBe("kontraksi");
    expect(pitaDi(PITA.djj.atas - 0.5)).toBe("djj"); // toleransi setengah baris di tepi grafik
    expect(pitaDi(0)).toBeNull();
    expect(posisiX(X0 + 5.2 * 3.4)).toEqual({ k: 3, c: 3 });
    expect(posisiX(X0 + 5.2 * 3.6)).toEqual({ k: 4, c: 3 });
    expect(posisiX(XN + 1)).toEqual({ k: 30, c: 29 });
    expect(posisiX(5)).toBeNull();
  });

  it("garis waspada 4 → 10 cm dalam 6 jam; bertindak 4 jam di kanannya", () => {
    expect(GARIS_WASPADA.x1).toBeCloseTo(xGaris(0));
    expect(GARIS_WASPADA.x2).toBeCloseTo(xGaris(12));
    expect(GARIS_WASPADA.y2).toBeCloseTo(PITA.serviks.atas);
    expect(GARIS_BERTINDAK.x1).toBeCloseTo(xGaris(8));
    expect(GARIS_BERTINDAK.x2).toBeCloseTo(xGaris(20));
  });
});

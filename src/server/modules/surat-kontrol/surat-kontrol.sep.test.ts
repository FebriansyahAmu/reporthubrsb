import { describe, expect, it } from "vitest";
import { eksporSepQuerySchema, sepQuerySchema } from "./surat-kontrol.schema";
import {
  cocokCariSep,
  hitungRekap,
  rekapAudit,
  rekapPerHari,
  rekapPerRuangan,
  layananJenis,
  namaRuanganSep,
  nilaiStatusSep,
  ringkasSep,
  ringkasSepPerHari,
  ringkasSepPerRuangan,
  saringSep,
  teksSelisihSep,
  urutkanSep,
} from "./surat-kontrol.sep";
import { STATUS_SEP, STATUS_SEP_GRAFIK, STATUS_SEP_KEYS, STATUS_SEP_TERBACA } from "./surat-kontrol.sep.constants";
import type { RekapSep, SepKontrol, SepPemakai, SuratSep } from "./surat-kontrol.sep.types";

const surat = (o: Partial<SuratSep> = {}): SuratSep => ({
  noSurat: "0491R0011126K000100",
  jenis: 2,
  tglTerbit: "2026-11-20",
  asalTerbit: "LIVE",
  tglRencana: "2026-11-20",
  poliTujuan: { kode: "INT", nama: "PENYAKIT DALAM" },
  dokter: { kode: "123", nama: "dr. Uji" },
  sepTerbitBpjs: true,
  pembuat: "petugas.poli",
  aktif: true,
  ...o,
});

const pemakai = (o: Partial<SepPemakai> = {}): SepPemakai => ({
  sep: "0491R0011126V000900",
  tglSep: "2026-11-20",
  jamSep: "09:15",
  layanan: "RJ",
  ruangan: { id: "101030101", nama: "Poli Interna" },
  poliSep: { kode: "INT", nama: "PENYAKIT DALAM" },
  pembuatSep: "petugas.loket",
  jumlahSep: 1,
  ...o,
});

/** `sep: null` = surat belum dipakai SEP. */
const baris = (key: string, o: { surat?: Partial<SuratSep>; sep?: Partial<SepPemakai> | null; asal?: SepKontrol["asal"] } = {}): SepKontrol => {
  const s = surat({ noSurat: key, ...o.surat });
  const p = o.sep === null ? null : pemakai({ layanan: layananJenis(s.jenis), ...o.sep });
  const { status, selisihHari } = nilaiStatusSep(s.tglTerbit, p?.tglSep ?? null, s.sepTerbitBpjs);
  return {
    key,
    surat: s,
    layanan: p?.layanan ?? layananJenis(s.jenis),
    noKartu: "0001234567890",
    nopen: p ? "2611200001" : null,
    norm: "123",
    pasien: "Pasien Uji",
    sep: p,
    asal: o.asal !== undefined ? o.asal : s.jenis === 2 ? { sep: "0491R0011126V000001", layanan: "RI", tglSep: "2026-11-10", tglPulang: "2026-11-14" } : null,
    selisihHari,
    hariSejakPulangAsal: null,
    status,
  };
};

describe("nilaiStatusSep — tanggal entri surat vs tanggal SEP pemakai", () => {
  it("sama hari = Surat = SEP (temuan)", () => {
    expect(nilaiStatusSep("2026-11-20", "2026-11-20")).toEqual({ status: "SAMA_HARI", selisihHari: 0 });
  });
  it("sebelum / setelah SEP memakai selisih hari kalender (lintas bulan)", () => {
    expect(nilaiStatusSep("2026-10-29", "2026-11-03")).toEqual({ status: "SEBELUM_SEP", selisihHari: -5 });
    expect(nilaiStatusSep("2026-11-02", "2026-10-31")).toEqual({ status: "SETELAH_SEP", selisihHari: 2 });
  });
  it("dipakai SEP tetapi tanggal entri belum terbaca", () => {
    expect(nilaiStatusSep(null, "2026-11-20")).toEqual({ status: "TAK_TERBACA", selisihHari: null });
  });
  it("tanpa SEP: belum dipakai, kecuali BPJS menandai sudah dipakai → SEP tak tercatat", () => {
    expect(nilaiStatusSep("2026-11-20", null, false)).toEqual({ status: "BELUM_DIPAKAI", selisihHari: null });
    expect(nilaiStatusSep("2026-11-20", null, null)).toEqual({ status: "BELUM_DIPAKAI", selisihHari: null });
    expect(nilaiStatusSep("2026-11-20", null, true)).toEqual({ status: "SEP_TAK_TERCATAT", selisihHari: null });
  });
  it("teks selisih untuk manusia", () => {
    expect(teksSelisihSep({ status: "SAMA_HARI", selisihHari: 0 })).toBe("Hari yang sama dengan SEP");
    expect(teksSelisihSep({ status: "SEBELUM_SEP", selisihHari: -5 })).toBe("5 hari sebelum SEP");
    expect(teksSelisihSep({ status: "SETELAH_SEP", selisihHari: 2 })).toBe("2 hari setelah SEP");
    expect(teksSelisihSep({ status: "BELUM_DIPAKAI", selisihHari: null })).toBe("Belum dipakai SEP");
  });
  it("layanan yang diharapkan dari jenis surat", () => {
    expect(layananJenis(1)).toBe("RI");
    expect(layananJenis(2)).toBe("RJ");
  });
});

describe("saring, urut & ringkas", () => {
  const data = [
    baris("A"), // Kontrol = SEP, asal RI
    baris("B", { surat: { tglTerbit: "2026-11-14", tglRencana: "2026-11-21" }, sep: { tglSep: "2026-11-21" } }), // sebelum SEP
    baris("C", { surat: { jenis: 1, tglTerbit: "2026-11-21", tglRencana: "2026-11-21" }, sep: { tglSep: "2026-11-21", ruangan: { id: "R1", nama: "Bangsal Anggrek" } } }), // SPRI = SEP
    baris("D", { surat: { jenis: 1, tglTerbit: "2026-11-23", tglRencana: "2026-11-22" }, sep: { tglSep: "2026-11-22", ruangan: { id: "R1", nama: "Bangsal Anggrek" } } }), // SPRI setelah SEP
    baris("E", { surat: { tglTerbit: null, asalTerbit: null, tglRencana: "2026-11-22" }, sep: { tglSep: "2026-11-22" } }), // belum terbaca
    baris("F", { surat: { tglTerbit: "2026-11-22", tglRencana: "2026-11-22" }, sep: { tglSep: "2026-11-22" }, asal: { sep: "S-RJ", layanan: "RJ", tglSep: "2026-11-01", tglPulang: null } }), // Kontrol = SEP, asal RJ
    baris("G", { surat: { tglTerbit: "2026-11-15", tglRencana: "2026-11-23", sepTerbitBpjs: false }, sep: null }), // belum dipakai
    baris("H", { surat: { jenis: 1, tglTerbit: "2026-11-23", tglRencana: "2026-11-23" }, sep: null }), // SPRI: BPJS sudah, SIMGOS tak ada
  ];

  it("bawaan hanya Surat Kontrol; SPRI ikut bila disertakan; SPRI saja", () => {
    expect(saringSep(data, {}).map((e) => e.key)).toEqual(["A", "B", "E", "F", "G"]);
    expect(saringSep(data, { spri: true })).toHaveLength(8);
    expect(saringSep(data, { spri: true, jenis: 1 }).map((e) => e.key)).toEqual(["C", "D", "H"]);
    // Jenis SPRI tanpa menyertakan SPRI = kosong (SPRI tak pernah bocor ke tampilan bawaan).
    expect(saringSep(data, { jenis: 1 })).toEqual([]);
  });

  it("status, ruangan, tanggal RENCANA & cari (termasuk penerbit, no. kartu)", () => {
    expect(saringSep(data, { spri: true, status: "SAMA_HARI" }).map((e) => e.key)).toEqual(["A", "C", "F"]);
    expect(saringSep(data, { spri: true, ruangan: "Bangsal Anggrek" }).map((e) => e.key)).toEqual(["C", "D"]);
    expect(saringSep(data, { tanggal: "2026-11-22" }).map((e) => e.key)).toEqual(["E", "F"]);
    expect(saringSep(data, { q: "PETUGAS.POLI" })).toHaveLength(5);
    expect(cocokCariSep(data[0], "v000001")).toBe(true); // SEP asal
    expect(cocokCariSep(data[6], "1234567890")).toBe(true); // no. kartu, surat belum dipakai
    expect(cocokCariSep(data[0], "tidak-ada")).toBe(false);
  });

  it("ruangan surat yang belum dipakai = poli tujuan surat", () => {
    expect(namaRuanganSep(data[6])).toBe("PENYAKIT DALAM");
    expect(namaRuanganSep(data[0])).toBe("Poli Interna");
  });

  it("urutan: Surat = SEP dulu … belum dipakai terakhir; dalam status rencana terbaru dulu", () => {
    expect(urutkanSep([...data]).map((e) => e.key)).toEqual(["F", "C", "A", "D", "E", "H", "B", "G"]);
  });

  it("ringkasan: total = semua surat, persen dari yang terpakai & terbaca; asal RI/RJ hanya Surat Kontrol", () => {
    const r = ringkasSep(saringSep(data, { spri: true }));
    expect(r.total).toBe(8);
    expect(r.dipakai).toBe(6);
    expect(r.terbaca).toBe(5);
    expect(r.perStatus).toEqual({ SAMA_HARI: 3, SETELAH_SEP: 1, TAK_TERBACA: 1, SEP_TAK_TERCATAT: 1, SEBELUM_SEP: 1, BELUM_DIPAKAI: 1 });
    expect(r.persenSama).toBe(60);
    expect(r.samaDariRi).toBe(1);
    expect(r.samaDariRj).toBe(1);
    expect(ringkasSep([]).persenSama).toBeNull();
  });

  it("per hari (tanggal rencana) mengisi setiap tanggal; belum dipakai ikut, belum terbaca & SEP tak tercatat tidak", () => {
    const h = ringkasSepPerHari(saringSep(data, { spri: true }), "2026-11-20", "2026-11-24");
    expect(h.map((x) => x.tanggal)).toEqual(["2026-11-20", "2026-11-21", "2026-11-22", "2026-11-23", "2026-11-24"]);
    expect(h[0]).toEqual({ tanggal: "2026-11-20", SEBELUM_SEP: 0, SETELAH_SEP: 0, SAMA_HARI: 1, BELUM_DIPAKAI: 0 });
    expect(h[2]).toEqual({ tanggal: "2026-11-22", SEBELUM_SEP: 0, SETELAH_SEP: 1, SAMA_HARI: 1, BELUM_DIPAKAI: 0 });
    expect(h[3]).toEqual({ tanggal: "2026-11-23", SEBELUM_SEP: 0, SETELAH_SEP: 0, SAMA_HARI: 0, BELUM_DIPAKAI: 1 });
  });

  it("per ruangan: Surat = SEP terbanyak dulu, belum dipakai dihitung", () => {
    const r = ringkasSepPerRuangan(saringSep(data, { spri: true }));
    expect(r[0]).toMatchObject({ ruangan: "Poli Interna", layanan: "RJ", total: 4, terbaca: 3, sama: 2, setelah: 0, belum: 0 });
    expect(r.find((x) => x.ruangan === "Bangsal Anggrek")).toMatchObject({ layanan: "RI", total: 2, sama: 1, setelah: 1 });
    expect(r.find((x) => x.ruangan === "PENYAKIT DALAM" && x.layanan === "RJ")).toMatchObject({ total: 1, belum: 1 });
  });
});

describe("konstanta & skema", () => {
  it("urutan status = prioritas tampilan; penyebut hanya surat terpakai & terbaca", () => {
    expect(STATUS_SEP_KEYS).toEqual(["SAMA_HARI", "SETELAH_SEP", "TAK_TERBACA", "SEP_TAK_TERCATAT", "SEBELUM_SEP", "BELUM_DIPAKAI"]);
    expect(STATUS_SEP_TERBACA).toEqual(["SEBELUM_SEP", "SETELAH_SEP", "SAMA_HARI"]);
    expect(STATUS_SEP_GRAFIK).toContain("BELUM_DIPAKAI");
    for (const k of STATUS_SEP_KEYS) expect(STATUS_SEP[k].jelas.length).toBeGreaterThan(20);
  });

  it("skema tampilan = rentang tanggal rencana; ekspor menolak nilai asing", () => {
    expect(sepQuerySchema.parse({ from: "2026-11-01", to: "2026-11-26", segar: "1" })).toEqual({ from: "2026-11-01", to: "2026-11-26", segar: "1" });
    expect(eksporSepQuerySchema.parse({ spri: "1", jenis: "1", status: "BELUM_DIPAKAI" })).toMatchObject({ spri: "1", jenis: "1", status: "BELUM_DIPAKAI" });
    expect(() => eksporSepQuerySchema.parse({ spri: "ya" })).toThrow();
    expect(() => eksporSepQuerySchema.parse({ jenis: "3" })).toThrow();
    expect(() => eksporSepQuerySchema.parse({ status: "TEPAT" })).toThrow();
    expect(() => eksporSepQuerySchema.parse({ q: "x".repeat(81) })).toThrow();
    expect(() => sepQuerySchema.parse({ from: "2026-02-30" })).toThrow();
  });
});

describe("rekap format audit BPJS (basis tanggal SEP)", () => {
  const rek = (status: RekapSep["status"], jenis: 1 | 2, o: Partial<RekapSep> = {}): RekapSep => ({
    tglSep: "2026-11-10",
    jenis,
    status,
    layanan: jenis === 1 ? "RI" : "RJ",
    ruangan: jenis === 1 ? "Bangsal" : "Poli Interna",
    ...o,
  });
  // Data nyata 1–25 Nov 2026 (RSUD Boltim): Kontrol < 63; SPRI < 3, = 210, > 13 → 66 / 210 / 13 = 289, 22,84 %.
  const data = [
    ...Array.from({ length: 63 }, () => rek("SEBELUM_SEP", 2)),
    ...Array.from({ length: 3 }, () => rek("SEBELUM_SEP", 1)),
    ...Array.from({ length: 210 }, () => rek("SAMA_HARI", 1)),
    ...Array.from({ length: 13 }, () => rek("SETELAH_SEP", 1)),
  ];

  it("cocok dengan tabel audit BPJS: Surkon < / = / > SEP, Grand Total, % setelah selesai pelayanan", () => {
    const r = rekapAudit(data);
    expect(r.total).toEqual({ kurang: 66, sama: 210, lebih: 13, takTerbaca: 0, total: 289, persen: 22.84 });
    expect(r.perJenis[2]).toMatchObject({ kurang: 63, sama: 0, lebih: 0, total: 63, persen: 100 });
    expect(r.perJenis[1]).toMatchObject({ kurang: 3, sama: 210, lebih: 13, total: 226, persen: 1.33 });
  });

  it("tanggal entri belum terbaca tidak masuk Grand Total; kosong → persen null", () => {
    expect(hitungRekap([{ status: "TAK_TERBACA" }, { status: "SEBELUM_SEP" }])).toEqual({ kurang: 1, sama: 0, lebih: 0, takTerbaca: 1, total: 1, persen: 100 });
    expect(hitungRekap([]).persen).toBeNull();
  });

  it("per hari mengisi setiap tanggal SEP di rentang", () => {
    const h = rekapPerHari([rek("SAMA_HARI", 1, { tglSep: "2026-11-02" }), rek("SEBELUM_SEP", 2, { tglSep: "2026-11-02" }), rek("TAK_TERBACA", 2, { tglSep: "2026-11-03" })], "2026-11-01", "2026-11-03");
    expect(h).toEqual([
      { tanggal: "2026-11-01", SEBELUM_SEP: 0, SETELAH_SEP: 0, SAMA_HARI: 0 },
      { tanggal: "2026-11-02", SEBELUM_SEP: 1, SETELAH_SEP: 0, SAMA_HARI: 1 },
      { tanggal: "2026-11-03", SEBELUM_SEP: 0, SETELAH_SEP: 0, SAMA_HARI: 0 },
    ]);
  });

  it("per ruangan: dipisah per layanan, urut total SEP terbanyak", () => {
    const r = rekapPerRuangan(data);
    expect(r.map((x) => [x.ruangan, x.layanan, x.total.total])).toEqual([
      ["Bangsal", "RI", 226],
      ["Poli Interna", "RJ", 63],
    ]);
    expect(r[1].perJenis[2].persen).toBe(100);
  });
});

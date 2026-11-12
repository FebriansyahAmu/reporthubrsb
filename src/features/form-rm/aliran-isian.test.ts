import { describe, expect, it } from "vitest";
import {
  bacaAwal,
  bacaBerubah,
  bacaHadir,
  bacaStatus,
  dataEvent,
  frameIsian,
  MAKS_HADIR,
  MAKS_KOLOM_EVENT,
  potongKolom,
  teksOrang,
  tempatUnit,
} from "./aliran-isian";
import { DETAK_SSE, frameSse } from "./ttd-siaga/sse";

const berubah = {
  rev: 7,
  oleh: "Ns. Budi",
  unit: "IGD",
  ruang: "NON BEDAH",
  kolom: ["alamat", "persiapan.bahasa"],
  lebih: 0,
  waktu: "2026-11-12T02:42:00.000Z",
};

describe("frameIsian", () => {
  it("menyusun frame SSE satu baris dengan event dari daftar tetap", () => {
    expect(frameIsian("awal", { rev: 3, status: "DRAF" })).toBe('event: awal\ndata: {"rev":3,"status":"DRAF"}\n\n');
    expect(frameIsian("detak", {})).toBe(DETAK_SSE);
  });

  it("menolak event di luar daftar (termasuk event TTD siaga)", () => {
    expect(() => frameIsian("ttd" as never, {})).toThrow(RangeError);
    expect(() => frameIsian("awal\ndata: x" as never, {})).toThrow(RangeError);
  });

  it("nilai berisi baris baru tidak bisa menyuntik field/event baru", () => {
    const f = frameIsian("berubah", { ...berubah, oleh: "a\n\nevent: status\ndata: {}" });
    expect(f.split("\n").filter((l) => l.startsWith("event:"))).toEqual(["event: berubah"]);
    expect(f.endsWith("\n\n")).toBe(true);
    expect(f.slice(0, -2)).not.toContain("\n\n");
  });

  it("frame TTD siaga tetap seperti semula (refaktor penyusun)", () => {
    expect(frameSse("selesai", { id: "x" })).toBe('event: selesai\ndata: {"id":"x"}\n\n');
    expect(() => frameSse("berubah" as never, {})).toThrow(RangeError);
  });
});

describe("baca event (klien)", () => {
  const json = (v: unknown) => dataEvent(JSON.stringify(v));

  it("dataEvent: JSON objek saja", () => {
    expect(dataEvent("{bukan json")).toBeNull();
    expect(dataEvent("[1,2]")).toBeNull();
    expect(dataEvent(42)).toBeNull();
    expect(dataEvent('{"a":1}')).toEqual({ a: 1 });
  });

  it("awal & status: rev bulat ≥ 1, status dikenal", () => {
    expect(bacaAwal(json({ rev: 4, status: "FINAL" }))).toEqual({ rev: 4, status: "FINAL" });
    expect(bacaAwal(json({ rev: 0, status: "DRAF" }))).toBeNull();
    expect(bacaAwal(json({ rev: 1.5, status: "DRAF" }))).toBeNull();
    expect(bacaAwal(json({ rev: 2, status: "HAPUS" }))).toBeNull();
    expect(bacaStatus(json({ rev: 9, status: "BATAL", oleh: "dr. A" }))).toEqual({ rev: 9, status: "BATAL", oleh: "dr. A" });
    expect(bacaStatus(json({ rev: 9, status: "BATAL" }))).toBeNull();
  });

  it("berubah: bentuk sah diterima, kolom dibatasi, lebih bawaan 0", () => {
    expect(bacaBerubah(json(berubah))).toEqual(berubah);
    expect(bacaBerubah(json({ ...berubah, lebih: undefined }))?.lebih).toBe(0);
    expect(bacaBerubah(json({ ...berubah, unit: "ICU" }))).toBeNull();
    expect(bacaBerubah(json({ ...berubah, waktu: "kemarin" }))).toBeNull();
    expect(bacaBerubah(json({ ...berubah, kolom: [1] }))).toBeNull();
    expect(bacaBerubah(json({ ...berubah, kolom: Array.from({ length: MAKS_KOLOM_EVENT + 1 }, (_, i) => `k${i}`) }))).toBeNull();
    expect(bacaBerubah(json({ ...berubah, oleh: "x".repeat(192) }))).toBeNull();
    expect(bacaBerubah(json({ ...berubah, ruang: null }))?.ruang).toBeNull();
  });

  it("hadir: daftar orang tanpa id, dibatasi", () => {
    const o = { nama: "Ns. Rina", unit: "RI", ruang: "Bougenville" };
    expect(bacaHadir(json({ daftar: [o] }))).toEqual({ daftar: [o] });
    expect(bacaHadir(json({ daftar: [] }))).toEqual({ daftar: [] });
    expect(bacaHadir(json({ daftar: [{ ...o, unit: "X" }] }))).toBeNull();
    expect(bacaHadir(json({ daftar: Array.from({ length: MAKS_HADIR + 1 }, () => o) }))).toBeNull();
    expect(bacaHadir(json({}))).toBeNull();
  });
});

describe("potongKolom & label", () => {
  it("path unik, paling banyak MAKS_KOLOM_EVENT, sisanya dihitung", () => {
    expect(potongKolom(["a", "b", "a"])).toEqual({ kolom: ["a", "b"], lebih: 0 });
    const banyak = Array.from({ length: MAKS_KOLOM_EVENT + 5 }, (_, i) => `k${i}`);
    const p = potongKolom(banyak);
    expect(p.kolom).toHaveLength(MAKS_KOLOM_EVENT);
    expect(p.lebih).toBe(5);
  });

  it("tempat & teks orang", () => {
    expect(tempatUnit("RI", "Bougenville")).toBe("Rawat Inap · Bougenville");
    expect(tempatUnit("IGD", null)).toBe("IGD");
    expect(tempatUnit("", null)).toBe("");
    expect(teksOrang({ nama: "Ns. Rina", unit: "RI", ruang: "Bougenville" })).toBe("Ns. Rina (Rawat Inap · Bougenville)");
    expect(teksOrang({ nama: "dr. Andi", unit: "", ruang: null })).toBe("dr. Andi");
  });
});

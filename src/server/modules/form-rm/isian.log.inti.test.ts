import { describe, expect, it } from "vitest";
import {
  bacaPerubahan,
  bolehGabungLog,
  gabungPerubahan,
  JEDA_GABUNG_LOG_MS,
  periksaRantaiLog,
  segelLog,
  type IsiSegelLog,
} from "./isian.log.inti";

const kunci = new TextEncoder().encode("k".repeat(40));

function entri(urut: number, hashSebelum: string | null, ubah: Partial<IsiSegelLog> = {}): { hash: string; isi: IsiSegelLog } {
  const isi: IsiSegelLog = {
    isianId: "isian1",
    urut,
    revAwal: urut + 1,
    revAkhir: urut + 1,
    aksi: "SIMPAN",
    olehId: "u1",
    olehNama: "Ns. Budi",
    konteksNopen: "2611010001",
    konteksUnit: "IGD",
    konteksRuang: "IGD Umum",
    perubahan: [{ p: "alamat", s: "", j: "Jl. A" }],
    createdAt: "2026-11-12T01:00:00.000Z",
    updatedAt: "2026-11-12T01:00:00.000Z",
    hashSebelum,
    ...ubah,
  };
  return { hash: segelLog(kunci, isi), isi };
}

function rantai(n: number) {
  const hasil: { hash: string; isi: IsiSegelLog }[] = [];
  for (let i = 1; i <= n; i++) hasil.push(entri(i, hasil.at(-1)?.hash ?? null));
  return hasil;
}

describe("segel log berantai", () => {
  it("rantai utuh lolos", () => {
    expect(periksaRantaiLog(kunci, rantai(4))).toEqual([]);
  });
  it("nilai sesudah diubah langsung di DB → terdeteksi", () => {
    const r = rantai(3);
    r[1].isi = { ...r[1].isi, perubahan: [{ p: "alamat", s: "", j: "Jl. PALSU" }] };
    expect(periksaRantaiLog(kunci, r)).toEqual(["Log 2: isi tidak cocok dengan segel"]);
  });
  it("nama petugas / unit diubah → terdeteksi", () => {
    const r = rantai(2);
    r[0].isi = { ...r[0].isi, olehNama: "Orang lain" };
    expect(periksaRantaiLog(kunci, r)).toContain("Log 1: isi tidak cocok dengan segel");
  });
  it("entri dihapus di tengah → urut & tautan terputus", () => {
    const r = rantai(3);
    const m = periksaRantaiLog(kunci, [r[0], r[2]]);
    expect(m).toContain("Log 3: nomor urut tidak berurutan (seharusnya 2)");
    expect(m).toContain("Log 3: tautan ke entri sebelumnya terputus");
  });
  it("kunci lain → semua entri gagal", () => {
    const lain = new TextEncoder().encode("x".repeat(40));
    expect(periksaRantaiLog(lain, rantai(2))).toHaveLength(2);
  });
  it("domain segel log berbeda dari segel revisi (awalan)", () => {
    const e = entri(1, null);
    expect(segelLog(kunci, e.isi)).not.toBe(segelLog(kunci, { ...e.isi, urut: 2 }));
  });
});

describe("penggabungan entri (K7)", () => {
  it("nilai sebelum tetap paling awal; sesudah terbaru; kembali ke awal → dibuang", () => {
    const lama = [
      { p: "alamat", s: "", j: "Jl. A" },
      { p: "telp", s: "", j: "08" },
    ];
    const baru = [
      { p: "alamat", s: "Jl. A", j: "Jl. AB" },
      { p: "telp", s: "08", j: "" },
      { p: "agama", s: "", j: "Islam" },
    ];
    expect(gabungPerubahan(lama, baru)).toEqual([
      { p: "alamat", s: "", j: "Jl. AB" },
      { p: "agama", s: "", j: "Islam" },
    ]);
  });
  it("path tumpang tak persis → tak bisa digabung", () => {
    expect(gabungPerubahan([{ p: "skLain.0.teks", s: "", j: "x" }], [{ p: "skLain", s: [], j: [] }])).toBeNull();
  });

  const t0 = new Date("2026-11-12T01:00:00.000Z");
  const terakhir = { aksi: "SIMPAN", olehId: "u1", konteksNopen: "1", revAkhir: 5, updatedAt: t0, perubahan: [] };
  const baru = { aksi: "SIMPAN" as const, olehId: "u1", konteksNopen: "1", revAwal: 6 };
  it("orang, konteks sama, berurutan, ≤ 5 menit → digabung", () => {
    expect(bolehGabungLog(terakhir, baru, new Date(t0.getTime() + JEDA_GABUNG_LOG_MS))).toBe(true);
  });
  it("selain itu → entri baru", () => {
    const nanti = new Date(t0.getTime() + 1000);
    expect(bolehGabungLog(null, baru, nanti)).toBe(false);
    expect(bolehGabungLog(terakhir, { ...baru, olehId: "u2" }, nanti)).toBe(false);
    expect(bolehGabungLog(terakhir, { ...baru, konteksNopen: "2" }, nanti)).toBe(false);
    expect(bolehGabungLog(terakhir, { ...baru, revAwal: 7 }, nanti)).toBe(false);
    expect(bolehGabungLog(terakhir, { ...baru, aksi: "TIMPA" }, nanti)).toBe(false);
    expect(bolehGabungLog({ ...terakhir, aksi: "TIMPA" }, baru, nanti)).toBe(false);
    expect(bolehGabungLog(terakhir, baru, new Date(t0.getTime() + JEDA_GABUNG_LOG_MS + 1))).toBe(false);
  });
  it("perubahan tersimpan dibaca defensif", () => {
    expect(bacaPerubahan([{ p: "a", s: "x", j: "y", t: true }, { s: 1 }, null, "x"])).toEqual([{ p: "a", s: "x", j: "y", t: true }]);
    expect(bacaPerubahan(null)).toEqual([]);
  });
});

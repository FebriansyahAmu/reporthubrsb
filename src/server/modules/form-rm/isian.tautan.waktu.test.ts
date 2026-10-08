import { describe, expect, it } from "vitest";
import type { EpisodeSasaran } from "./form-rm.types";
import { dindingWita, jendelaKandidat, kandidatDari, MAKS_KANDIDAT, msDinding, waktuAcuan } from "./isian.tautan.waktu";

const ep = (o: Partial<EpisodeSasaran>): EpisodeSasaran => ({
  nopen: "2610080001",
  norm: "123",
  nama: "BUDI",
  jenisKelamin: "Laki-Laki",
  umur: "40 th 0 bl",
  ruang: "IGD NON BEDAH",
  ruanganId: "101010101",
  jenis: 2,
  masuk: "2026-10-08T10:00:00",
  keluar: null,
  dirawat: true,
  ...o,
});

describe("jam dinding", () => {
  it("dindingWita = UTC + 8 jam, tanpa bergantung zona waktu server", () => {
    expect(dindingWita(new Date("2026-10-08T01:30:15.900Z"))).toBe("2026-10-08T09:30:15");
    expect(dindingWita(new Date("2026-10-08T20:00:00Z"))).toBe("2026-10-09T04:00:00");
  });

  it("msDinding menolak format & tanggal yang tidak valid", () => {
    expect(msDinding("2026-10-08T09:30")).toBe(Date.UTC(2026, 9, 8, 9, 30));
    expect(msDinding("2026-10-08T09:30:45")).toBe(Date.UTC(2026, 9, 8, 9, 30, 45));
    for (const s of ["", "2026-10-08", "2026-02-31T10:00", "2026-13-01T10:00", "2026-10-08T25:00", "08-10-2026 10:00", "2026-10-08 10:00"]) {
      expect(msDinding(s), s).toBeNull();
    }
  });
});

describe("waktuAcuan", () => {
  const dibuat = new Date("2026-10-08T02:00:00Z"); // 10.00 WITA
  it("memakai waktu dari isi form bila valid", () => {
    expect(waktuAcuan("2026-10-08T09:15", dibuat)).toBe("2026-10-08T09:15:00");
    expect(waktuAcuan(" 2026-10-08T09:15 ", dibuat)).toBe("2026-10-08T09:15:00");
  });
  it("jatuh ke waktu isian dibuat (WITA) bila form kosong / tidak valid", () => {
    expect(waktuAcuan("", dibuat)).toBe("2026-10-08T10:00:00");
    expect(waktuAcuan("bukan tanggal", dibuat)).toBe("2026-10-08T10:00:00");
  });
});

describe("jendelaKandidat", () => {
  it("2 jam sebelum s.d. 48 jam sesudah acuan, format SQL", () => {
    expect(jendelaKandidat("2026-10-08T01:00:00")).toEqual({ from: "2026-10-07 23:00:00", toExclusive: "2026-10-10 01:00:00" });
  });
  it("acuan tidak valid → galat (tak pernah query rentang liar)", () => {
    expect(() => jendelaKandidat("x")).toThrow();
  });
});

describe("kandidatDari", () => {
  const acuan = "2026-10-08T10:00:00";
  const episode = [
    ep({ nopen: "A", masuk: "2026-10-08T15:00:00" }), // +300 mnt
    ep({ nopen: "B", masuk: "2026-10-08T10:20:00" }), // +20 mnt, sudah punya isian
    ep({ nopen: "C", masuk: "2026-10-08T09:30:00" }), // −30 mnt
    ep({ nopen: "D", masuk: "2026-10-08T10:45:00" }), // +45 mnt
  ];
  const lain = new Map([["B", "isianB"]]);

  it("mode saran: tanpa isian dulu, lalu selisih terkecil; isian lain ditandai", () => {
    const k = kandidatDari(episode, acuan, lain, true);
    expect(k.map((x) => x.nopen)).toEqual(["C", "D", "A", "B"]);
    expect(k.map((x) => x.selisihMenit)).toEqual([30, 45, 300, 20]);
    expect(k.find((x) => x.nopen === "B")?.isianLain).toBe("isianB");
    expect(k.find((x) => x.nopen === "C")?.isianLain).toBeNull();
  });

  it("mode cari: urutan asal dipertahankan", () => {
    expect(kandidatDari(episode, acuan, lain, false).map((x) => x.nopen)).toEqual(["A", "B", "C", "D"]);
  });

  it(`dibatasi ${MAKS_KANDIDAT} baris`, () => {
    const banyak = Array.from({ length: 50 }, (_, i) => ep({ nopen: String(i) }));
    expect(kandidatDari(banyak, acuan, new Map(), true)).toHaveLength(MAKS_KANDIDAT);
  });
});

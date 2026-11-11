import { describe, expect, it } from "vitest";
import { adalahDasarTautan, cekKonfirmasi, putuskanRantai, ringkasKeputusan, type KandidatAkar, type TautanAktif } from "./rantai.inti";

const SPRI: KandidatAkar = { spri: "2611110001", waktu: null };
const WAKTU: KandidatAkar = { spri: null, waktu: "2611110002" };
const KEDUA: KandidatAkar = { spri: "2611110001", waktu: "2611110002" };
const aktif = (nopenAkar: string | null, dasar: TautanAktif["dasar"]): TautanAktif => ({ id: "t1", nopenAkar, dasar });

describe("putuskanRantai", () => {
  it("tautan aktif selalu menang atas kandidat SIMGOS (kandidat bisa berubah sesudahnya)", () => {
    expect(putuskanRantai({ aktif: aktif("2611110009", "WAKTU"), pernahDilepas: false, kandidat: SPRI })).toEqual({
      jenis: "tertaut",
      akar: "2611110009",
      tautanId: "t1",
    });
  });

  it("keputusan isian terpisah (TANPA) dihormati — tidak ditanya / ditautkan lagi", () => {
    expect(putuskanRantai({ aktif: aktif(null, "TANPA"), pernahDilepas: false, kandidat: KEDUA })).toEqual({ jenis: "terpisah", tautanId: "t1" });
  });

  it("SPRI → tautan otomatis; SPRI didahulukan atas kandidat ≤ 24 jam", () => {
    expect(putuskanRantai({ aktif: null, pernahDilepas: false, kandidat: SPRI })).toEqual({ jenis: "tautkan-spri", akar: SPRI.spri });
    expect(putuskanRantai({ aktif: null, pernahDilepas: false, kandidat: KEDUA })).toEqual({ jenis: "tautkan-spri", akar: KEDUA.spri });
  });

  it("tautan yang pernah dilepas tidak tertaut ulang diam-diam lewat SPRI", () => {
    expect(putuskanRantai({ aktif: null, pernahDilepas: true, kandidat: SPRI })).toEqual({ jenis: "konfirmasi", akar: SPRI.spri, dasar: "SPRI" });
  });

  it("kandidat ≤ 24 jam selalu butuh konfirmasi", () => {
    for (const pernahDilepas of [false, true]) {
      expect(putuskanRantai({ aktif: null, pernahDilepas, kandidat: WAKTU })).toEqual({ jenis: "konfirmasi", akar: WAKTU.waktu, dasar: "WAKTU" });
    }
  });

  it("tanpa kandidat (bukan episode RI asal IGD) → isian sendiri", () => {
    expect(putuskanRantai({ aktif: null, pernahDilepas: false, kandidat: null })).toEqual({ jenis: "sendiri" });
    expect(putuskanRantai({ aktif: null, pernahDilepas: false, kandidat: { spri: null, waktu: null } })).toEqual({ jenis: "sendiri" });
  });
});

describe("ringkasKeputusan", () => {
  it("ringkasan daftar: tertaut membawa dasar tersimpan, SPRI otomatis, konfirmasi, terpisah, tanpa rantai", () => {
    expect(ringkasKeputusan({ jenis: "tertaut", akar: "1", tautanId: "t" }, "WAKTU")).toEqual({ status: "tertaut", akar: "1", dasar: "WAKTU" });
    expect(ringkasKeputusan({ jenis: "tautkan-spri", akar: "2" }, null)).toEqual({ status: "otomatis", akar: "2", dasar: "SPRI" });
    expect(ringkasKeputusan({ jenis: "konfirmasi", akar: "3", dasar: "WAKTU" }, null)).toEqual({ status: "konfirmasi", akar: "3", dasar: "WAKTU" });
    expect(ringkasKeputusan({ jenis: "terpisah", tautanId: "t" }, "TANPA")).toEqual({ status: "terpisah" });
    expect(ringkasKeputusan({ jenis: "sendiri" }, null)).toBeNull();
  });
});

describe("cekKonfirmasi", () => {
  it("akar harus PERSIS kandidat server (SPRI / ≤ 24 jam) — dasar mengikuti kandidat yang cocok", () => {
    expect(cekKonfirmasi({ aktif: null, kandidat: KEDUA }, KEDUA.spri)).toEqual({ boleh: true, dasar: "SPRI", akar: KEDUA.spri });
    expect(cekKonfirmasi({ aktif: null, kandidat: KEDUA }, KEDUA.waktu)).toEqual({ boleh: true, dasar: "WAKTU", akar: KEDUA.waktu });
  });

  it("menolak episode lain (mis. pasien lain / IGD lama) walau formatnya sah", () => {
    const r = cekKonfirmasi({ aktif: null, kandidat: WAKTU }, "2611119999");
    expect(r.boleh).toBe(false);
  });

  it("isian terpisah hanya bila memang ada kandidat", () => {
    expect(cekKonfirmasi({ aktif: null, kandidat: WAKTU }, null)).toEqual({ boleh: true, dasar: "TANPA", akar: null });
    expect(cekKonfirmasi({ aktif: null, kandidat: null }, null).boleh).toBe(false);
    expect(cekKonfirmasi({ aktif: null, kandidat: { spri: null, waktu: null } }, null).boleh).toBe(false);
  });

  it("episode yang sudah punya tautan aktif tidak bisa dikonfirmasi ulang", () => {
    expect(cekKonfirmasi({ aktif: aktif("1", "SPRI"), kandidat: SPRI }, SPRI.spri).boleh).toBe(false);
    expect(cekKonfirmasi({ aktif: aktif(null, "TANPA"), kandidat: SPRI }, null).boleh).toBe(false);
  });

  it("validasi dasar tautan dari DB", () => {
    expect(["SPRI", "WAKTU", "TANPA"].every(adalahDasarTautan)).toBe(true);
    expect(adalahDasarTautan("spri")).toBe(false);
  });
});

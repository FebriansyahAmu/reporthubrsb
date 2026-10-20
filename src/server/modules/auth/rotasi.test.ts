import { describe, expect, it } from "vitest";
import { bacaMenitIdle, batasIdleRefreshMs } from "@/server/auth/idle";
import { bacaJamMaksSesi, batasSesiSec, jedaSegarkanMs } from "@/server/auth/batas-sesi";
import { ACCESS_TTL_SEC, bacaMenitRefresh } from "@/server/auth/tokens";
import { GRASI_ROTASI_MS, penggantiMasihAktif, putuskanRotasi, type RekamRantai, type RekamRefresh } from "./rotasi";

const T = Date.UTC(2026, 9, 7, 3, 0, 0);
const MENIT = 60_000;
const aktif = (o: Partial<RekamRefresh> = {}): RekamRefresh => ({
  revokedAt: null,
  replacedBy: null,
  expiresAt: new Date(T + 7 * 24 * 60 * MENIT),
  ...o,
});
const IDLE = 30 * MENIT;

describe("putuskanRotasi", () => {
  it("token aktif dalam batas idle → rotasi", () => {
    expect(putuskanRotasi(aktif(), T - 20 * MENIT, T, IDLE)).toBe("rotasi");
    expect(putuskanRotasi(aktif(), T - IDLE, T, IDLE)).toBe("rotasi");
  });

  it("tanpa permintaan melewati batas idle → idle; batas 0 = nonaktif", () => {
    expect(putuskanRotasi(aktif(), T - IDLE - 1, T, IDLE)).toBe("idle");
    expect(putuskanRotasi(aktif(), T - 6 * 24 * 60 * MENIT, T, 0)).toBe("rotasi");
  });

  it("baru dirotasi permintaan paralel (dalam jendela) → cabang, bukan cabut semua", () => {
    const rec = aktif({ revokedAt: new Date(T - 2_000), replacedBy: "hash-baru" });
    expect(putuskanRotasi(rec, T - 16 * MENIT, T, IDLE)).toBe("cabang");
    expect(putuskanRotasi({ ...rec, revokedAt: new Date(T - GRASI_ROTASI_MS) }, T, T, IDLE)).toBe("cabang");
  });

  it("baru dicabut oleh logout → ditolak tanpa cabut semua", () => {
    expect(putuskanRotasi(aktif({ revokedAt: new Date(T - 1_000) }), T, T, IDLE)).toBe("ditolak");
  });

  it("token mati dipakai di luar jendela → reuse (cabut semua sesi)", () => {
    expect(putuskanRotasi(aktif({ revokedAt: new Date(T - GRASI_ROTASI_MS - 1), replacedBy: "x" }), T, T, IDLE)).toBe("reuse");
    expect(putuskanRotasi(aktif({ expiresAt: new Date(T - 1) }), T, T, IDLE)).toBe("reuse");
  });

  it("selisih jam besar (mis. salah zona waktu) gagal tertutup", () => {
    // revokedAt tampak 8 jam di masa depan → bukan cabang abadi.
    expect(putuskanRotasi(aktif({ revokedAt: new Date(T + 8 * 60 * MENIT), replacedBy: "x" }), T, T, IDLE)).toBe("reuse");
  });

  describe("batas mutlak sesi", () => {
    const BATAS = T + 10 * MENIT;

    it("sebelum batas → rotasi; tepat/lewat batas → batas (tanpa cabut semua)", () => {
      expect(putuskanRotasi(aktif(), T - MENIT, T, 0, BATAS)).toBe("rotasi");
      expect(putuskanRotasi(aktif(), T - MENIT, BATAS, 0, BATAS)).toBe("batas");
      expect(putuskanRotasi(aktif(), T - MENIT, BATAS + MENIT, 0, BATAS)).toBe("batas");
      expect(putuskanRotasi(aktif(), T - MENIT, T + 999 * MENIT, 0, null)).toBe("rotasi");
    });

    it("batas didahulukan dari idle", () => {
      expect(putuskanRotasi(aktif(), T - 2 * IDLE, BATAS, IDLE, BATAS)).toBe("batas");
    });

    it("cabang paralel tak boleh melahirkan sesi setelah batas", () => {
      const rec = aktif({ revokedAt: new Date(BATAS - 2_000), replacedBy: "x" });
      expect(putuskanRotasi(rec, T, BATAS - 1_000, 0, BATAS)).toBe("cabang");
      expect(putuskanRotasi(rec, T, BATAS, 0, BATAS)).toBe("batas");
    });

    it("deteksi pencurian & logout tetap didahulukan dari batas", () => {
      expect(putuskanRotasi(aktif({ revokedAt: new Date(BATAS - GRASI_ROTASI_MS - 5_000), replacedBy: "x" }), T, BATAS, 0, BATAS)).toBe("reuse");
      expect(putuskanRotasi(aktif({ revokedAt: new Date(BATAS - 1_000) }), T, BATAS, 0, BATAS)).toBe("ditolak");
    });
  });
});

describe("penggantiMasihAktif (syarat cabang)", () => {
  const rek = (id: string, o: Partial<RekamRantai> = {}): RekamRantai => ({ id, userId: "u1", ...aktif(), ...o });
  const muatDari = (...daftar: RekamRantai[]) => {
    const peta = new Map(daftar.map((r) => [r.id, r]));
    return async (id: string) => peta.get(id) ?? null;
  };
  const lama = rek("t0", { revokedAt: new Date(T - 2_000), replacedBy: "t1" });

  it("pengganti masih aktif → cabang sah", async () => {
    expect(await penggantiMasihAktif(lama, muatDari(rek("t1")), T)).toBe(true);
  });

  it("rotasi beruntun dalam jendela → telusuri sampai token aktif", async () => {
    const t1 = rek("t1", { revokedAt: new Date(T - 1_000), replacedBy: "t2" });
    expect(await penggantiMasihAktif(lama, muatDari(t1, rek("t2")), T)).toBe(true);
  });

  it("'cabut semua sesi' sesudah rotasi (pengganti dicabut tanpa pengganti) → tidak sah", async () => {
    expect(await penggantiMasihAktif(lama, muatDari(rek("t1", { revokedAt: new Date(T - 500) })), T)).toBe(false);
    const t1 = rek("t1", { revokedAt: new Date(T - 1_000), replacedBy: "t2" });
    expect(await penggantiMasihAktif(lama, muatDari(t1, rek("t2", { revokedAt: new Date(T - 100) })), T)).toBe(false);
  });

  it("gagal tertutup: id tak ada (hash lama terpotong), pengguna lain, kedaluwarsa, rantai terlalu panjang", async () => {
    expect(await penggantiMasihAktif(lama, muatDari(), T)).toBe(false);
    expect(await penggantiMasihAktif(lama, muatDari(rek("t1", { userId: "u2" })), T)).toBe(false);
    expect(await penggantiMasihAktif(lama, muatDari(rek("t1", { expiresAt: new Date(T - 1) })), T)).toBe(false);
    const panjang = Array.from({ length: 8 }, (_, i) => rek(`t${i + 1}`, { revokedAt: new Date(T - 100), replacedBy: `t${i + 2}` }));
    expect(await penggantiMasihAktif(lama, muatDari(...panjang, rek("t9")), T)).toBe(false);
  });

  it("pengganti dirotasi di luar jendela → tidak sah", async () => {
    const t1 = rek("t1", { revokedAt: new Date(T - GRASI_ROTASI_MS - 1), replacedBy: "t2" });
    expect(await penggantiMasihAktif(lama, muatDari(t1, rek("t2")), T)).toBe(false);
  });
});

describe("batas idle (K6, opsional sejak 20 Okt 2026)", () => {
  it("SESI_IDLE_MENIT: bawaan nonaktif (0), dijepit 5–480, tak sah → nonaktif", () => {
    expect(bacaMenitIdle(undefined)).toBe(0);
    expect(bacaMenitIdle("")).toBe(0);
    expect(bacaMenitIdle("0")).toBe(0);
    expect(bacaMenitIdle("2")).toBe(5);
    expect(bacaMenitIdle("30")).toBe(30);
    expect(bacaMenitIdle("9999")).toBe(480);
    expect(bacaMenitIdle("-1")).toBe(0);
    expect(bacaMenitIdle("1.5")).toBe(0);
    expect(bacaMenitIdle("abc")).toBe(0);
  });

  it("umur maksimum refresh = masa access + batas idle; 0 = tanpa batas", () => {
    expect(batasIdleRefreshMs(15)).toBe((ACCESS_TTL_SEC + 15 * 60) * 1000);
    expect(batasIdleRefreshMs(0)).toBe(0);
  });
});

describe("tetap masuk: masa refresh, batas mutlak, jeda penyegaran", () => {
  it("AUTH_REFRESH_TTL_MIN: bawaan 60, minimal 2× masa access, maksimal 7 hari", () => {
    expect(bacaMenitRefresh(undefined, 15)).toBe(60);
    expect(bacaMenitRefresh("", 15)).toBe(60);
    expect(bacaMenitRefresh("abc", 15)).toBe(60);
    expect(bacaMenitRefresh("0", 15)).toBe(60);
    expect(bacaMenitRefresh("-5", 15)).toBe(60);
    expect(bacaMenitRefresh("90", 15)).toBe(90);
    expect(bacaMenitRefresh("10", 15)).toBe(30);
    expect(bacaMenitRefresh("99999", 15)).toBe(7 * 24 * 60);
    expect(bacaMenitRefresh(undefined, 45)).toBe(90);
  });

  it("SESI_MAKS_JAM: bawaan 12, 0 = tanpa batas, dijepit 1–72, tak sah → bawaan", () => {
    expect(bacaJamMaksSesi(undefined)).toBe(12);
    expect(bacaJamMaksSesi(" ")).toBe(12);
    expect(bacaJamMaksSesi("0")).toBe(0);
    expect(bacaJamMaksSesi("8")).toBe(8);
    expect(bacaJamMaksSesi("100")).toBe(72);
    expect(bacaJamMaksSesi("2.5")).toBe(12);
    expect(bacaJamMaksSesi("-1")).toBe(12);
  });

  it("batas mutlak dihitung dari saat masuk; 0 jam = tanpa batas", () => {
    expect(batasSesiSec(1_000, 12)).toBe(1_000 + 12 * 3600);
    expect(batasSesiSec(1_000, 0)).toBeNull();
  });

  it("jeda penyegaran: 2 menit sebelum access habis, minimal 1 menit", () => {
    expect(jedaSegarkanMs(15 * 60)).toBe(13 * 60_000);
    expect(jedaSegarkanMs(2 * 60)).toBe(60_000);
    expect(jedaSegarkanMs(30)).toBe(60_000);
  });
});

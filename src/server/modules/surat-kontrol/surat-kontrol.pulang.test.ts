import { describe, expect, it } from "vitest";
import { ValidationError } from "@/server/lib/errors";
import {
  nilaiEpisode,
  ringkasPulang,
  ringkasPulangPerHari,
  ringkasPulangPerRuangan,
  saringPulang,
  selisihHari,
  urutkanPulang,
  type EpisodeMasukan,
} from "./surat-kontrol.pulang";
import { STATUS_DINILAI, STATUS_PULANG, STATUS_PULANG_KEYS } from "./surat-kontrol.pulang.constants";
import type { SuratPulang } from "./surat-kontrol.pulang.types";
import { eksporPulangQuerySchema, pulangQuerySchema, tentukanRentangPulang } from "./surat-kontrol.schema";

const HARI_INI = "2026-11-24";

const surat = (o: Partial<SuratPulang> & { noSurat: string }): SuratPulang => ({
  tglTerbit: null,
  tglRencana: null,
  asalTerbit: o.tglTerbit ? "CACHE" : null,
  poliTujuan: null,
  dokter: null,
  sepTerbit: null,
  aktif: true,
  jadwal: null,
  ...o,
});

const ep = (o: Partial<EpisodeMasukan> = {}): EpisodeMasukan => ({
  key: `RI-${o.kunjungan ?? "K1"}`,
  layanan: "RI",
  nopen: "2611200001",
  kunjungan: "K1",
  norm: "123",
  pasien: "Pasien Uji",
  sep: "1702R0011125V000001",
  tglPulang: "2026-11-20",
  jamPulang: "10:00",
  ruangan: { id: "101020101", nama: "Perawatan Interna" },
  dokter: "dr. Uji",
  cara: 1,
  caraLabel: "Diizinkan pulang",
  wajib: true,
  alasanTidakWajib: null,
  surat: [],
  jadwalTanpaSurat: null,
  ...o,
});

describe("selisihHari", () => {
  it("hari kalender a − b, lintas bulan & tahun", () => {
    expect(selisihHari("2026-11-20", "2026-11-20")).toBe(0);
    expect(selisihHari("2026-12-01", "2026-11-30")).toBe(1);
    expect(selisihHari("2026-12-31", "2027-01-02")).toBe(-2);
  });
});

describe("nilaiEpisode — aturan terbit di hari pulang", () => {
  it("terbit pada tanggal pulang → TEPAT (selisih 0)", () => {
    const e = nilaiEpisode(ep({ surat: [surat({ noSurat: "S1", tglTerbit: "2026-11-20" })] }), HARI_INI);
    expect(e.status).toBe("TEPAT");
    expect(e.selisihHari).toBe(0);
    expect(e.noSuratAcuan).toBe("S1");
  });
  it("terbit setelah pulang → TERLAMBAT (+n); sebelum → LEBIH_AWAL (−n)", () => {
    expect(nilaiEpisode(ep({ surat: [surat({ noSurat: "S1", tglTerbit: "2026-11-22" })] }), HARI_INI)).toMatchObject({ status: "TERLAMBAT", selisihHari: 2 });
    expect(nilaiEpisode(ep({ surat: [surat({ noSurat: "S1", tglTerbit: "2026-11-19" })] }), HARI_INI)).toMatchObject({ status: "LEBIH_AWAL", selisihHari: -1 });
  });
  it("beberapa surat → acuan = surat AKTIF dengan terbit paling awal; surat terhapus diabaikan", () => {
    const e = nilaiEpisode(
      ep({
        surat: [
          surat({ noSurat: "S3", tglTerbit: "2026-11-23" }),
          surat({ noSurat: "S1", tglTerbit: "2026-11-18", aktif: false }),
          surat({ noSurat: "S2", tglTerbit: "2026-11-20" }),
        ],
      }),
      HARI_INI,
    );
    expect(e.status).toBe("TEPAT");
    expect(e.noSuratAcuan).toBe("S2");
    expect(e.surat.map((s) => s.noSurat)).toEqual(["S2", "S3", "S1"]);
  });
  it("surat aktif tanpa tanggal terbit → TAK_TERVERIFIKASI (tidak dinilai)", () => {
    const e = nilaiEpisode(ep({ surat: [surat({ noSurat: "S1" })] }), HARI_INI);
    expect(e.status).toBe("TAK_TERVERIFIKASI");
    expect(e.noSuratAcuan).toBe("S1");
    expect(STATUS_PULANG[e.status].dinilai).toBe(false);
  });
  it("tanpa surat aktif: wajib → BELUM_TERBIT (+ umur hari), tidak wajib → TIDAK_WAJIB", () => {
    const b = nilaiEpisode(ep({ surat: [surat({ noSurat: "S1", tglTerbit: "2026-11-20", aktif: false })], jadwalTanpaSurat: { tanggal: "2026-11-27", jam: "08:00" } }), HARI_INI);
    expect(b).toMatchObject({ status: "BELUM_TERBIT", hariSejakPulang: 4, selisihHari: null, noSuratAcuan: null });
    expect(b.jadwalTanpaSurat).toEqual({ tanggal: "2026-11-27", jam: "08:00" });
    const t = nilaiEpisode(ep({ wajib: false, cara: 6, alasanTidakWajib: "Meninggal" }), HARI_INI);
    expect(t.status).toBe("TIDAK_WAJIB");
  });
  it("tidak wajib TETAPI ada surat → tetap dinilai tanggalnya", () => {
    expect(nilaiEpisode(ep({ wajib: false, surat: [surat({ noSurat: "S1", tglTerbit: "2026-11-21" })] }), HARI_INI).status).toBe("TERLAMBAT");
  });
  it("jadwal tanpa surat diabaikan bila sudah ada surat aktif", () => {
    const e = nilaiEpisode(ep({ surat: [surat({ noSurat: "S1", tglTerbit: "2026-11-20" })], jadwalTanpaSurat: { tanggal: "2026-11-27", jam: null } }), HARI_INI);
    expect(e.jadwalTanpaSurat).toBeNull();
  });
});

describe("saring, urut & ringkas", () => {
  const data = [
    nilaiEpisode(ep({ kunjungan: "A", surat: [surat({ noSurat: "SA", tglTerbit: "2026-11-20" })] }), HARI_INI),
    nilaiEpisode(ep({ kunjungan: "B", tglPulang: "2026-11-24" }), HARI_INI),
    nilaiEpisode(ep({ kunjungan: "C", tglPulang: "2026-11-21" }), HARI_INI),
    nilaiEpisode(ep({ kunjungan: "D", layanan: "RJ", key: "RJ-D", ruangan: { id: "101030101", nama: "Klinik Interna" }, cara: null, surat: [surat({ noSurat: "SD", tglTerbit: "2026-11-22" })] }), HARI_INI),
    nilaiEpisode(ep({ kunjungan: "E", wajib: false, alasanTidakWajib: "Dirujuk ke RS lain" }), HARI_INI),
  ];

  it("ringkasan: kepatuhan = tepat / (tepat + lebih awal + terlambat + belum terbit)", () => {
    const r = ringkasPulang(data, HARI_INI);
    expect(r.total).toBe(5);
    expect(r.dinilai).toBe(4);
    expect(r.perStatus).toMatchObject({ TEPAT: 1, TERLAMBAT: 1, BELUM_TERBIT: 2, TIDAK_WAJIB: 1 });
    expect(r.kepatuhan).toBe(25);
    expect(r.belumHariIni).toBe(1);
    expect(ringkasPulang([], HARI_INI).kepatuhan).toBeNull();
  });
  it("urutan bawaan: belum terbit dulu (pulang terbaru di atas), tidak wajib terakhir", () => {
    expect(urutkanPulang([...data]).map((e) => e.kunjungan)).toEqual(["B", "C", "D", "A", "E"]);
  });
  it("saringan layanan, status, ruangan, tanggal & cari (nomor surat, RM)", () => {
    expect(saringPulang(data, { layanan: "RJ" }).map((e) => e.kunjungan)).toEqual(["D"]);
    expect(saringPulang(data, { status: "BELUM_TERBIT" })).toHaveLength(2);
    expect(saringPulang(data, { ruangan: "Klinik Interna" }).map((e) => e.kunjungan)).toEqual(["D"]);
    expect(saringPulang(data, { tanggal: "2026-11-24" }).map((e) => e.kunjungan)).toEqual(["B"]);
    expect(saringPulang(data, { q: "sa" }).map((e) => e.kunjungan)).toEqual(["A"]);
    expect(saringPulang(data, { q: "  " })).toHaveLength(5);
  });
  it("per hari mengisi setiap tanggal & hanya status yang dinilai", () => {
    const h = ringkasPulangPerHari(data, "2026-11-20", "2026-11-24");
    expect(h.map((x) => x.tanggal)).toEqual(["2026-11-20", "2026-11-21", "2026-11-22", "2026-11-23", "2026-11-24"]);
    expect(h[0]).toMatchObject({ TEPAT: 1, TERLAMBAT: 1, BELUM_TERBIT: 0 });
    expect(h[1].BELUM_TERBIT).toBe(1);
    expect(h.reduce((n, x) => n + STATUS_DINILAI.reduce((m, k) => m + x[k], 0), 0)).toBe(4);
  });
  it("per ruangan: belum terbit terbanyak dulu, dipisah per layanan", () => {
    const r = ringkasPulangPerRuangan(data);
    expect(r[0]).toMatchObject({ ruangan: "Perawatan Interna", layanan: "RI", total: 4, dinilai: 3, tepat: 1, belum: 2, meleset: 0 });
    expect(r[1]).toMatchObject({ ruangan: "Klinik Interna", layanan: "RJ", meleset: 1 });
  });
  it("katalog status: setiap status dinilai ada di STATUS_DINILAI", () => {
    expect(STATUS_PULANG_KEYS.filter((k) => STATUS_PULANG[k].dinilai).sort()).toEqual([...STATUS_DINILAI].sort());
  });
});

describe("tentukanRentangPulang & skema", () => {
  it("bawaan = awal bulan s.d. hari ini; tidak melewati hari ini", () => {
    expect(tentukanRentangPulang({}, HARI_INI)).toEqual({ from: "2026-11-01", to: "2026-11-24" });
    expect(tentukanRentangPulang({ from: "2026-11-20", to: "2026-12-10" }, HARI_INI)).toEqual({ from: "2026-11-20", to: "2026-11-24" });
    expect(tentukanRentangPulang({ from: "2026-12-01" }, HARI_INI)).toEqual({ from: "2026-11-24", to: "2026-11-24" });
    expect(tentukanRentangPulang({ to: "2026-10-31" }, HARI_INI)).toEqual({ from: "2026-10-01", to: "2026-10-31" });
  });
  it("> 31 hari → ValidationError", () => {
    expect(() => tentukanRentangPulang({ from: "2026-10-01", to: "2026-11-01" }, HARI_INI)).toThrow(ValidationError);
  });
  it("skema menolak nilai di luar katalog & tanggal tidak sah", () => {
    expect(pulangQuerySchema.safeParse({ segar: "2" }).success).toBe(false);
    expect(pulangQuerySchema.safeParse({ from: "2026-02-30" }).success).toBe(false);
    expect(eksporPulangQuerySchema.safeParse({ layanan: "IGD" }).success).toBe(false);
    expect(eksporPulangQuerySchema.safeParse({ status: "SESUAI" }).success).toBe(false);
    expect(eksporPulangQuerySchema.safeParse({ status: "BELUM_TERBIT", layanan: "RI", q: "x".repeat(81) }).success).toBe(false);
    expect(eksporPulangQuerySchema.parse({ status: "BELUM_TERBIT", layanan: "RJ", ruangan: " Klinik Anak " })).toMatchObject({ ruangan: "Klinik Anak" });
  });
});

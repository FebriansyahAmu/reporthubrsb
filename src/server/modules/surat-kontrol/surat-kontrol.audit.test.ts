import { describe, expect, it } from "vitest";
import { auditSuratKontrol, pilihJadwal, selisihHari, type MasukanAudit } from "./surat-kontrol.audit";
import { statusDariTemuan } from "./surat-kontrol.constants";
import { ringkas, ringkasPerHari, saringBaris, urutkanBaris } from "./surat-kontrol.filter";
import type { BpjsSurat, LokalSurat, SimrsJadwal } from "./surat-kontrol.types";

const surat = (no: string, tgl: string, o: Partial<BpjsSurat> = {}): BpjsSurat => ({
  noSurat: no,
  jenis: 2,
  jnsPelayanan: "Rawat Jalan",
  tglRencana: tgl,
  tglTerbit: "2026-10-01",
  sepAsal: `SEP-${no}`,
  tglSep: "2026-10-01",
  poliAsal: { kode: "INT", nama: "PENYAKIT DALAM" },
  poliTujuan: { kode: "INT", nama: "PENYAKIT DALAM" },
  dokter: { kode: "1", nama: "dr. A" },
  noKartu: "0001",
  nama: `Pasien ${no}`,
  sepTerbit: true,
  ...o,
});

let idSeq = 1;
const jadwal = (ref: string | null, tgl: string, o: Partial<SimrsJadwal> = {}): SimrsJadwal => ({
  sumber: "JADWAL_KONTROL",
  id: idSeq++,
  nomor: "000001",
  referensi: ref,
  tanggal: tgl,
  jam: "08:00",
  aktif: true,
  sudahDigunakan: false,
  ruangan: { id: "101030102", nama: "KLINIK INTERNA" },
  poliBpjs: "INT",
  dokterId: 1,
  dokter: "dr. A",
  dibuat: "2026-10-01T09:00:00",
  oleh: "Petugas",
  kunjungan: { nomor: "K1", nopen: "N1", norm: "1", ruangan: "KLINIK INTERNA", jenis: "Rawat Jalan", bpjs: true },
  pasien: "Pasien SIMRS",
  ...o,
});

const lokal = (tgl: string, aktif = true): LokalSurat => ({ tglRencana: tgl, aktif, kodeDokter: "1", poli: "INT", petugas: "x" });

function masukan(o: Partial<MasukanAudit>): MasukanAudit {
  return {
    from: "2026-10-01",
    to: "2026-10-31",
    hariIni: "2026-10-12",
    sumber: "LIVE",
    jenis: 2,
    bpjs: [],
    jadwalPerRef: new Map(),
    spriPerRef: new Map(),
    jadwalRentang: [],
    lokal: new Map(),
    ...o,
  };
}

const perRef = (list: SimrsJadwal[]) => {
  const m = new Map<string, SimrsJadwal[]>();
  for (const j of list) if (j.referensi) m.set(j.referensi, [...(m.get(j.referensi) ?? []), j]);
  return m;
};

describe("selisihHari & pilihJadwal", () => {
  it("selisih hari tanpa geser zona", () => {
    expect(selisihHari("2026-10-14", "2026-10-16")).toBe(2);
    expect(selisihHari("2026-10-14", "2026-10-07")).toBe(-7);
    expect(selisihHari("2026-02-28", "2026-03-01")).toBe(1);
  });
  it("jadwal aktif didahulukan, lalu ID terbaru", () => {
    const a = jadwal("R", "2026-10-01", { id: 5, aktif: false });
    const b = jadwal("R", "2026-10-01", { id: 3, aktif: true });
    const c = jadwal("R", "2026-10-01", { id: 4, aktif: true });
    expect(pilihJadwal([a, b, c])?.id).toBe(4);
    expect(pilihJadwal([])).toBeNull();
  });
});

describe("auditSuratKontrol", () => {
  it("surat cocok penuh → SESUAI tanpa temuan", () => {
    const s = surat("S1", "2026-10-14");
    const j = jadwal("S1", "2026-10-14");
    const h = auditSuratKontrol(masukan({ bpjs: [s], jadwalPerRef: perRef([j]), jadwalRentang: [j], lokal: new Map([["S1", lokal("2026-10-14")]]) }));
    expect(h.baris).toHaveLength(1);
    expect(h.baris[0].temuan).toEqual([]);
    expect(h.baris[0].status).toBe("SESUAI");
    expect(h.baris[0].selisihHari).toBe(0);
  });

  it("tanggal SIMRS ≠ BPJS → TANGGAL_BEDA (MASALAH) + selisih", () => {
    const j = jadwal("S1", "2026-10-16");
    const h = auditSuratKontrol(masukan({ bpjs: [surat("S1", "2026-10-14")], jadwalPerRef: perRef([j]), jadwalRentang: [j], lokal: new Map([["S1", lokal("2026-10-14")]]) }));
    expect(h.baris[0].temuan).toContain("TANGGAL_BEDA");
    expect(h.baris[0].status).toBe("MASALAH");
    expect(h.baris[0].selisihHari).toBe(2);
  });

  it("tanpa jadwal → TANPA_JADWAL; jadwal batal → JADWAL_BATAL (tanggal tak dibandingkan)", () => {
    const batal = jadwal("S2", "2026-10-20", { aktif: false });
    const h = auditSuratKontrol(
      masukan({
        bpjs: [surat("S1", "2026-10-14"), surat("S2", "2026-10-14")],
        jadwalPerRef: perRef([batal]),
        lokal: new Map([["S1", lokal("2026-10-14")], ["S2", lokal("2026-10-14")]]),
      }),
    );
    const by = new Map(h.baris.map((b) => [b.key, b]));
    expect(by.get("S1")?.temuan).toEqual(["TANPA_JADWAL"]);
    expect(by.get("S1")?.status).toBe("TINJAU");
    expect(by.get("S2")?.temuan).toEqual(["JADWAL_BATAL"]);
    expect(by.get("S2")?.selisihHari).toBeNull();
  });

  it("poli SIMRS (kode BPJS hasil pemetaan) ≠ poli BPJS → POLI_BEDA; tanpa pemetaan → tidak dinilai", () => {
    const j1 = jadwal("S1", "2026-10-14", { poliBpjs: "SAR" });
    const j2 = jadwal("S2", "2026-10-14", { poliBpjs: null });
    const h = auditSuratKontrol(
      masukan({ bpjs: [surat("S1", "2026-10-14"), surat("S2", "2026-10-14")], jadwalPerRef: perRef([j1, j2]), lokal: new Map([["S1", lokal("2026-10-14")], ["S2", lokal("2026-10-14")]]) }),
    );
    const by = new Map(h.baris.map((b) => [b.key, b]));
    expect(by.get("S1")?.temuan).toEqual(["POLI_BEDA"]);
    expect(by.get("S2")?.temuan).toEqual([]);
  });

  it("catatan lokal hilang/beda/dihapus → LOKAL_BEDA (info, status tetap SESUAI); tidak dinilai saat sumber LOKAL", () => {
    const j = jadwal("S1", "2026-10-14");
    const live = auditSuratKontrol(masukan({ bpjs: [surat("S1", "2026-10-14")], jadwalPerRef: perRef([j]), lokal: new Map([["S1", lokal("2026-10-13")]]) }));
    expect(live.baris[0].temuan).toEqual(["LOKAL_BEDA"]);
    expect(live.baris[0].status).toBe("SESUAI");
    const tanpa = auditSuratKontrol(masukan({ bpjs: [surat("S1", "2026-10-14")], jadwalPerRef: perRef([j]) }));
    expect(tanpa.baris[0].temuan).toEqual(["LOKAL_BEDA"]);
    const cad = auditSuratKontrol(masukan({ sumber: "LOKAL", bpjs: [surat("S1", "2026-10-14")], jadwalPerRef: perRef([j]) }));
    expect(cad.baris[0].temuan).toEqual([]);
    expect(cad.baris[0].bpjsDariLokal).toBe(true);
  });

  it("rencana lewat & SEP kontrol belum terbit → BELUM_DIPAKAI (info); hari ini/depan tidak", () => {
    const h = auditSuratKontrol(
      masukan({
        bpjs: [surat("S1", "2026-10-05", { sepTerbit: false }), surat("S2", "2026-10-12", { sepTerbit: false }), surat("S3", "2026-10-05", { sepTerbit: null })],
        lokal: new Map(["S1", "S2", "S3"].map((k) => [k, lokal(k === "S2" ? "2026-10-12" : "2026-10-05")])),
        jadwalPerRef: perRef([jadwal("S1", "2026-10-05"), jadwal("S2", "2026-10-12"), jadwal("S3", "2026-10-05")]),
      }),
    );
    const by = new Map(h.baris.map((b) => [b.key, b]));
    expect(by.get("S1")?.temuan).toEqual(["BELUM_DIPAKAI"]);
    expect(by.get("S2")?.temuan).toEqual([]);
    expect(by.get("S3")?.temuan).toEqual([]);
  });

  it("jadwal SIMRS di rentang tanpa surat: BPJS → BELUM_BRIDGING; non-BPJS → dilewati & dihitung; batal → abaikan", () => {
    const bpjsPasien = jadwal(null, "2026-10-14");
    const umum = jadwal(null, "2026-10-14", { kunjungan: { nomor: "K2", nopen: "N2", norm: "2", ruangan: null, jenis: null, bpjs: false }, jam: "09:00" });
    const batal = jadwal(null, "2026-10-14", { aktif: false });
    const h = auditSuratKontrol(masukan({ jadwalRentang: [bpjsPasien, umum, batal] }));
    expect(h.baris.map((b) => b.temuan)).toEqual([["BELUM_BRIDGING"]]);
    expect(h.baris[0].key).toBe(`SIMRS-${bpjsPasien.id}`);
    expect(h.nonBpjsDilewati).toBe(1);
  });

  it("jadwal merujuk surat yang tak ada di respons BPJS: lokal aktif di luar rentang → TANGGAL_BEDA (data lokal); selain itu → TIDAK_DI_BPJS", () => {
    const luar = jadwal("S9", "2026-10-03");
    const hilang = jadwal("S8", "2026-10-04", { jam: "09:00" });
    const dihapus = jadwal("S7", "2026-10-05", { jam: "10:00" });
    const dalam = jadwal("S6", "2026-10-06", { jam: "11:00" });
    const h = auditSuratKontrol(
      masukan({
        jadwalRentang: [luar, hilang, dihapus, dalam],
        lokal: new Map([["S9", lokal("2026-09-28")], ["S7", lokal("2026-10-05", false)], ["S6", lokal("2026-10-06")]]),
      }),
    );
    const by = new Map(h.baris.map((b) => [b.key, b]));
    expect(by.get("S9")?.temuan).toEqual(["TANGGAL_BEDA"]);
    expect(by.get("S9")?.bpjsDariLokal).toBe(true);
    expect(by.get("S9")?.selisihHari).toBe(5);
    expect(by.get("S9")?.tglAcuan).toBe("2026-10-03");
    expect(by.get("S8")?.temuan).toEqual(["TIDAK_DI_BPJS"]);
    expect(by.get("S7")?.temuan).toEqual(["TIDAK_DI_BPJS"]);
    expect(by.get("S6")?.temuan).toEqual(["TIDAK_DI_BPJS"]);
  });

  it("jam bentrok: ≥2 jadwal aktif dokter+tanggal+jam sama → JAM_BENTROK pada baris terkait & slot", () => {
    const a = jadwal("S1", "2026-10-14");
    const b = jadwal("S2", "2026-10-14");
    const c = jadwal(null, "2026-10-14"); // tanpa surat → BELUM_BRIDGING, ikut slot
    const lain = jadwal("S3", "2026-10-14", { jam: "09:00" });
    const batal = jadwal("S4", "2026-10-14", { aktif: false });
    const h = auditSuratKontrol(
      masukan({
        bpjs: [surat("S1", "2026-10-14"), surat("S2", "2026-10-14"), surat("S3", "2026-10-14")],
        jadwalPerRef: perRef([a, b, lain]),
        jadwalRentang: [a, b, c, lain, batal],
        lokal: new Map(["S1", "S2", "S3"].map((k) => [k, lokal("2026-10-14")])),
      }),
    );
    expect(h.slot).toHaveLength(1);
    expect(h.slot[0].jumlah).toBe(3);
    expect(new Set(h.slot[0].keys)).toEqual(new Set(["S1", "S2", `SIMRS-${c.id}`]));
    const by = new Map(h.baris.map((x) => [x.key, x]));
    expect(by.get("S1")?.temuan).toEqual(["JAM_BENTROK"]);
    expect(by.get("S1")?.bentrok).toBe(2);
    expect(by.get("S1")?.status).toBe("SESUAI");
    expect(by.get("S3")?.temuan).toEqual([]);
  });

  it("SPRI dibandingkan dengan perencanaan_rawat_inap; filter jenis memisahkan SK & SPRI", () => {
    const spri = surat("P1", "2026-10-10", { jenis: 1, poliTujuan: null });
    const rencana = jadwal("P1", "2026-10-11", { sumber: "SPRI", jam: null, ruangan: null, poliBpjs: null });
    const sk = surat("S1", "2026-10-14");
    const base = { bpjs: [spri, sk], spriPerRef: perRef([rencana]), jadwalPerRef: perRef([jadwal("S1", "2026-10-14")]), lokal: new Map([["P1", lokal("2026-10-10")], ["S1", lokal("2026-10-14")]]) };
    const hSpri = auditSuratKontrol(masukan({ ...base, jenis: 1 }));
    expect(hSpri.baris.map((b) => b.key)).toEqual(["P1"]);
    expect(hSpri.baris[0].temuan).toEqual(["TANGGAL_BEDA"]);
    const hSemua = auditSuratKontrol(masukan({ ...base, jenis: null }));
    expect(hSemua.baris.map((b) => b.key).sort()).toEqual(["P1", "S1"]);
    const hSk = auditSuratKontrol(masukan({ ...base, jenis: 2 }));
    expect(hSk.baris.map((b) => b.key)).toEqual(["S1"]);
  });
});

describe("filter & ringkasan", () => {
  const h = auditSuratKontrol(
    masukan({
      bpjs: [surat("S1", "2026-10-14"), surat("S2", "2026-10-15", { poliTujuan: { kode: "SAR", nama: "SARAF" } }), surat("S3", "2026-10-15")],
      jadwalPerRef: perRef([jadwal("S1", "2026-10-14", { jam: "08:00" }), jadwal("S2", "2026-10-17", { poliBpjs: "SAR", jam: "09:00" })]),
      lokal: new Map(["S1", "S2", "S3"].map((k) => [k, lokal(k === "S1" ? "2026-10-14" : "2026-10-15")])),
    }),
  );
  it("status dari temuan", () => {
    expect(statusDariTemuan(["JAM_BENTROK", "LOKAL_BEDA"])).toBe("SESUAI");
    expect(statusDariTemuan(["POLI_BEDA", "BELUM_DIPAKAI"])).toBe("TINJAU");
    expect(statusDariTemuan(["POLI_BEDA", "TANGGAL_BEDA"])).toBe("MASALAH");
  });
  it("urut: masalah → tinjau → sesuai", () => {
    expect(urutkanBaris([...h.baris]).map((b) => b.status)).toEqual(["MASALAH", "TINJAU", "SESUAI"]);
  });
  it("saring status/temuan/poli/tanggal/cari", () => {
    expect(saringBaris(h.baris, { status: "MASALAH" }).map((b) => b.key)).toEqual(["S2"]);
    expect(saringBaris(h.baris, { temuan: "TANPA_JADWAL" }).map((b) => b.key)).toEqual(["S3"]);
    expect(saringBaris(h.baris, { poli: "SARAF" }).map((b) => b.key)).toEqual(["S2"]);
    expect(saringBaris(h.baris, { tanggal: "2026-10-15" }).map((b) => b.key).sort()).toEqual(["S2", "S3"]);
    expect(saringBaris(h.baris, { q: "pasien s3" }).map((b) => b.key)).toEqual(["S3"]);
    expect(saringBaris(h.baris, { q: "SEP-S1" }).map((b) => b.key)).toEqual(["S1"]);
  });
  it("ringkasan & sebaran harian (hari kosong = 0)", () => {
    const r = ringkas(h.baris);
    expect(r.total).toBe(3);
    expect(r.perStatus).toEqual({ MASALAH: 1, TINJAU: 1, SESUAI: 1 });
    expect(r.kesesuaian).toBe(33.3);
    const hari = ringkasPerHari(h.baris, "2026-10-13", "2026-10-16");
    expect(hari.map((x) => x.tanggal)).toEqual(["2026-10-13", "2026-10-14", "2026-10-15", "2026-10-16"]);
    expect(hari[2]).toEqual({ tanggal: "2026-10-15", masalah: 1, tinjau: 1, sesuai: 0 });
    expect(ringkas([]).kesesuaian).toBeNull();
  });
});

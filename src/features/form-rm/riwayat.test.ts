import { describe, expect, it } from "vitest";
import { pasienFormQuerySchema, riwayatQuerySchema } from "@/server/modules/form-rm/form-rm.schema";
import {
  cocokLayanan,
  jenisDariLayanan,
  KUNCI_LAYANAN,
  LAYANAN,
  layananDariJenis,
  layananDariParam,
  TITIK_LAYANAN,
} from "./layanan";
import { tabDetailDariParam } from "./tab-detail";
import {
  batasRentang,
  filterAwalRiwayat,
  pintasanAktif,
  queryRiwayat,
  rentangPintasan,
  tanggalSah,
  uraiFilterRiwayat,
} from "./riwayat";

const HARI = "2026-11-09";
const BOLEH = ["RM.04", "RM.22"];

describe("riwayat: tanggal & rentang WITA", () => {
  it("tanggal kalender sah", () => {
    expect(tanggalSah("2026-02-28")).toBe(true);
    expect(tanggalSah("2028-02-29")).toBe(true);
    expect(tanggalSah("2026-02-29")).toBe(false);
    expect(tanggalSah("2026-13-01")).toBe(false);
    expect(tanggalSah("9-11-2026")).toBe(false);
  });

  it("batas rentang = 00.00 WITA awal s.d. sebelum 00.00 WITA sesudah akhir (UTC)", () => {
    const b = batasRentang("2026-11-09", "2026-11-09");
    expect(b.gte.toISOString()).toBe("2026-11-08T16:00:00.000Z");
    expect(b.lt.toISOString()).toBe("2026-11-09T16:00:00.000Z");
    // Pergantian bulan/tahun.
    expect(batasRentang("2026-12-01", "2026-12-31").lt.toISOString()).toBe("2026-12-31T16:00:00.000Z");
  });

  it("pintasan rentang & penanda aktif", () => {
    expect(rentangPintasan("hari-ini", HARI)).toEqual({ dari: HARI, sampai: HARI });
    expect(rentangPintasan("7-hari", HARI)).toEqual({ dari: "2026-11-03", sampai: HARI });
    expect(rentangPintasan("30-hari", HARI)).toEqual({ dari: "2026-10-11", sampai: HARI });
    expect(rentangPintasan("bulan-ini", HARI)).toEqual({ dari: "2026-11-01", sampai: HARI });
    expect(pintasanAktif("2026-11-03", HARI, HARI)).toBe("7-hari");
    expect(pintasanAktif("2026-11-02", HARI, HARI)).toBeNull();
  });
});

describe("riwayat: filter URL", () => {
  it("bawaan = 7 hari terakhir, diperbarui, semua status", () => {
    expect(uraiFilterRiwayat({}, HARI, BOLEH)).toEqual(filterAwalRiwayat(HARI));
    expect(filterAwalRiwayat(HARI)).toMatchObject({ dari: "2026-11-03", sampai: HARI, dasar: "diperbarui", status: "semua" });
  });

  it("nilai tak sah → bawaan; form di luar hak diabaikan; kata kunci tak layak dibuang", () => {
    const f = uraiFilterRiwayat(
      { dari: "2026-02-30", sampai: HARI, dasar: "x", status: "HAPUS", form: "RM.70", q: "ab", halaman: "-2", saya: "ya" },
      HARI,
      BOLEH,
    );
    expect(f).toEqual(filterAwalRiwayat(HARI));
  });

  it("rentang terbalik atau > 366 hari → bawaan; 366 hari diterima", () => {
    expect(uraiFilterRiwayat({ dari: HARI, sampai: "2026-11-01" }, HARI, BOLEH).dari).toBe("2026-11-03");
    expect(uraiFilterRiwayat({ dari: "2025-11-08", sampai: HARI }, HARI, BOLEH).dari).toBe("2026-11-03");
    expect(uraiFilterRiwayat({ dari: "2025-11-09", sampai: HARI }, HARI, BOLEH).dari).toBe("2025-11-09");
  });

  it("query URL ringkas (bawaan dihilangkan) & pulang-pergi utuh", () => {
    const awal = filterAwalRiwayat(HARI);
    expect(queryRiwayat(awal, HARI, false)).toBe("");
    expect(queryRiwayat(awal, HARI, true)).toBe("dari=2026-11-03&sampai=2026-11-09");
    const f = { ...awal, dari: "2026-10-01", dasar: "difinalkan" as const, status: "FINAL" as const, form: "RM.22", q: "Budi", saya: true, halaman: 3 };
    const qs = queryRiwayat(f, HARI, false);
    expect(qs).toBe("dari=2026-10-01&sampai=2026-11-09&dasar=difinalkan&status=FINAL&form=RM.22&q=Budi&saya=1&halaman=3");
    expect(uraiFilterRiwayat(new URLSearchParams(qs), HARI, BOLEH)).toEqual(f);
  });
});

describe("riwayat: skema API (strict)", () => {
  const sah = { dari: "2026-11-01", sampai: HARI };
  it("bawaan terisi", () => {
    expect(riwayatQuerySchema.parse(sah)).toEqual({ ...sah, dasar: "diperbarui", status: "semua", halaman: 1 });
  });
  it.each([
    ["parameter asing", { ...sah, sebelum: "x" }],
    ["tanggal mustahil", { ...sah, dari: "2026-02-30" }],
    ["rentang terbalik", { dari: HARI, sampai: "2026-11-01" }],
    ["rentang 367 hari", { dari: "2025-11-07", sampai: HARI }],
    ["kata kunci pendek", { ...sah, q: "ab" }],
    ["kata kunci campuran", { ...sah, q: "budi123" }],
    ["form tak dikenal", { ...sah, form: "RM.99" }],
    ["saya bukan 1", { ...sah, saya: "true" }],
    ["status tak dikenal", { ...sah, status: "HAPUS" }],
    ["halaman 0", { ...sah, halaman: "0" }],
  ])("menolak %s", (_, q) => {
    expect(riwayatQuerySchema.safeParse(q).success).toBe(false);
  });
  it("menerima 366 hari, angka, nama, dan semua opsi", () => {
    expect(riwayatQuerySchema.safeParse({ dari: "2025-11-09", sampai: HARI }).success).toBe(true);
    expect(riwayatQuerySchema.parse({ ...sah, q: " 123456 " }).q).toBe("123456");
    expect(
      riwayatQuerySchema.parse({ ...sah, q: "Siti Aminah", form: "RM.04", saya: "1", dasar: "dibuat", status: "BATAL", halaman: "4" }),
    ).toMatchObject({ q: "Siti Aminah", form: "RM.04", saya: "1", dasar: "dibuat", status: "BATAL", halaman: 4 });
  });
});

describe("halaman detail form: tab & filter layanan pasien", () => {
  it("tab dari URL: dikenal saja, bawaan pasien", () => {
    expect(tabDetailDariParam("riwayat")).toBe("riwayat");
    expect(tabDetailDariParam("pasien")).toBe("pasien");
    expect(tabDetailDariParam("RIWAYAT")).toBe("pasien");
    expect(tabDetailDariParam(undefined)).toBe("pasien");
  });
  it("skema pemilih pasien menerima layanan dikenal, menolak lainnya (strict)", () => {
    expect(pasienFormQuerySchema.parse({ layanan: "ri" })).toMatchObject({ layanan: "ri", halaman: 1 });
    expect(pasienFormQuerySchema.safeParse({ layanan: "3" }).success).toBe(false);
    expect(pasienFormQuerySchema.safeParse({ layanan: "RI" }).success).toBe(false);
    expect(pasienFormQuerySchema.safeParse({ jenis: "3" }).success).toBe(false);
  });
  it("kunci layanan ↔ jenis kunjungan", () => {
    expect(KUNCI_LAYANAN).toEqual(["rj", "igd", "ri"]);
    expect(KUNCI_LAYANAN.map(jenisDariLayanan)).toEqual([1, 2, 3]);
    expect(TITIK_LAYANAN[2]).toBe("bg-chart-igd");
  });
});

describe("filter layanan katalog", () => {
  it("parameter URL dikenal saja", () => {
    expect(layananDariParam("igd")).toBe("igd");
    expect(layananDariParam("IGD")).toBeNull();
    expect(layananDariParam(["igd"])).toBeNull();
    expect(layananDariParam(undefined)).toBeNull();
  });
  it("cocok menurut jenis sasaran; null = semua", () => {
    expect(cocokLayanan([2, 3], "ri")).toBe(true);
    expect(cocokLayanan([2, 3], "rj")).toBe(false);
    expect(cocokLayanan([2], null)).toBe(true);
    expect(LAYANAN.map((l) => l.jenis)).toEqual([1, 2, 3]);
    expect(layananDariJenis(3)?.label).toBe("Rawat Inap");
  });
});
